/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE TYPES — AI ORCHESTRATION, QUOTAS, CREDENTIALS & FALLBACK
 * Tipagens completas para Router, Provedores, Quotas, Credenciais, Fallback, Auditoria e Métricas.
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

export type MaIAProviderType = 
  | 'gemini_enlace'
  | 'gemini_customer'
  | '9router'
  | 'custom_gateway'
  | 'gemini'; // Alias para gemini_enlace

export interface VoiceConfig {
  voice_provider: string; // 'gemini'
  voice_id: string; // 'Aoede' | 'Kore' | 'Puck'
  language: string; // 'pt-BR'
  persona: string; // 'MaIA — Mestre de Cerimônias do VozPlay'
  speed: number; // 0.8 a 1.2
  style: string; // 'animada' | 'acolhedora_profissional' | 'cerimoniosa'
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
  warning_threshold_percent?: number;
  critical_threshold_percent?: number;
  exhausted_threshold_percent?: number;
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
  byProvider?: Record<string, number>;
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
  fallback_enabled?: boolean;
  fallback_chain?: MaIAProviderType[];
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
  capabilities: MaIATaskType[];
  generateText: (prompt: string, options?: { systemInstruction?: string; model?: string; maxTokens?: number }) => Promise<string>;
  generateSpeech: (request: TTSRequest, options?: { model?: string }) => Promise<TTSResponse>;
  generateLiveConfig?: (options?: any) => Promise<any>;
  isAvailable: () => boolean;
  testConnection?: (options?: any) => Promise<ValidationResult>;
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

// ==========================================
// AI CREDENTIALS & CUSTOM PROJECTS
// ==========================================

export type CredentialStatus = 'ACTIVE' | 'VALIDATED' | 'PENDING_KEY' | 'INVALID' | 'DISABLED';

export interface AICredential {
  id: string;
  tenant_id: string;
  establishment_id: string;
  provider: MaIAProviderType;
  credential_type: 'API_KEY' | 'SERVICE_ACCOUNT' | 'BEARER_TOKEN';
  secret_reference: string; // Hash seguro ou chave cifrada
  project_id: string; // Ex: 'karaoke-music-slz' ou 'enlace-default'
  display_name: string; // Ex: 'Meu projeto Gemini - Karaokê Music SLZ'
  status: CredentialStatus;
  allowed_tasks: MaIATaskType[];
  allowed_models: string[];
  priority: number;
  created_at: string;
  updated_at: string;
  last_validated_at?: string;
  masked_key?: string; // Ex: 'AIzaSy...****'
  error_message?: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  provider: string;
  projectId?: string;
  checks: ValidationCheck[];
  error?: string;
}

// ==========================================
// QUOTAS, USAGE TRACKER & SEMAPHORE
// ==========================================

export type QuotaSource = 'DETECTED' | 'PROVIDER_REPORTED' | 'MANUAL' | 'ESTIMATED' | 'UNKNOWN';
export type QuotaStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED' | 'UNKNOWN';

export interface QuotaMetricDetail {
  limit: number;
  used: number;
  source: QuotaSource;
  unit: string;
  status: QuotaStatus;
  percentage: number;
}

export interface ProviderQuotaReport {
  provider: MaIAProviderType;
  projectId?: string;
  displayName: string;
  status: QuotaStatus;
  overallPercentage: number;
  rpm: QuotaMetricDetail;
  tpm: QuotaMetricDetail;
  rpd: QuotaMetricDetail;
  concurrency: QuotaMetricDetail;
  lastCheckedAt: string;
  warningAlert?: string;
}

export interface InternalQuotaLimits {
  daily_usd: number;
  monthly_usd: number;
  max_rpm: number;
  max_rpd: number;
  warning_threshold: number; // 70%
  critical_threshold: number; // 85%
  exhausted_threshold: number; // 95%
}

// ==========================================
// FALLBACK & OBSERVABILITY
// ==========================================

export interface FallbackConfig {
  enabled: boolean;
  provider_chain: MaIAProviderType[];
}

export interface FallbackEvent {
  id: string;
  tenant_id: string;
  establishment_id: string;
  provider_from: string;
  provider_to: string;
  reason: string;
  model: string;
  task: MaIATaskType;
  timestamp: string;
  result: 'SUCCESS' | 'FAILED';
}

export type AIAuditEventType = 
  | 'AI_PROVIDER_CONNECTED'
  | 'AI_PROVIDER_VALIDATED'
  | 'AI_PROVIDER_ACTIVATED'
  | 'AI_PROVIDER_DISABLED'
  | 'AI_PROVIDER_SWITCH'
  | 'AI_QUOTA_WARNING'
  | 'AI_QUOTA_CRITICAL'
  | 'AI_QUOTA_EXHAUSTED'
  | 'AI_FALLBACK'
  | 'AI_CREDENTIAL_ROTATED'
  | 'AI_CREDENTIAL_REVOKED';

export interface AIAuditEvent {
  id: string;
  actor: string;
  tenant_id: string;
  establishment_id: string;
  event_type: AIAuditEventType;
  provider: string;
  model?: string;
  reason?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface MaIADashboardDTO {
  active_provider: {
    type: MaIAProviderType;
    display_name: string;
    project_id: string;
    status: 'ACTIVE' | 'FALLBACK_ACTIVE' | 'DISABLED';
    is_customer_project: boolean;
  };
  providers: Array<{
    type: MaIAProviderType;
    display_name: string;
    project_id: string;
    status: CredentialStatus;
    is_active: boolean;
    has_credentials: boolean;
    masked_key: string;
    capabilities: MaIATaskType[];
    quota_status: QuotaStatus;
    quota_percentage: number;
  }>;
  quota_semaphore: {
    status: QuotaStatus;
    percentage: number;
    source: QuotaSource;
    alert_message?: string;
  };
  quotas: ProviderQuotaReport;
  usage: {
    requests_today: number;
    tokens_input_today: number;
    tokens_output_today: number;
    average_latency_ms: number;
    errors_today: number;
    rate_limits_429_today: number;
    fallbacks_today: number;
  };
  costs: {
    estimated_usd_today: number;
    estimated_usd_month: number;
    billing_owner: string; // 'Enlace' ou nome do projeto do cliente
    currency: string;
  };
  fallback_policy: {
    enabled: boolean;
    chain: MaIAProviderType[];
    last_fallback?: FallbackEvent;
  };
  limits: InternalQuotaLimits;
}
