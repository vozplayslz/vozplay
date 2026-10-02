/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE & REALTIME CONTRACTS (PROMPT 09)
 * Tipagens canônicas da camada de voz da MaIA, abstração de Gemini Live,
 * sessões de streaming bidirecional, interrupções (barge-in), cascata de fallback e métricas.
 */

import { MaiaToolRiskLevel } from '../types.js';

// ============================================================================
// 1. ESTADOS E CANAIS DE SESSÃO DE VOZ (Seções 8 e 29)
// ============================================================================

export type VoiceSessionStatus = 
  | 'CONNECTING'
  | 'CONNECTED'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'PAUSED'
  | 'ENDING'
  | 'ENDED'
  | 'ERROR';

export type VoiceChannel = 
  | 'web' 
  | 'mobile' 
  | 'pwa' 
  | 'tv' 
  | 'controller' 
  | 'supervisor' 
  | 'webrtc';

export type AudioFormat = 
  | 'pcm_16000' 
  | 'pcm_24000' 
  | 'wav' 
  | 'opus' 
  | 'mp3';

// ============================================================================
// 2. CHUNKS DE ÁUDIO E CAPACIDADES DO PROVEDOR (Seções 3, 9, 15, 16)
// ============================================================================

export interface VoiceAudioChunk {
  /** Dados binários do áudio (Buffer, Uint8Array ou string base64) */
  data: Buffer | Uint8Array | string;
  /** Formato de codificação do áudio */
  format: AudioFormat;
  /** Taxa de amostragem em Hz (padrão 16000 ou 24000) */
  sampleRate: number;
  /** Número de canais (1 para mono, 2 para estéreo) */
  channels: number;
  /** Se este chunk encerra o turno atual de fala */
  isFinal?: boolean;
  /** Timestamp de geração do chunk (ms) */
  timestamp: number;
}

export interface VoiceCapabilities {
  /** Suporte a interrupção / barge-in pelo usuário */
  supportsBargeIn: boolean;
  /** Suporte a streaming contínuo de entrada de áudio */
  supportsStreamingInput: boolean;
  /** Suporte a streaming de saída de áudio */
  supportsStreamingOutput: boolean;
  /** Suporte a detecção de turnos (VAD integrado) */
  supportsTurnDetection: boolean;
  /** Suporte a chamadas de ferramentas diretamente pelo modelo */
  supportsTools: boolean;
  /** Formatos de áudio de entrada aceitos */
  supportedInputFormats: AudioFormat[];
  /** Formatos de áudio de saída suportados */
  supportedOutputFormats: AudioFormat[];
  /** Se o provedor é realtime nativo ou baseado em cascata (STT -> LLM -> TTS) */
  nativeRealtime: boolean;
}

// ============================================================================
// 3. CONFIGURAÇÃO E DADOS DA SESSÃO DE VOZ (Seção 8)
// ============================================================================

export interface VoiceSessionConfig {
  sessionId?: string;
  tenantId: string;
  userId?: string;
  actorRole: string;
  channel: VoiceChannel;
  profile?: 'ECONOMICO' | 'BALANCEADO' | 'ALTA_CAPACIDADE';
  language?: string; // Padrão 'pt-BR'
  voiceId?: string;  // Padrão 'Aoede'
  allowBargeIn?: boolean; // Padrão true
  systemInstruction?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface VoiceSessionMetrics {
  audioInputLatencyMs: number;
  speechDetectionLatencyMs: number;
  providerLatencyMs: number;
  firstAudioResponseLatencyMs: number;
  totalResponseLatencyMs: number;
  interruptionLatencyMs: number;
  sessionDurationMs: number;
  audioInputSeconds: number;
  audioOutputSeconds: number;
  tokensUsed: number;
  estimatedCostUsd: number;
}

export interface VoiceSession {
  id: string;
  tenantId: string;
  userId?: string;
  actorRole: string;
  channel: VoiceChannel;
  status: VoiceSessionStatus;
  providerId: string;
  modelId: string;
  profile: 'ECONOMICO' | 'BALANCEADO' | 'ALTA_CAPACIDADE';
  startedAt: string;
  endedAt?: string;
  correlationId: string;
  capabilities: VoiceCapabilities;
  metrics: VoiceSessionMetrics;
  interruptedCount: number;
  turnCount: number;
  language: string;
  voiceId: string;
  lastActivityAt: number;
}

// ============================================================================
// 4. INTERFACES DE PROVEDORES E SESSÕES DE VOZ (Seção 3)
// ============================================================================

export interface VoiceEventCallbacks {
  onAudio?: (chunk: VoiceAudioChunk) => void;
  onText?: (text: string, isFinal: boolean) => void;
  onStatus?: (status: VoiceSessionStatus) => void;
  onInterrupted?: () => void;
  onError?: (err: Error) => void;
}

export interface IVoiceSessionHandler {
  readonly session: VoiceSession;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendAudio(chunk: VoiceAudioChunk): Promise<void>;
  sendText(text: string): Promise<void>;
  interrupt(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  setCallbacks(callbacks: VoiceEventCallbacks): void;
}

export interface IVoiceProvider {
  readonly id: string;
  readonly name: string;
  getCapabilities(): Promise<VoiceCapabilities>;
  createSession(config: VoiceSessionConfig): Promise<IVoiceSessionHandler>;
  synthesizeSpeech?(text: string, voiceId?: string, options?: any): Promise<{
    audioBase64: string;
    mimeType: string;
    durationEstimateSec?: number;
    latencyMs: number;
  }>;
  transcribeAudio?(audio: Buffer | string, mimeType?: string): Promise<{
    text: string;
    confidence: number;
    latencyMs: number;
  }>;
  checkHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}

// ============================================================================
// 5. INTENÇÕES E AÇÕES EXTRAÍDAS POR VOZ (Seções 14, 19, 31)
// ============================================================================

export interface VoiceIntentResult {
  rawTranscript: string;
  sanitizedText: string;
  intent: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  requiresConfirmation: boolean;
  riskLevel: MaiaToolRiskLevel;
  confidence: number;
  directAnswer?: string;
  taskId?: string;
}

// ============================================================================
// 6. TELEMETRIA GLOBAL DE VOZ (Seção 25)
// ============================================================================

export interface VoiceTelemetryMetrics {
  voiceSessionsTotal: number;
  voiceSessionsActive: number;
  voiceSessionsFailed: number;
  voiceInterruptionCount: number;
  voiceFallbackCount: number;
  voiceTotalAudioSeconds: number;
  voiceFirstResponseLatencyMs: number;
  voiceAverageDurationMs: number;
  voiceByProvider: Record<string, number>;
  voiceByChannel: Record<string, number>;
}
