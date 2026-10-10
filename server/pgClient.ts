/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - PostgreSQL Client & Database Engine
 * Suporte a persistência real, transações atômicas, isolamento multi-tenant (RLS)
 * e migrações versionadas (P0 Foundation).
 */

import pg from 'pg';
import { logger } from './logger.js';
import { migrationEngine } from './migrations/migrator.js';

const { Pool } = pg;

export class DatabaseClient {
  private pool: pg.Pool | null = null;
  public isConnected: boolean = false;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      try {
        this.pool = new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        this.pool.on('error', (err) => {
          logger.error('Erro inesperado no Pool do PostgreSQL:', err);
        });
      } catch (err) {
        logger.warn('Não foi possível inicializar Pool do PostgreSQL. Operando em modo in-memory resiliente.', { error: String(err) });
      }
    } else {
      logger.info('DATABASE_URL não configurada. Operando em modo In-Memory resiliente.');
    }
  }

  /**
   * Testa e estabelece conexão com o PostgreSQL, aplicando migrações versionadas
   */
  async init(): Promise<boolean> {
    const isProduction = process.env.NODE_ENV === 'production';

    if (!this.pool) {
      if (isProduction && !process.env.K_SERVICE) {
        throw new Error('[CRITICAL_DATABASE_ERROR] DATABASE_URL é estritamente obrigatória em ambiente de produção.');
      }
      logger.info('DATABASE_URL não configurada no ambiente. Operando com armazenamento in-memory para desenvolvimento local.');
      return false;
    }

    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query('SELECT NOW() as now, version() as version');
        this.isConnected = true;
        logger.info('Conexão com PostgreSQL estabelecida com sucesso!', {
          now: res.rows[0].now,
          version: res.rows[0].version
        });
        await this.runMigrations(client);
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      if (isProduction && !process.env.K_SERVICE) {
        throw new Error(`[CRITICAL_DATABASE_ERROR] Falha mandatória ao conectar com PostgreSQL em produção: ${String(err)}`);
      }
      logger.warn('Falha ao conectar no PostgreSQL. Usando armazenamento in-memory para desenvolvimento local:', { error: String(err) });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Obtém um client dedicado do pool para operações avançadas ou sessões manuais
   */
  async getClient(): Promise<pg.PoolClient | null> {
    if (!this.pool || !this.isConnected) return null;
    return this.pool.connect();
  }

  /**
   * Encerra o pool de conexões (usado em scripts ou encerramento gracioso)
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
    }
  }

  /**
   * Define o contexto de isolamento do estabelecimento (Row Level Security) na conexão atual
   */
  async setTenantContext(client: pg.PoolClient, establishmentId: string): Promise<void> {
    if (!establishmentId || typeof establishmentId !== 'string' || !establishmentId.trim()) {
      throw new Error('[CRITICAL_SECURITY_ERROR] Identificador de estabelecimento inválido ou vazio para contexto RLS.');
    }
    await client.query("SELECT set_tenant_context($1)", [establishmentId.trim()]);
  }

  /**
   * Limpa o contexto de isolamento do estabelecimento na conexão atual
   */
  async clearTenantContext(client: pg.PoolClient): Promise<void> {
    try {
      await client.query("SELECT clear_tenant_context()");
    } catch {
      await client.query("RESET app.current_establishment_id").catch(() => {});
    }
  }

  /**
   * Executa operação isolada por tenant context com Row Level Security (RLS) dentro de transação atômica (BEGIN / COMMIT / ROLLBACK)
   */
  async runWithTenantContext<T>(establishmentId: string, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!establishmentId || typeof establishmentId !== 'string' || !establishmentId.trim()) {
      throw new Error('[CRITICAL_SECURITY_ERROR] Identificador de estabelecimento obrigatório para operação multi-tenant.');
    }

    if (!this.pool || !this.isConnected) {
      throw new Error('PostgreSQL indisponível para operação multi-tenant.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.setTenantContext(client, establishmentId);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        logger.error('Erro ao executar ROLLBACK na transação de tenant:', rollbackErr);
      }
      throw err;
    } finally {
      // Limpeza mandatória: remove contexto e descarta estado temporário da sessão
      try {
        await this.clearTenantContext(client);
      } catch (clearErr) {
        logger.warn('Aviso ao limpar contexto de tenant na liberação: ' + String(clearErr));
      }
      client.release();
    }
  }

  /**
   * Executa uma consulta isolada protegida por contexto de tenant
   */
  async queryWithTenant<T extends pg.QueryResultRow = any>(
    establishmentId: string,
    text: string,
    params?: any[]
  ): Promise<pg.QueryResult<T>> {
    return this.runWithTenantContext(establishmentId, async (client) => {
      return client.query<T>(text, params);
    });
  }

  /**
   * Executa migrações pendentes através do motor oficial de migrações
   */
  private async runMigrations(client: pg.PoolClient): Promise<void> {
    logger.info('Verificando e aplicando migrações do banco de dados...');
    try {
      const result = await migrationEngine.up(client);
      if (result.appliedCount > 0) {
        logger.info(`[Migrator] ${result.appliedCount} migrações aplicadas com sucesso: ${result.appliedNames.join(', ')}`);
      } else {
        logger.info('[Migrator] Banco de dados já atualizado. Nenhuma migração pendente.');
      }
    } catch (err) {
      logger.error('Erro ao executar migrações do PostgreSQL:', err);
      throw err;
    }
  }

  /**
   * Executa query com parâmetros tipados e telemetria de latência
   */
  async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    if (!this.pool || !this.isConnected) {
      throw new Error('PostgreSQL indisponível. Usando camada de persistência alternativa.');
    }
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (duration > 500) {
        logger.warn('Query PostgreSQL lenta:', { text, duration, rows: res.rowCount });
      }
      return res;
    } catch (err) {
      logger.error('Erro ao executar query PostgreSQL:', err, { text, params });
      throw err;
    }
  }

  /**
   * Executa operação transacional atômica (BEGIN / COMMIT / ROLLBACK)
   */
  async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool || !this.isConnected) {
      throw new Error('PostgreSQL indisponível para transação.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Transação PostgreSQL revertida (ROLLBACK):', err);
      throw err;
    } finally {
      client.release();
    }
  }
}

export const pgClient = new DatabaseClient();
