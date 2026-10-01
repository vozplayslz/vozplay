/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TOOL IDEMPOTENCY STORE
 * Armazenamento e verificação de chaves de idempotência para ferramentas com mutação de estado.
 * Impede que requisições repetidas executem a mesma ação duas vezes.
 */

interface CachedIdempotentResult {
  result: any;
  timestamp: number;
  expiresAt: number;
}

export class ToolIdempotencyStore {
  private cache = new Map<string, CachedIdempotentResult>();
  private readonly defaultTtlMs: number;

  constructor(options?: { defaultTtlMs?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs || 10 * 60 * 1000; // 10 minutos
  }

  private buildKey(tenantId: string, toolId: string, idempotencyKey: string): string {
    return `${tenantId}:${toolId}:${idempotencyKey}`;
  }

  /**
   * Consulta resultado previamente gravado para a chave de idempotência
   */
  public get(tenantId: string, toolId: string, idempotencyKey: string): any | undefined {
    const key = this.buildKey(tenantId, toolId, idempotencyKey);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Grava resultado associado à chave de idempotência com TTL
   */
  public set(tenantId: string, toolId: string, idempotencyKey: string, result: any, ttlMs?: number): void {
    const key = this.buildKey(tenantId, toolId, idempotencyKey);
    const now = Date.now();
    const duration = ttlMs || this.defaultTtlMs;

    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + duration
    });
  }

  /**
   * Limpa chaves expiradas da memória
   */
  public cleanupExpired(): void {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now > v.expiresAt) {
        this.cache.delete(k);
      }
    }
  }

  /**
   * Limpa todo o cache de idempotência
   */
  public clear(): void {
    this.cache.clear();
  }
}

export const toolIdempotencyStore = new ToolIdempotencyStore();
