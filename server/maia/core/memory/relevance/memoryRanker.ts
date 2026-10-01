/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY RANKER & BUDGET ENGINE
 * Algoritmo determinístico de relevância e aplicação estrita de orçamento (Memory Budget).
 * 
 * Princípio:
 * A MaIA JAMAIS recupera memória ilimitada nem envia dumps de banco para o LLM.
 * A relevância combina determinismo: importância, confiança, recência e alinhamento de escopo/tags.
 */

import { MemoryItem, MemoryQuery, MemoryRetrievalResult } from '../types.js';
import { isMemoryExpired } from '../retention/retentionPolicy.js';

const CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Estima a quantidade de tokens consumidos por um item de memória
 */
export function estimateMemoryTokens(item: MemoryItem): number {
  const contentStr = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
  const summaryStr = item.summary || '';
  const tagsStr = (item.tags || []).join(' ');
  const totalChars = contentStr.length + summaryStr.length + tagsStr.length + 50; // overhead de metadados
  return Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE);
}

/**
 * Calcula a pontuação determinística de relevância (0.00 a 1.00)
 */
export function computeRelevanceScore(item: MemoryItem, query: MemoryQuery, nowMs: number = Date.now()): number {
  // 1. Normalização da importância (1 a 5 -> 0.2 a 1.0)
  const importanceNorm = Math.max(0.2, Math.min(1.0, (item.importance || 3) / 5));

  // 2. Confiança (0.0 a 1.0)
  const confidenceNorm = Math.max(0.0, Math.min(1.0, item.confidence ?? 1.0));

  // 3. Recência com decaimento exponencial
  const createdMs = new Date(item.createdAt).getTime();
  const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 3600));
  // Decaimento suave: 1.0 imediato, ~0.8 em 24h, ~0.5 em 7 dias, ~0.2 em 30 dias
  const recencyNorm = Math.max(0.1, 1 / (1 + ageHours / 72));

  // 4. Correspondência com Tags consultadas (bônus de até 0.10)
  let tagBonus = 0;
  if (query.tags && query.tags.length > 0 && item.tags && item.tags.length > 0) {
    const itemTagSet = new Set(item.tags.map(t => t.toLowerCase()));
    const matchingTags = query.tags.filter(t => itemTagSet.has(t.toLowerCase())).length;
    tagBonus = Math.min(1.0, matchingTags / query.tags.length);
  }

  // 5. Correspondência com Termo de Busca
  let searchBonus = 0;
  if (query.searchText && query.searchText.trim() !== '') {
    const term = query.searchText.toLowerCase().trim();
    const sumMatch = (item.summary || '').toLowerCase().includes(term);
    const contentMatch = JSON.stringify(item.content).toLowerCase().includes(term);
    if (sumMatch) searchBonus = 1.0;
    else if (contentMatch) searchBonus = 0.6;
  }

  // Composição ponderada dos fatores
  const baseScore = (importanceNorm * 0.40) + 
                    (confidenceNorm * 0.25) + 
                    (recencyNorm * 0.20) + 
                    (tagBonus * 0.10) + 
                    (searchBonus * 0.05);

  return Math.max(0, Math.min(1.0, baseScore));
}

/**
 * Filtra, pontua, ordena e aplica o Memory Budget na lista de memórias
 */
export function rankAndApplyBudget(
  items: MemoryItem[],
  query: MemoryQuery,
  startTimeMs: number
): MemoryRetrievalResult {
  const nowMs = Date.now();
  const maxLimit = Math.max(1, Math.min(50, query.limit || 10));
  const maxTokens = Math.max(100, Math.min(10000, query.maxEstimatedTokens || 1000));

  // 1. Filtragem preliminar de negócio
  const filtered = items.filter(item => {
    // Isolamento obrigatório de tenant
    if (item.tenantId !== query.tenantId) {
      return false;
    }

    // Expiração (por padrão omite expiradas)
    if (!query.includeExpired && isMemoryExpired(item, nowMs)) {
      return false;
    }

    // Filtro por escopo
    if (query.scope) {
      const allowedScopes = Array.isArray(query.scope) ? query.scope : [query.scope];
      if (!allowedScopes.includes(item.scope)) {
        return false;
      }
    }

    // Filtro por tipo
    if (query.types && query.types.length > 0) {
      if (!query.types.includes(item.type)) {
        return false;
      }
    }

    // Filtro por usuário
    if (query.userId && item.userId && item.userId !== query.userId) {
      return false;
    }

    // Filtro por sessão
    if (query.sessionId && item.sessionId && item.sessionId !== query.sessionId) {
      return false;
    }

    // Filtro por estabelecimento
    if (query.establishmentId && item.establishmentId && item.establishmentId !== query.establishmentId) {
      return false;
    }

    // Limites de confiança e importância
    if (query.minImportance !== undefined && item.importance < query.minImportance) {
      return false;
    }

    if (query.minConfidence !== undefined && item.confidence < query.minConfidence) {
      return false;
    }

    // Data mínima de corte
    if (query.since) {
      const sinceMs = new Date(query.since).getTime();
      const updatedMs = new Date(item.updatedAt || item.createdAt).getTime();
      if (updatedMs < sinceMs) {
        return false;
      }
    }

    // Busca textual
    if (query.searchText && query.searchText.trim() !== '') {
      const term = query.searchText.toLowerCase().trim();
      const textCorpus = `${item.summary || ''} ${JSON.stringify(item.content)} ${(item.tags || []).join(' ')}`.toLowerCase();
      if (!textCorpus.includes(term)) {
        return false;
      }
    }

    return true;
  });

  const totalMatches = filtered.length;

  // 2. Pontuação e ordenação determinística
  const scoredItems = filtered.map(item => ({
    item,
    score: computeRelevanceScore(item, query, nowMs)
  }));

  scoredItems.sort((a, b) => b.score - a.score);

  // 3. Aplicação do Memory Budget (limite numérico e teto de tokens)
  const budgetedItems: MemoryItem[] = [];
  let currentTokens = 0;
  let budgetApplied = false;

  for (const entry of scoredItems) {
    if (budgetedItems.length >= maxLimit) {
      budgetApplied = true;
      break;
    }

    const itemTokens = estimateMemoryTokens(entry.item);
    if (currentTokens + itemTokens > maxTokens && budgetedItems.length > 0) {
      budgetApplied = true;
      break;
    }

    budgetedItems.push(entry.item);
    currentTokens += itemTokens;
  }

  const retrievalLatencyMs = Math.max(0, Date.now() - startTimeMs);

  return {
    items: budgetedItems,
    totalMatches,
    retrievalLatencyMs,
    estimatedTokens: currentTokens,
    budgetApplied,
    fromFallback: false
  };
}
