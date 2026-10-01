/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI MODELS CATALOG (PROMPT 07)
 * Catálogo central de modelos de IA com especificações de capacidades, limites de contexto e custos.
 * Segue estritamente as diretrizes oficiais de modelos do ecossistema Google Gemini e gateways integrados.
 */

import { AIModelProfile, AITask, AIProfile } from './types.js';

export const OFFICIAL_AI_MODELS: Record<string, AIModelProfile> = {
  // 1. Gemini 3.8 Flash (Modelo de trabalho principal: rápido, econômico e de alta capacidade)
  'gemini-3.8-flash': {
    id: 'gemini-3.8-flash',
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    capabilities: [
      'conversation',
      'classification',
      'summarization',
      'extraction',
      'planning',
      'tool_selection',
      'memory_summarization',
      'translation'
    ],
    contextWindow: 1048576, // 1M tokens
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    costInput: 0.15,  // $0.15 por 1M tokens
    costOutput: 0.60, // $0.60 por 1M tokens
    latencyClass: 'LOW',
    enabled: true
  },

  // 2. Gemini 3.1 Pro (Modelo de alta capacidade e raciocínio profundo)
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    provider: 'gemini',
    model: 'gemini-3.1-pro-preview',
    capabilities: [
      'conversation',
      'reasoning',
      'planning',
      'extraction',
      'tool_selection',
      'translation'
    ],
    contextWindow: 2097152, // 2M tokens
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    costInput: 1.25,  // $1.25 por 1M tokens
    costOutput: 5.00, // $5.00 por 1M tokens
    latencyClass: 'MEDIUM',
    enabled: true
  },

  // 3. Gemini 3.8 Flash Lite TTS (Síntese de fala ultrarrápida e natural)
  'gemini-3.8-flash-lite-tts': {
    id: 'gemini-3.8-flash-lite-tts',
    provider: 'gemini',
    model: 'gemini-3.8-flash-lite-tts',
    capabilities: [
      'tts'
    ],
    contextWindow: 32768,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costInput: 0.20,
    costOutput: 0.80,
    latencyClass: 'LOW',
    enabled: true
  },

  // 4. Gemini 3.5 Transcribe (Transcrição de áudio)
  'gemini-3.5-transcribe': {
    id: 'gemini-3.5-transcribe',
    provider: 'gemini',
    model: 'gemini-3.5-transcribe',
    capabilities: [
      'transcription'
    ],
    contextWindow: 131072,
    supportsStreaming: true,
    supportsTools: false,
    supportsVision: false,
    costInput: 0.50,
    costOutput: 1.00,
    latencyClass: 'LOW',
    enabled: true
  },

  // 5. Gemini 3.8 Live (Voz bidirecional em tempo real — preparado para fase futura)
  'gemini-3.8-live': {
    id: 'gemini-3.8-live',
    provider: 'gemini',
    model: 'gemini-3.8-live',
    capabilities: [
      'realtime_voice'
    ],
    contextWindow: 131072,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    costInput: 1.00,
    costOutput: 3.00,
    latencyClass: 'LOW',
    enabled: true
  },

  // 6. 9router Proxy - Flash (Gateway corporativo para Flash)
  '9router/gemini-3.8-flash': {
    id: '9router/gemini-3.8-flash',
    provider: '9router',
    model: 'gemini-3.8-flash',
    capabilities: [
      'conversation',
      'classification',
      'summarization',
      'extraction',
      'planning',
      'tool_selection',
      'memory_summarization'
    ],
    contextWindow: 1048576,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costInput: 0.15,
    costOutput: 0.60,
    latencyClass: 'LOW',
    enabled: true
  },

  // 7. 9router Proxy - Pro (Gateway corporativo para Pro)
  '9router/gemini-3.1-pro-preview': {
    id: '9router/gemini-3.1-pro-preview',
    provider: '9router',
    model: 'gemini-3.1-pro-preview',
    capabilities: [
      'conversation',
      'reasoning',
      'planning'
    ],
    contextWindow: 2097152,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    costInput: 1.25,
    costOutput: 5.00,
    latencyClass: 'MEDIUM',
    enabled: true
  },

  // 8. Contingência Local Determinística (Resiliência offline / fallback extremo)
  'contingency-local': {
    id: 'contingency-local',
    provider: 'contingency',
    model: 'contingency-local',
    capabilities: [
      'conversation',
      'classification',
      'summarization',
      'extraction',
      'memory_summarization',
      'tool_selection'
    ],
    contextWindow: 16384,
    supportsStreaming: false,
    supportsTools: true,
    supportsVision: false,
    costInput: 0.00,
    costOutput: 0.00,
    latencyClass: 'LOW',
    enabled: true
  }
};

/**
 * Obtém o perfil de um modelo pelo identificador
 */
export function getModelProfile(modelId: string): AIModelProfile | undefined {
  return OFFICIAL_AI_MODELS[modelId];
}

/**
 * Lista modelos habilitados compatíveis com uma tarefa específica
 */
export function listModelsForTask(task: AITask): AIModelProfile[] {
  return Object.values(OFFICIAL_AI_MODELS).filter(m => m.enabled && m.capabilities.includes(task));
}

/**
 * Calcula o custo estimado de inferência em USD
 */
export function calculateTokenCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const profile = OFFICIAL_AI_MODELS[modelId];
  if (!profile) return 0;
  const inputCost = (inputTokens / 1000000) * profile.costInput;
  const outputCost = (outputTokens / 1000000) * profile.costOutput;
  return Number((inputCost + outputCost).toFixed(6));
}
