/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Versioned Database Migration Engine (P0 Foundation)
 * Suporte a migrations versionadas, idempotência, integridade SHA-256 e status.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { logger } from '../logger.js';

export interface MigrationRecord {
  id: number;
  migration_name: string;
  checksum: string;
  applied_at: string;
}

export interface MigrationStatus {
  name: string;
  applied: boolean;
  appliedAt?: string;
  checksum?: string;
  checksumMatches?: boolean;
}

export class MigrationEngine {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || path.resolve(process.cwd(), 'migrations');
  }

  /**
   * Garante a criação da tabela autoritativa de migrações
   */
  public async ensureMigrationsTable(client: pg.PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
    `);
  }

  /**
   * Lê e ordena todos os arquivos de migração presentes no disco
   */
  public getMigrationFiles(): { name: string; fullPath: string }[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql') && !file.endsWith('_down.sql'))
      .sort((a, b) => a.localeCompare(b));

    return files.map(name => ({
      name,
      fullPath: path.join(this.migrationsDir, name)
    }));
  }

  /**
   * Calcula checksum SHA-256 de um arquivo de migração para auditoria de integridade
   */
  public computeChecksum(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Retorna o status de todas as migrações (aplicadas vs pendentes)
   */
  public async getStatus(client: pg.PoolClient): Promise<MigrationStatus[]> {
    await this.ensureMigrationsTable(client);

    const res = await client.query<MigrationRecord>(
      'SELECT migration_name, checksum, applied_at FROM schema_migrations ORDER BY id ASC'
    );
    const appliedMap = new Map(res.rows.map(r => [r.migration_name, r]));

    const diskFiles = this.getMigrationFiles();
    const statusList: MigrationStatus[] = [];

    for (const file of diskFiles) {
      const record = appliedMap.get(file.name);
      let checksumMatches: boolean | undefined = undefined;

      if (record) {
        const sqlContent = fs.readFileSync(file.fullPath, 'utf8');
        const currentChecksum = this.computeChecksum(sqlContent);
        checksumMatches = (record.checksum === currentChecksum);
      }

      statusList.push({
        name: file.name,
        applied: Boolean(record),
        appliedAt: record ? record.applied_at : undefined,
        checksum: record ? record.checksum : undefined,
        checksumMatches
      });
    }

    return statusList;
  }

  /**
   * Executa todas as migrações pendentes em ordem sequencial com transação atômica por script
   * e bloqueio consultivo (Advisory Lock) para proteção contra concorrência no startup.
   */
  public async up(client: pg.PoolClient): Promise<{ appliedCount: number; appliedNames: string[] }> {
    await this.ensureMigrationsTable(client);

    // Proteção de concorrência global: adquire advisory lock no PostgreSQL
    const ADVISORY_LOCK_ID = 8249102; // Hash numérico estável para o migrador VozPlay
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);

    try {
      const res = await client.query<MigrationRecord>(
        'SELECT migration_name, checksum FROM schema_migrations ORDER BY id ASC'
      );
      const appliedMap = new Map(res.rows.map(r => [r.migration_name, r.checksum]));

      const diskFiles = this.getMigrationFiles();
      const appliedNames: string[] = [];

      // 1. Auditoria de Integridade: Valida checksums de migrações já aplicadas
      for (const file of diskFiles) {
        if (appliedMap.has(file.name)) {
          const expectedChecksum = appliedMap.get(file.name);
          const sqlContent = fs.readFileSync(file.fullPath, 'utf8');
          const currentChecksum = this.computeChecksum(sqlContent);

          if (expectedChecksum !== currentChecksum) {
            const integrityError = `[CRITICAL_MIGRATION_INTEGRITY] A migração "${file.name}" foi modificada após ser aplicada no banco de dados! Checksum no banco: ${expectedChecksum}, Checksum no arquivo: ${currentChecksum}. Modificações retroativas são proibidas.`;
            logger.error(integrityError);
            throw new Error(integrityError);
          }
        }
      }

      // 2. Aplicação sequencial de migrações pendentes
      for (const file of diskFiles) {
        if (appliedMap.has(file.name)) {
          continue;
        }

        logger.info(`[Migrator] Aplicando migração: ${file.name}...`);
        const sqlContent = fs.readFileSync(file.fullPath, 'utf8');
        const checksum = this.computeChecksum(sqlContent);

        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query(
            'INSERT INTO schema_migrations (migration_name, checksum) VALUES ($1, $2)',
            [file.name, checksum]
          );
          await client.query('COMMIT');
          appliedNames.push(file.name);
          logger.info(`[Migrator] Migração ${file.name} aplicada com sucesso!`);
        } catch (err) {
          await client.query('ROLLBACK');
          logger.error(`[Migrator] Falha crítica ao aplicar migração ${file.name}. Rollback executado:`, err);
          throw err;
        }
      }

      return {
        appliedCount: appliedNames.length,
        appliedNames
      };
    } finally {
      // Libera o advisory lock
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
      } catch (err) {
        logger.warn('[Migrator] Aviso ao liberar advisory lock de migração:', { error: String(err) });
      }
    }
  }

  /**
   * Executa rollback da última migração se existir arquivo de rollback correspondente
   */
  public async rollback(client: pg.PoolClient): Promise<{ rolledBackName?: string; message: string }> {
    await this.ensureMigrationsTable(client);

    const res = await client.query<MigrationRecord>(
      'SELECT id, migration_name FROM schema_migrations ORDER BY id DESC LIMIT 1'
    );

    if (res.rows.length === 0) {
      return { message: 'Nenhuma migração aplicada para reverter.' };
    }

    const last = res.rows[0];
    const downFileName = last.migration_name.replace('.sql', '_down.sql');
    const downFilePath = path.join(this.migrationsDir, downFileName);

    if (!fs.existsSync(downFilePath)) {
      const msg = `[Migrator] Rollback automático não disponível: script reverso "${downFileName}" não encontrado. Reversões de DDL críticas devem ser aplicadas manualmente com validação de dados.`;
      logger.warn(msg);
      return { rolledBackName: last.migration_name, message: msg };
    }

    logger.info(`[Migrator] Revertendo migração: ${last.migration_name} via ${downFileName}...`);
    const sqlContent = fs.readFileSync(downFilePath, 'utf8');

    await client.query('BEGIN');
    try {
      await client.query(sqlContent);
      await client.query('DELETE FROM schema_migrations WHERE id = $1', [last.id]);
      await client.query('COMMIT');
      logger.info(`[Migrator] Migração ${last.migration_name} revertida com sucesso.`);
      return {
        rolledBackName: last.migration_name,
        message: `Migração ${last.migration_name} revertida com sucesso.`
      };
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`[Migrator] Falha ao reverter migração ${last.migration_name}:`, err);
      throw err;
    }
  }
}

export const migrationEngine = new MigrationEngine();

// Suporte para execução direta via CLI (npm run migrate / tsx server/migrations/migrator.ts)
if (process.argv[1] && process.argv[1].endsWith('migrator.ts')) {
  const command = process.argv[2] || 'up';
  import('../pgClient.js').then(async ({ pgClient }) => {
    const client = await pgClient.getClient();
    if (!client) {
      console.error('Falha ao conectar no PostgreSQL para migrações.');
      process.exit(1);
    }
    try {
      if (command === 'status') {
        const statuses = await migrationEngine.getStatus(client);
        console.table(statuses);
      } else if (command === 'rollback') {
        const res = await migrationEngine.rollback(client);
        console.log(res.message);
      } else {
        const res = await migrationEngine.up(client);
        console.log(`Migrações concluídas: ${res.appliedCount} aplicadas.`);
      }
    } finally {
      client.release();
      await pgClient.close();
      process.exit(0);
    }
  }).catch(err => {
    console.error('Erro na execução do migrator:', err);
    process.exit(1);
  });
}
