/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY SERVICE
 * Serviço central de gerenciamento da camada de memória da MaIA.
 * 
 * Características:
 * - Totalmente modular, desacoplado do Context Engine e do Event Bus.
 * - Suporta operação resiliente (se a memória falhar ou for desabilitada, o produto continua).
 * - Isolamento multi-tenant obrigatório.
 * - Proteção contra Memory Poisoning e vazamento de credenciais (LGPD).
 * - Versionamento de correções e direito de exclusão (Right to be Forgotten).
 */

import { randomUUID } from 'crypto';
import {
  MemoryCandidateInput,
  MemoryItem,
  MemoryQuery,
  MemoryRetrievalResult,
  MemoryScope,
  MemoryAuditRecord,
  MemoryMetrics,
  MemoryType
} from './types.js';
import { IMemoryProvider } from './providers/types.js';
import { InMemoryMemoryProvider } from './providers/inMemoryProvider.js';
import { PostgresMemoryProvider } from './providers/postgresProvider.js';
import { validateMemoryCandidate } from './security/writePolicy.js';
import { calculateExpirationDate, DEFAULT_RETENTION_CONFIG } from './retention/retentionPolicy.js';
import { rankAndApplyBudget } from './relevance/memoryRanker.js';
import { MemoryNotFoundError, MemoryUnavailableError, MemoryError } from './errors.js';
import { logger } from '../../../logger.js';

export class MaiaMemoryService {
  private provider: IMemoryProvider;
  private readonly fallbackProvider: InMemoryMemoryProvider;
  private enabled: boolean = true;
  private auditLog: MemoryAuditRecord[] = [];
  private readonly maxAuditRecords = 500;

  private metrics: MemoryMetrics = {
    totalStored: 0,
    totalRetrieved: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    totalExpiredPruned: 0,
    totalRejected: 0,
    averageRetrievalLatencyMs: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(primaryProvider?: IMemoryProvider) {
    this.fallbackProvider = new InMemoryMemoryProvider();
    this.provider = primaryProvider || new PostgresMemoryProvider();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setProvider(provider: IMemoryProvider): void {
    this.provider = provider;
  }

  public getProvider(): IMemoryProvider {
    return this.provider;
  }

  private async getActiveProvider(): Promise<IMemoryProvider> {
    try {
      if (await this.provider.isAvailable()) {
        return this.provider;
      }
    } catch {
      // Falha de conectividade do provider primário -> fallback silencioso
    }
    return this.fallbackProvider;
  }

  private logAudit(
    action: MemoryAuditRecord['action'],
    tenantId: string,
    memoryId?: string,
    memoryType?: MemoryType,
    scope?: MemoryScope,
    actor?: string,
    reason?: string,
    details?: Record<string, unknown>
  ): void {
    const record: MemoryAuditRecord = {
      id: 'aud-mem-' + Date.now() + '-' + randomUUID().substring(0, 8),
      action,
      memoryId,
      tenantId,
      memoryType,
      scope,
      actor: actor || 'system',
      reason,
      timestamp: new Date().toISOString(),
      details
    };

    this.auditLog.unshift(record);
    if (this.auditLog.length > this.maxAuditRecords) {
      this.auditLog.pop();
    }
  }

  /**
   * Armazena um novo item de memória sob validação e política
   */
  public async store(candidate: MemoryCandidateInput): Promise<MemoryItem> {
    if (!this.enabled) {
      throw new MemoryUnavailableError('Armazenamento de memória está desativado.');
    }

    try {
      // 1. Validação estrita (anti-poisoning, anti-secrets, regras de negócio)
      validateMemoryCandidate(candidate);

      const now = new Date().toISOString();
      const expiresAt = calculateExpirationDate(
        candidate.type,
        candidate.expiresAt,
        candidate.ttlSeconds,
        DEFAULT_RETENTION_CONFIG
      );

      const memoryItem: MemoryItem = {
        id: 'mem-' + Date.now() + '-' + randomUUID().substring(0, 8),
        type: candidate.type,
        scope: candidate.scope,
        tenantId: candidate.tenantId,
        establishmentId: candidate.establishmentId,
        userId: candidate.userId,
        sessionId: candidate.sessionId,
        content: candidate.content,
        summary: candidate.summary,
        source: candidate.source,
        confidence: candidate.confidence ?? 1.0,
        importance: candidate.importance ?? 3,
        createdAt: now,
        updatedAt: now,
        expiresAt,
        version: 1,
        tags: candidate.tags || [],
        metadata: candidate.metadata
      };

      const provider = await this.getActiveProvider();
      await provider.store(memoryItem);

      this.metrics.totalStored++;
      this.logAudit(
        'memory.created',
        memoryItem.tenantId,
        memoryItem.id,
        memoryItem.type,
        memoryItem.scope,
        candidate.createdBy,
        'Item de memória criado com sucesso'
      );

      return memoryItem;
    } catch (err: any) {
      this.metrics.totalRejected++;
      this.logAudit(
        'memory.rejected',
        candidate.tenantId || 'UNKNOWN',
        undefined,
        candidate.type,
        candidate.scope,
        candidate.createdBy,
        err.message || 'Gravação rejeitada por política'
      );
      throw err;
    }
  }

  /**
   * Recupera memórias relevantes aplicando filtros, ranking determinístico e Memory Budget
   */
  public async retrieve(query: MemoryQuery): Promise<MemoryRetrievalResult> {
    const startTimeMs = Date.now();

    // Se desabilitada, retorna fallback seguro sem quebrar o sistema (Resiliência Total)
    if (!this.enabled) {
      return {
        items: [],
        totalMatches: 0,
        retrievalLatencyMs: 0,
        estimatedTokens: 0,
        budgetApplied: false,
        fromFallback: true
      };
    }

    if (!query.tenantId || typeof query.tenantId !== 'string') {
      throw new MemoryError('tenantId é estritamente obrigatório para consulta de memória.', 'INVALID_TENANT_ID');
    }

    try {
      const provider = await this.getActiveProvider();
      const rawItems = await provider.query(query);

      const result = rankAndApplyBudget(rawItems, query, startTimeMs);

      this.metrics.totalRetrieved += result.items.length;
      // Atualização de latência média
      const count = this.metrics.totalRetrieved || 1;
      this.metrics.averageRetrievalLatencyMs = 
        (this.metrics.averageRetrievalLatencyMs * (count - 1) + result.retrievalLatencyMs) / count;

      this.logAudit(
        'memory.retrieved',
        query.tenantId,
        undefined,
        undefined,
        Array.isArray(query.scope) ? query.scope[0] : query.scope,
        query.userId,
        `Recuperados ${result.items.length} itens de ${result.totalMatches} correspondências`
      );

      return result;
    } catch (err) {
      logger.warn('[MaiaMemoryService] Falha ao recuperar memórias do provider ativo', { error: String(err) });
      // Retorno seguro de fallback (Zero Cascade Failure)
      return {
        items: [],
        totalMatches: 0,
        retrievalLatencyMs: Math.max(0, Date.now() - startTimeMs),
        estimatedTokens: 0,
        budgetApplied: false,
        fromFallback: true
      };
    }
  }

  /**
   * Recupera um item específico pelo ID dentro do tenant
   */
  public async getById(tenantId: string, id: string): Promise<MemoryItem | null> {
    if (!this.enabled) return null;
    const provider = await this.getActiveProvider();
    return provider.getById(tenantId, id);
  }

  /**
   * Atualiza uma memória existente preservando histórico e versionamento
   */
  public async update(
    tenantId: string,
    id: string,
    updates: Partial<MemoryCandidateInput>,
    updatedBy?: string
  ): Promise<MemoryItem> {
    if (!this.enabled) {
      throw new MemoryUnavailableError('Armazenamento de memória está desativado.');
    }

    const provider = await this.getActiveProvider();
    const existing = await provider.getById(tenantId, id);
    if (!existing) {
      throw new MemoryNotFoundError(id, tenantId);
    }

    // Se estiver atualizando conteúdo, valida política de integridade
    if (updates.content !== undefined) {
      validateMemoryCandidate({
        ...existing,
        ...updates,
        tenantId,
        type: existing.type,
        scope: existing.scope,
        source: updates.source || existing.source,
        content: updates.content
      } as MemoryCandidateInput);
    }

    const updatedItem: MemoryItem = {
      ...existing,
      content: updates.content !== undefined ? updates.content : existing.content,
      summary: updates.summary !== undefined ? updates.summary : existing.summary,
      importance: updates.importance !== undefined ? updates.importance : existing.importance,
      confidence: updates.confidence !== undefined ? updates.confidence : existing.confidence,
      tags: updates.tags !== undefined ? updates.tags : existing.tags,
      metadata: updates.metadata ? { ...existing.metadata, ...updates.metadata } : existing.metadata,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
      previousVersionId: existing.id,
      updatedBy: updatedBy || 'operator'
    };

    await provider.update(updatedItem);

    this.metrics.totalUpdated++;
    this.logAudit(
      'memory.updated',
      tenantId,
      id,
      updatedItem.type,
      updatedItem.scope,
      updatedBy,
      `Memória atualizada para versão ${updatedItem.version}`
    );

    return updatedItem;
  }

  /**
   * Remove uma memória específica (Direito de Exclusão / LGPD)
   */
  public async delete(tenantId: string, id: string, actor?: string, reason?: string): Promise<boolean> {
    if (!this.enabled) return false;

    const provider = await this.getActiveProvider();
    const existing = await provider.getById(tenantId, id);
    if (!existing) return false;

    const deleted = await provider.delete(tenantId, id);
    if (deleted) {
      this.metrics.totalDeleted++;
      // Auditoria com dados mínimos sem reter o conteúdo removido (Data Minimization)
      this.logAudit(
        'memory.deleted',
        tenantId,
        id,
        existing.type,
        existing.scope,
        actor,
        reason || 'Excluído a pedido'
      );
    }

    return deleted;
  }

  /**
   * Esquece memórias em lote por escopo (ex: encerramento total ou limpeza LGPD de usuário)
   */
  public async forget(
    tenantId: string,
    scope: MemoryScope,
    identifier?: string,
    actor?: string
  ): Promise<number> {
    if (!this.enabled) return 0;

    const provider = await this.getActiveProvider();
    const count = await provider.deleteByScope(tenantId, scope, identifier);

    this.metrics.totalDeleted += count;
    this.logAudit(
      'memory.deleted',
      tenantId,
      undefined,
      undefined,
      scope,
      actor,
      `Esquecidas ${count} memórias do escopo '${scope}' (identificador: ${identifier || 'todos'})`
    );

    return count;
  }

  /**
   * Limpa registros expirados por TTL
   */
  public async pruneExpired(tenantId?: string): Promise<number> {
    if (!this.enabled) return 0;
    const provider = await this.getActiveProvider();
    const count = await provider.pruneExpired(tenantId);
    if (count > 0) {
      this.metrics.totalExpiredPruned += count;
      this.logAudit(
        'memory.expired',
        tenantId || 'GLOBAL',
        undefined,
        undefined,
        undefined,
        'cleaner',
        `Removidas ${count} memórias expiradas`
      );
    }
    return count;
  }

  public getAuditHistory(tenantId?: string, limit: number = 50): MemoryAuditRecord[] {
    if (!tenantId) {
      return this.auditLog.slice(0, limit);
    }
    return this.auditLog.filter(a => a.tenantId === tenantId).slice(0, limit);
  }

  public getMetrics(): MemoryMetrics {
    return { ...this.metrics };
  }

  public async clearAll(tenantId?: string): Promise<void> {
    const provider = await this.getActiveProvider();
    await provider.clear(tenantId);
  }
}

// Instância singleton global do serviço de memória da MaIA
export const maiaMemoryService = new MaiaMemoryService(new InMemoryMemoryProvider());
