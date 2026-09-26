/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE TYPES — VOZPLAY NATIVE AI
 * Tipagens completas para Router, Providers, Voice, TTS, Tools, Config e Métricas.
 */

export type MaIATaskType = 
  | 'CHAT'
  | 'LIVE_VOICE'
  | 'REASONING'
  | 'TTS'
  | 'TRANSCRIPTION'
  | 'MUSIC_ASSISTANCE';

export type MaIACostTier = 
  | 'ECONOMICO'
  | 'BALANCEADO'
  | 'ALTA_CAPACIDADE'
  | 'VOZ'
  | 'PERSONALIZADO';

export type MaIAProviderType = 'gemini' | '9router' | 'custom_gateway';

export interface VoiceConfig {
  voice_provider: string; // 'gemini'
  voice_id: string; // 'Aoede' | 'Kore' | 'Puck'
  language: string; // 'pt-BR'
  persona: string; // 'MaIA - Mestre de Cerimônias e Assistente Vocal VozPlay'
  speed: number; // 0.8 a 1.2
  style: string; // 'acolhedora_profissional' | 'animada' | 'cerimoniosa'
  fallback_voice: string; // 'pt-BR-Standard-A'
}

export interface MaIAModelMapping {
  CHAT: string;
  LIVE_VOICE: string;
  REASONING: string;
  TTS: string;
  TRANSCRIPTION: string;
  MUSIC_ASSISTANCE: string;
}

export interface MaIALimits {
  daily_limit_usd: number;
  monthly_limit_usd: number;
  max_live_session_duration_minutes: number;
  max_tts_requests_per_day: number;
  max_requests_per_minute: number;
}

export interface MaIAUsageMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  fallbackCalls: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  ttsCalls: number;
  ttsLatencyMs: number;
  liveSessionsCount: number;
  estimatedCostUsd: number;
  tokensInput: number;
  tokensOutput: number;
  lastUsedAt: string;
  byModel: Record<string, number>;
  byTask: Record<string, number>;
}

export interface MaIAConfig {
  establishment_id: string;
  enabled: boolean;
  active_provider: MaIAProviderType;
  gateway_url?: string;
  cost_tier: MaIACostTier;
  models: MaIAModelMapping;
  voice: VoiceConfig;
  limits: MaIALimits;
  announce_queue_calls: boolean;
  announce_absences: boolean;
  announce_duets: boolean;
  tv_audio_enabled: boolean;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  style?: string;
  speechMetadata?: {
    speaker?: string;
    style?: string;
  };
}

export interface TTSResponse {
  audioBase64: string | null;
  mimeType: string;
  sampleRate: number;
  durationEstimateSec: number;
  fallbackUsed: boolean;
  textualFallback: string;
  provider: string;
  model: string;
  latencyMs: number;
}

export type MaIAActorRole = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'SYSTEM' | 'TV' | 'SYSTEM_ADMIN';

export interface MaIAToolContext {
  establishmentId: string;
  sessionId: string;
  actorRole: MaIAActorRole;
  actorName: string;
  actorId?: string;
}

export interface MaIAToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (context: MaIAToolContext, params: any) => Promise<any>;
}

export interface AIProvider {
  name: string;
  generateText: (prompt: string, options?: { systemInstruction?: string; model?: string; maxTokens?: number }) => Promise<string>;
  generateSpeech: (request: TTSRequest, options?: { model?: string }) => Promise<TTSResponse>;
  generateLiveConfig?: (options?: any) => Promise<any>;
  isAvailable: () => boolean;
}

export interface QueueCallVoicePayload {
  queueItemId: string;
  participantDisplayName: string;
  partnerDisplayName?: string;
  isDuet?: boolean;
  musicTitle: string;
  musicArtist: string;
  speechText: string;
  visualText: string;
  audioBase64: string | null;
  mimeType: string;
  callType: 'INITIAL' | 'FIRST_ABSENCE' | 'SECOND_ABSENCE';
  timestamp: string;
}
