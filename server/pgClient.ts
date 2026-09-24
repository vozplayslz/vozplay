/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - PostgreSQL Client & Database Engine
 * Suporte a persistência real, transações atômicas e migrações automáticas
 */

import pg from 'pg';
import { logger } from './logger.js';

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
   * Testa e estabelece conexão com o PostgreSQL
   */
  async init(): Promise<boolean> {
    if (!this.pool) {
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
      logger.warn('Falha ao conectar no PostgreSQL. Usando fallback em memória:', { error: String(err) });
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Executa migrações idempotentes para garantir integridade do schema
   */
  private async runMigrations(client: pg.PoolClient) {
    logger.info('Verificando e aplicando migrações do banco de dados...');
    try {
      await client.query(`
        -- 1. Estabelecimentos
        CREATE TABLE IF NOT EXISTS establishments (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            domain VARCHAR(255) NOT NULL DEFAULT 'vozplay.ai.slz.br',
            unit_code VARCHAR(32) UNIQUE NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 1.1 Identidade Visual & Branding
        CREATE TABLE IF NOT EXISTS establishment_branding (
            id VARCHAR(64) PRIMARY KEY,
            establishment_id VARCHAR(64) UNIQUE NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
            logo_url TEXT,
            business_name VARCHAR(100) NOT NULL,
            slogan VARCHAR(160),
            primary_color VARCHAR(16) NOT NULL DEFAULT '#7C3AED',
            secondary_color VARCHAR(16) NOT NULL DEFAULT '#EC4899',
            accent_color VARCHAR(16) NOT NULL DEFAULT '#F59E0B',
            background_color VARCHAR(16) NOT NULL DEFAULT '#060811',
            surface_color VARCHAR(16) NOT NULL DEFAULT '#0E1322',
            text_color VARCHAR(16) NOT NULL DEFAULT '#F8FAFC',
            theme_mode VARCHAR(16) NOT NULL DEFAULT 'DARK',
            tv_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
            participant_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
            controller_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_establishment_branding_est ON establishment_branding(establishment_id);

        -- 2. Sessões
        CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(64) PRIMARY KEY,
            establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
            started_at TIMESTAMP WITH TIME ZONE,
            scheduled_end_time TIMESTAMP WITH TIME ZONE,
            ended_at TIMESTAMP WITH TIME ZONE,
            active_controller_id VARCHAR(64),
            active_controller_name VARCHAR(255),
            supervisor_id VARCHAR(64),
            supervisor_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
        CREATE INDEX IF NOT EXISTS idx_sessions_est ON sessions(establishment_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

        -- 3. Códigos de Presença
        CREATE TABLE IF NOT EXISTS presence_codes (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            controller_id VARCHAR(64),
            code VARCHAR(4) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            is_revoked BOOLEAN NOT NULL DEFAULT FALSE
        );
        CREATE INDEX IF NOT EXISTS idx_presence_codes_session ON presence_codes(session_id, expires_at);

        -- 4. Identidades Persistentes
        CREATE TABLE IF NOT EXISTS participant_identities (
            id VARCHAR(64) PRIMARY KEY,
            normalized_whatsapp VARCHAR(32) UNIQUE NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
            consent_timestamp TIMESTAMP WITH TIME ZONE,
            total_participations INTEGER NOT NULL DEFAULT 1,
            first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_identities_wa ON participant_identities(normalized_whatsapp);

        -- 5. Participantes da Sessão
        CREATE TABLE IF NOT EXISTS participants (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            identity_id VARCHAR(64) REFERENCES participant_identities(id) ON DELETE SET NULL,
            display_name VARCHAR(255) NOT NULL,
            whatsapp VARCHAR(32),
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            verified_at TIMESTAMP WITH TIME ZONE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);

        -- 6. Catálogo Musical
        CREATE TABLE IF NOT EXISTS music (
            id VARCHAR(64) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            artist VARCHAR(255) NOT NULL,
            genre VARCHAR(64) NOT NULL,
            cover_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_music_search ON music(title, artist, genre);

        CREATE TABLE IF NOT EXISTS music_versions (
            id VARCHAR(64) PRIMARY KEY,
            music_id VARCHAR(64) REFERENCES music(id) ON DELETE CASCADE,
            style VARCHAR(64) NOT NULL,
            label VARCHAR(255) NOT NULL,
            youtube_video_id VARCHAR(64) NOT NULL,
            duration_sec INTEGER NOT NULL DEFAULT 180,
            quality VARCHAR(32) DEFAULT '1080p',
            audio_key VARCHAR(16)
        );
        CREATE INDEX IF NOT EXISTS idx_versions_music ON music_versions(music_id);

        -- 7. Fila da Sessão
        CREATE TABLE IF NOT EXISTS queue_items (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE CASCADE,
            participant_display_name VARCHAR(255) NOT NULL,
            partner_participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE SET NULL,
            partner_display_name VARCHAR(255),
            is_duet BOOLEAN NOT NULL DEFAULT FALSE,
            music_id VARCHAR(64) NOT NULL,
            music_title VARCHAR(255) NOT NULL,
            music_artist VARCHAR(255) NOT NULL,
            version_id VARCHAR(64) NOT NULL,
            version_style VARCHAR(64) NOT NULL,
            youtube_video_id VARCHAR(64) NOT NULL,
            tone_offset INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
            order_index INTEGER NOT NULL,
            queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            called_at TIMESTAMP WITH TIME ZONE,
            call_expires_at TIMESTAMP WITH TIME ZONE,
            missed_turn_count INTEGER NOT NULL DEFAULT 0,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            error_message TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_queue_session_status ON queue_items(session_id, status, order_index);

        -- 8. Estados de Reprodução da TV
        CREATE TABLE IF NOT EXISTS playback_states (
            session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
            current_queue_item_id VARCHAR(64) REFERENCES queue_items(id) ON DELETE SET NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'IDLE',
            current_time_sec INTEGER NOT NULL DEFAULT 0,
            volume INTEGER NOT NULL DEFAULT 100,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- 9. Leads (LGPD)
        CREATE TABLE IF NOT EXISTS leads (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            normalized_whatsapp VARCHAR(32) NOT NULL,
            establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
            first_participation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_participation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            participations_count INTEGER NOT NULL DEFAULT 1,
            consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
            consent_date TIMESTAMP WITH TIME ZONE,
            origin VARCHAR(32) NOT NULL DEFAULT 'PARTICIPANTE'
        );
        CREATE INDEX IF NOT EXISTS idx_leads_est ON leads(establishment_id);

        -- 10. Logs de Auditoria
        CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            actor_role VARCHAR(32) NOT NULL,
            actor_name VARCHAR(255) NOT NULL,
            action VARCHAR(64) NOT NULL,
            details TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(session_id, created_at DESC);

        -- 11. Tokens de Autenticação Segura (RBAC Real)
        CREATE TABLE IF NOT EXISTS auth_tokens (
            id VARCHAR(64) PRIMARY KEY,
            token_hash VARCHAR(128) UNIQUE NOT NULL,
            role VARCHAR(32) NOT NULL,
            establishment_id VARCHAR(64) NOT NULL,
            session_id VARCHAR(64) NOT NULL,
            actor_id VARCHAR(64) NOT NULL,
            actor_name VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash, is_revoked);

        -- 12. Reações da TV em Tempo Real
        CREATE TABLE IF NOT EXISTS tv_reactions (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            participant_id VARCHAR(64),
            emoji VARCHAR(32) NOT NULL,
            label VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_tv_reactions_session ON tv_reactions(session_id, created_at DESC);

        -- 13. Efeitos Sonoros / Soundboard
        CREATE TABLE IF NOT EXISTS sound_effects (
            id VARCHAR(64) PRIMARY KEY,
            session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
            sound_id VARCHAR(64) NOT NULL,
            label VARCHAR(128) NOT NULL,
            triggered_by VARCHAR(255) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      logger.info('Migrações do banco de dados concluídas com sucesso.');
    } catch (err) {
      logger.error('Erro ao rodar migrações do PostgreSQL:', err);
      throw err;
    }
  }

  /**
   * Executa query com parâmetros tipados
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
   * Executa operação transacional atômica
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
