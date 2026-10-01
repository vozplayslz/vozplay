/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY RETENTION POLICY
 * Configuração e cálculo centralizado de TTL e expiração por tipo de memória.
 * Evita retenção infinita não intencional e depósito cumulativo de dados transitórios.
 */

import { MemoryType, RetentionPolicyConfig, MemoryItem } from '../types.js';

export const DEFAULT_RETENTION_CONFIG: RetentionPolicyConfig = {
  defaultTtlSeconds: {
    WORKING: 4 * 3600,             // 4 horas: memórias de trabalho transitórias
    SESSION: 24 * 3600,            // 24 horas: duração da sessão + janela de auditoria
    EPISODIC: 30 * 24 * 3600,      // 30 dias: episódios e eventos relevantes
    SEMANTIC: null,                // Indefinido: conhecimento operacional estável (persistente enquanto válido)
    PREFERENCE: null,              // Indefinido: preferências explícitas do usuário/operador
    OPERATIONAL: 90 * 24 * 3600    // 90 dias: configurações e parâmetros operacionais de continuidade
  },
  maxTtlSeconds: {
    WORKING: 24 * 3600,            // Máximo 24h para working memory
    SESSION: 7 * 24 * 3600,        // Máximo 7 dias para sessão
    EPISODIC: 365 * 24 * 3600,     // Máximo 1 ano para memória episódica
    SEMANTIC: null,
    PREFERENCE: null,
    OPERATIONAL: 365 * 24 * 3600
  },
  autoPruneEnabled: true
};

/**
 * Calcula a data ISO de expiração para um item baseado no tipo e nas opções fornecidas
 */
export function calculateExpirationDate(
  type: MemoryType,
  explicitExpiresAt?: string,
  explicitTtlSeconds?: number,
  config: RetentionPolicyConfig = DEFAULT_RETENTION_CONFIG
): string | undefined {
  const nowMs = Date.now();

  // 1. Se informou data explícita em ISO
  if (explicitExpiresAt) {
    const targetMs = new Date(explicitExpiresAt).getTime();
    if (!isNaN(targetMs)) {
      if (targetMs <= nowMs) {
        // Data no passado (expirado imediatamente para testes ou expurgos imediatos)
        return new Date(targetMs).toISOString();
      }
      const maxTtl = config.maxTtlSeconds[type];
      if (maxTtl !== null && (targetMs - nowMs) > maxTtl * 1000) {
        // Clamping para o TTL máximo do tipo
        return new Date(nowMs + maxTtl * 1000).toISOString();
      }
      return new Date(targetMs).toISOString();
    }
  }

  // 2. Se informou TTL explícito em segundos
  if (typeof explicitTtlSeconds === 'number' && explicitTtlSeconds > 0) {
    const maxTtl = config.maxTtlSeconds[type];
    const effectiveTtl = maxTtl !== null ? Math.min(explicitTtlSeconds, maxTtl) : explicitTtlSeconds;
    return new Date(nowMs + effectiveTtl * 1000).toISOString();
  }

  // 3. Fallback para a política padrão do tipo
  const defaultTtl = config.defaultTtlSeconds[type];
  if (defaultTtl !== null && defaultTtl > 0) {
    return new Date(nowMs + defaultTtl * 1000).toISOString();
  }

  return undefined;
}

/**
 * Verifica se um item de memória está expirado
 */
export function isMemoryExpired(item: MemoryItem, nowMs: number = Date.now()): boolean {
  if (!item.expiresAt) return false;
  const expMs = new Date(item.expiresAt).getTime();
  if (isNaN(expMs)) return false;
  return nowMs >= expMs;
}
