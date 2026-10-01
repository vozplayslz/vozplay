/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA POSTGRESQL STORAGE PROVIDER
 * Provedor de armazenamento relacional com persistência em PostgreSQL.
 * Utiliza a tabela 'maia_memories' com índices otimizados e transações seguras.
 */

import { IMemoryProvider } from './types.js';
import { MemoryItem, MemoryQuery, MemoryScope } from '../types.js';
import { pgClient } from '../../../../pgClient.js';
import { logger } from '../../../../logger.js';

export class PostgresMemoryProvider implements IMemoryProvider {
  public readonly name = 'PostgresMemoryProvider';
  private schemaInitialized = false;

  public async isAvailable(): Promise<boolean> {
    return pgClient.isConnected;
  }

  public async ensureSchema(): Promise<void> {
    if (!pgClient.isConnected || this.schemaInitialized) return;
    try {
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS maia_memories (
          id VARCHAR(64) PRIMARY KEY,
          type VARCHAR(32) NOT NULL,
          scope VARCHAR(32) NOT NULL,
          tenant_id VARCHAR(64) NOT NULL,
          establishment_id VARCHAR(64),
          user_id VARCHAR(64),
          session_id VARCHAR(64),
          content JSONB NOT NULL,
          summary TEXT,
          source VARCHAR(32) NOT NULL,
          confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
          importance INTEGER NOT NULL DEFAULT 3,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE,
          version INTEGER NOT NULL DEFAULT 1,
          previous_version_id VARCHAR(64),
          updated_by VARCHAR(64),
          metadata JSONB,
          tags TEXT[]
        );
        CREATE INDEX IF NOT EXISTS idx_maia_mem_tenant ON maia_memories(tenant_id, type, scope);
        CREATE INDEX IF NOT EXISTS idx_maia_mem_session ON maia_memories(session_id);
        CREATE INDEX IF NOT EXISTS idx_maia_mem_user ON maia_memories(user_id);
        CREATE INDEX IF NOT EXISTS idx_maia_mem_expires ON maia_memories(expires_at);
      `);
      this.schemaInitialized = true;
    } catch (err) {
      logger.warn('[PostgresMemoryProvider] Falha ao verificar schema da tabela maia_memories', { error: String(err) });
    }
  }

  private mapRowToItem(row: any): MemoryItem {
    return {
      id: row.id,
      type: row.type,
      scope: row.scope,
      tenantId: row.tenant_id,
      establishmentId: row.establishment_id || undefined,
      userId: row.user_id || undefined,
      sessionId: row.session_id || undefined,
      content: row.content,
      summary: row.summary || undefined,
      source: row.source,
      confidence: Number(row.confidence),
      importance: Number(row.importance),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
      version: Number(row.version),
      previousVersionId: row.previous_version_id || undefined,
      updatedBy: row.updated_by || undefined,
      tags: row.tags || undefined,
      metadata: row.metadata || undefined
    };
  }

  public async store(item: MemoryItem): Promise<void> {
    await this.ensureSchema();
    await pgClient.query(
      `INSERT INTO maia_memories (
        id, type, scope, tenant_id, establishment_id, user_id, session_id,
        content, summary, source, confidence, importance, created_at, updated_at,
        expires_at, version, previous_version_id, updated_by, metadata, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        confidence = EXCLUDED.confidence,
        importance = EXCLUDED.importance,
        updated_at = EXCLUDED.updated_at,
        expires_at = EXCLUDED.expires_at,
        version = EXCLUDED.version,
        previous_version_id = EXCLUDED.previous_version_id,
        updated_by = EXCLUDED.updated_by,
        metadata = EXCLUDED.metadata,
        tags = EXCLUDED.tags`,
      [
        item.id,
        item.type,
        item.scope,
        item.tenantId,
        item.establishmentId || null,
        item.userId || null,
        item.sessionId || null,
        JSON.stringify(item.content),
        item.summary || null,
        item.source,
        item.confidence,
        item.importance,
        item.createdAt,
        item.updatedAt,
        item.expiresAt || null,
        item.version,
        item.previousVersionId || null,
        item.updatedBy || null,
        item.metadata ? JSON.stringify(item.metadata) : null,
        item.tags || null
      ]
    );
  }

  public async getById(tenantId: string, id: string): Promise<MemoryItem | null> {
    await this.ensureSchema();
    const res = await pgClient.query(
      `SELECT * FROM maia_memories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToItem(res.rows[0]);
  }

  public async query(query: MemoryQuery): Promise<MemoryItem[]> {
    await this.ensureSchema();
    const params: any[] = [query.tenantId];
    let sql = `SELECT * FROM maia_memories WHERE tenant_id = $1`;

    if (query.userId) {
      params.push(query.userId);
      sql += ` AND (user_id = $${params.length} OR user_id IS NULL)`;
    }

    if (query.sessionId) {
      params.push(query.sessionId);
      sql += ` AND (session_id = $${params.length} OR session_id IS NULL)`;
    }

    if (query.establishmentId) {
      params.push(query.establishmentId);
      sql += ` AND (establishment_id = $${params.length} OR establishment_id IS NULL)`;
    }

    if (query.types && query.types.length > 0) {
      params.push(query.types);
      sql += ` AND type = ANY($${params.length})`;
    }

    if (!query.includeExpired) {
      sql += ` AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
    }

    sql += ` ORDER BY updated_at DESC LIMIT 100`;

    const res = await pgClient.query(sql, params);
    return res.rows.map(r => this.mapRowToItem(r));
  }

  public async update(item: MemoryItem): Promise<void> {
    await this.store(item);
  }

  public async delete(tenantId: string, id: string): Promise<boolean> {
    await this.ensureSchema();
    const res = await pgClient.query(
      `DELETE FROM maia_memories WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount || 0) > 0;
  }

  public async deleteByScope(tenantId: string, scope: MemoryScope, identifier?: string): Promise<number> {
    await this.ensureSchema();
    let sql = `DELETE FROM maia_memories WHERE tenant_id = $1 AND scope = $2`;
    const params: any[] = [tenantId, scope];

    if (identifier) {
      if (scope === 'session') {
        params.push(identifier);
        sql += ` AND session_id = $${params.length}`;
      } else if (scope === 'user') {
        params.push(identifier);
        sql += ` AND user_id = $${params.length}`;
      } else if (scope === 'establishment') {
        params.push(identifier);
        sql += ` AND establishment_id = $${params.length}`;
      }
    }

    const res = await pgClient.query(sql, params);
    return res.rowCount || 0;
  }

  public async pruneExpired(tenantId?: string): Promise<number> {
    await this.ensureSchema();
    let sql = `DELETE FROM maia_memories WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP`;
    const params: any[] = [];
    if (tenantId) {
      params.push(tenantId);
      sql += ` AND tenant_id = $1`;
    }
    const res = await pgClient.query(sql, params);
    return res.rowCount || 0;
  }

  public async clear(tenantId?: string): Promise<void> {
    await this.ensureSchema();
    if (tenantId) {
      await pgClient.query(`DELETE FROM maia_memories WHERE tenant_id = $1`, [tenantId]);
    } else {
      await pgClient.query(`DELETE FROM maia_memories`);
    }
  }
}
