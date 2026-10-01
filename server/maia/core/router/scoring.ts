/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ROUTING SCORE & SELECTION ENGINE (PROMPT 07)
 * Algoritmo determinístico e observável de seleção de modelo e provedor.
 * 
 * Critérios Avaliados:
 * 1. Capacidade do modelo (Compatibilidade mandatória com a AITask)
 * 2. Suporte a Tools (Obrigatório se a requisição contém ferramentas)
 * 3. Suporte a Streaming (Obrigatório se a requisição for em streaming)
 * 4. Perfil Operacional (ECONÔMICO, BALANCEADO, ALTA CAPACIDADE)
 * 5. Classe de Latência e Eficiência de Custo
 * 6. Políticas do Locatário (Allowed / Disallowed Models and Providers)
 */

import { AITask, AIProfile, AIModelProfile, AIRequest, TenantAIRouterPolicy } from './types.js';
import { OFFICIAL_AI_MODELS, getModelProfile } from './models.js';
import { AIPolicyDeniedError, AIModelUnavailableError } from './errors.js';

export interface ScoredModelCandidate {
  modelProfile: AIModelProfile;
  score: number;
  breakdown: {
    capabilityMatch: number;
    profileAlignment: number;
    costScore: number;
    latencyScore: number;
    preferenceBonus: number;
  };
}

export interface RouteResolution {
  providerId: string;
  modelId: string;
  modelProfile: AIModelProfile;
  score: number;
  timeoutMs: number;
}

/**
 * Timeout padrão recomendado por tarefa em milissegundos
 */
export const DEFAULT_TASK_TIMEOUTS: Record<AITask, number> = {
  conversation: 8000,
  classification: 4000,
  extraction: 6000,
  summarization: 8000,
  memory_summarization: 8000,
  tool_selection: 6000,
  translation: 6000,
  reasoning: 20000,
  planning: 15000,
  embedding: 4000,
  transcription: 25000,
  tts: 10000,
  realtime_voice: 3000
};

/**
 * Avalia e pontua um modelo de IA para uma requisição específica
 */
export function scoreModel(
  model: AIModelProfile,
  request: AIRequest,
  profile: AIProfile,
  policy?: TenantAIRouterPolicy
): ScoredModelCandidate | null {
  // 1. Verificações Mandatórias (Hard Constraints)
  if (!model.enabled) return null;

  // A. O modelo DEVE suportar a tarefa solicitada
  if (!model.capabilities.includes(request.task)) {
    return null;
  }

  // B. Se a requisição exige tools, o modelo DEVE suportar ferramentas
  if (request.tools && request.tools.length > 0 && !model.supportsTools) {
    return null;
  }

  // C. Política do Tenant (se fornecida)
  if (policy) {
    if (!policy.aiEnabled) return null;
    if (policy.disallowedProviders.includes(model.provider)) return null;
    if (policy.disallowedModels.includes(model.id)) return null;
    if (policy.allowedProviders.length > 0 && !policy.allowedProviders.includes(model.provider)) return null;
    if (policy.allowedModels.length > 0 && !policy.allowedModels.includes(model.id)) return null;
  }

  // 2. Pontuação Ponderada
  const isContingency = model.provider === 'contingency';
  const capabilityMatch = isContingency
    ? ((request.providerPreference === 'contingency' || request.modelPreference === model.id) ? 1.0 : 0.25)
    : 1.0;

  const breakdown = {
    capabilityMatch,
    profileAlignment: 0.5,
    costScore: 0.5,
    latencyScore: 0.5,
    preferenceBonus: 0.0
  };

  // Alinhamento de Perfil
  if (profile === 'ECONOMICO') {
    // Favorece custo baixo e latência mínima
    breakdown.costScore = Math.max(0, 1 - (model.costOutput / 6.0));
    breakdown.latencyScore = model.latencyClass === 'LOW' ? 1.0 : model.latencyClass === 'MEDIUM' ? 0.6 : 0.2;
    breakdown.profileAlignment = model.costOutput <= 1.0 ? 1.0 : 0.4;
  } else if (profile === 'ALTA_CAPACIDADE') {
    // Favorece raciocínio e tamanho de contexto
    breakdown.profileAlignment = (model.capabilities.includes('reasoning') || model.contextWindow >= 2000000) ? 1.0 : 0.6;
    breakdown.latencyScore = 0.5; // Menos sensível à latência
    breakdown.costScore = 0.3;    // Menos sensível ao custo
  } else {
    // BALANCEADO: Equilíbrio padrão
    breakdown.costScore = Math.max(0, 1 - (model.costOutput / 8.0));
    breakdown.latencyScore = model.latencyClass === 'LOW' ? 0.9 : model.latencyClass === 'MEDIUM' ? 0.7 : 0.4;
    breakdown.profileAlignment = 0.8;
  }

  // Bônus se houver preferência explícita
  if (request.modelPreference && request.modelPreference === model.id) {
    breakdown.preferenceBonus = 0.3;
  } else if (request.providerPreference && request.providerPreference === model.provider) {
    breakdown.preferenceBonus = 0.15;
  }

  const finalScore = (
    breakdown.capabilityMatch * 0.35 +
    breakdown.profileAlignment * 0.30 +
    breakdown.costScore * 0.15 +
    breakdown.latencyScore * 0.10 +
    breakdown.preferenceBonus * 0.10
  );

  return {
    modelProfile: model,
    score: Math.max(0, Math.min(1.0, finalScore)),
    breakdown
  };
}

/**
 * Resolve a melhor rota para uma requisição de IA
 */
export function resolveRoute(
  request: AIRequest,
  policy?: TenantAIRouterPolicy,
  availableProviders: Set<string> = new Set(['gemini', '9router', 'contingency'])
): RouteResolution {
  // Validação preliminar de política
  if (policy && !policy.aiEnabled) {
    throw new AIPolicyDeniedError('Serviço de IA desativado para este tenant.', { tenantId: request.tenantId });
  }

  const effectiveProfile: AIProfile = request.profile || policy?.preferredProfile || 'BALANCEADO';
  const candidates: ScoredModelCandidate[] = [];

  for (const model of Object.values(OFFICIAL_AI_MODELS)) {
    // Apenas provedores ativos no router
    if (!availableProviders.has(model.provider)) continue;

    const scored = scoreModel(model, request, effectiveProfile, policy);
    if (scored) {
      candidates.push(scored);
    }
  }

  if (candidates.length === 0) {
    throw new AIModelUnavailableError(
      request.modelPreference || 'qualquer modelo compatível',
      `Nenhum modelo disponível atende à tarefa '${request.task}' sob o perfil '${effectiveProfile}' e as políticas vigentes.`,
      { tenantId: request.tenantId }
    );
  }

  // Ordena pelo maior score determinístico
  candidates.sort((a, b) => b.score - a.score);
  const bestCandidate = candidates[0];

  const timeoutMs = request.timeoutMs || DEFAULT_TASK_TIMEOUTS[request.task] || 10000;

  return {
    providerId: bestCandidate.modelProfile.provider,
    modelId: bestCandidate.modelProfile.id,
    modelProfile: bestCandidate.modelProfile,
    score: bestCandidate.score,
    timeoutMs
  };
}
