/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Core Types & DTOs
 * Plataforma de Karaokê para Estabelecimentos
 * Dominio: vozplay.ai.slz.br
 */

export type Role = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'SYSTEM_ADMIN';
export type ActiveTab = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV' | 'TRACKER';
export type ClientType = 'PWA' | 'ANDROID' | 'ANDROID_TV';
export type SessionStatus = 'CREATED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'EXPIRED';
export type PlaybackStatus = 'IDLE' | 'LOADING' | 'CALLING_PARTICIPANT' | 'PLAYING' | 'PAUSED' | 'ERROR' | 'COMPLETED';

export type QueueItemStatus = 
  | 'QUEUED'
  | 'CALLED'
  | 'PLAYING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELLED_SESSION_ENDED'
  | 'ERROR';

export type MusicVersionStyle = 
  | 'karaoke'
  | 'playback'
  | 'acustico'
  | 'original'
  | 'instrumental'
  | 'cover'
  | 'live'
  | 'remix'
  | 'Estilo não identificado';

export interface MusicVersion {
  id: string;
  musicId: string;
  style: MusicVersionStyle;
  label: string;
  youtubeVideoId: string;
  durationSec: number;
  quality?: string;
  audioKey?: string;
}

export interface Music {
  id: string;
  title: string;
  artist: string;
  genre: string;
  coverUrl?: string;
  versions: MusicVersion[];
}

export interface WishlistItem {
  id: string;
  participantId: string;
  musicId: string;
  musicTitle: string;
  musicArtist: string;
  genre: string;
  coverUrl?: string;
  preferredVersionId?: string;
  preferredVersionStyle?: MusicVersionStyle;
  preferredToneOffset?: number; // -3 to +3 semitones (0 is default original)
  notes?: string;
  addedAt: string;
}

export interface PlaylistItem {
  id: string;
  participantId: string;
  musicId: string;
  versionId: string;
  musicTitle: string;
  musicArtist: string;
  versionStyle: MusicVersionStyle;
  youtubeVideoId: string;
  toneOffset?: number; // -3 to +3 semitones (0 is default original)
  status: 'DRAFT' | 'QUEUED' | 'SUNG' | 'CANCELLED';
  createdAt: string;
}

export interface QueueItem {
  id: string;
  sessionId: string;
  participantId: string;
  participantDisplayName: string;
  partnerParticipantId?: string;
  partnerDisplayName?: string;
  isDuet?: boolean;
  musicId: string;
  musicTitle: string;
  musicArtist: string;
  versionId: string;
  versionStyle: MusicVersionStyle;
  youtubeVideoId: string;
  toneOffset?: number; // -3 to +3 semitones
  status: QueueItemStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  calledAt?: string;
  callExpiresAt?: string;
  missedTurnCount?: number; // 0, 1 (primeira perda), 2 (segunda perda)
  errorMessage?: string;
  orderIndex: number;
}

export interface CallingParticipantState {
  queueItemId: string;
  participantId: string;
  participantDisplayName: string;
  partnerParticipantId?: string;
  partnerDisplayName?: string;
  isDuet?: boolean;
  musicId: string;
  musicTitle: string;
  musicArtist: string;
  versionId: string;
  versionStyle: MusicVersionStyle;
  youtubeVideoId: string;
  toneOffset?: number;
  calledAt: string;
  expiresAt: string;
  remainingSeconds: number;
  missedTurnCount: number;
}

export interface SongLyricLine {
  timeSec?: number;
  text: string;
  section?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
}

export interface SongLyrics {
  musicId: string;
  title: string;
  artist: string;
  hasLyrics: boolean;
  source?: string;
  lines: SongLyricLine[];
}

export type DuetInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface DuetInvitation {
  id: string;
  sessionId: string;
  senderParticipantId: string;
  senderDisplayName: string;
  targetParticipantId: string;
  targetDisplayName: string;
  musicId: string;
  musicTitle: string;
  musicArtist: string;
  versionId: string;
  versionStyle: MusicVersionStyle;
  toneOffset: number;
  status: DuetInvitationStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export interface Session {
  id: string;
  establishmentId: string;
  establishmentName: string;
  name: string;
  code: string;
  status: SessionStatus;
  startedAt: string;
  scheduledEndTime?: string;
  endedAt?: string;
  activeControllerId?: string;
  activeControllerName?: string;
  supervisorId: string;
  supervisorName: string;
  createdAt: string;
  branding?: EstablishmentBrandingDTO;
}

export type ThemeMode = 'DARK' | 'LIGHT' | 'AUTO';

export interface EstablishmentBranding {
  id: string;
  establishmentId: string;
  logoUrl?: string;
  businessName: string;
  slogan?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  themeMode: ThemeMode;
  tvTheme: ThemeMode;
  participantTheme: ThemeMode;
  controllerTheme: ThemeMode;
  updatedAt: string;
}

export type EstablishmentBrandingDTO = Omit<EstablishmentBranding, 'id'>;

export interface PresenceCode {
  code: string;
  sessionId: string;
  controllerId: string;
  createdAt: string;
  expiresAt: string;
  remainingSeconds: number;
}

export interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  whatsapp?: string;
  isVerified: boolean;
  verifiedAt?: string;
  identityId?: string;
  joinedAt: string;
}

export interface ParticipantIdentity {
  id: string;
  normalizedWhatsapp: string;
  displayName: string;
  consentMarketing: boolean;
  consentTimestamp?: string;
  totalParticipations: number;
  firstSeen: string;
  lastSeen: string;
}

export interface TVSessionDTO {
  sessionId: string;
  establishmentName: string;
  sessionName: string;
  status: SessionStatus;
  currentSong: {
    id: string;
    title: string;
    artist: string;
    versionStyle: MusicVersionStyle;
    youtubeVideoId: string;
    participantDisplayName: string;
    partnerDisplayName?: string;
    isDuet?: boolean;
    toneOffset?: number;
  } | null;
  queue: Array<{
    id: string;
    title: string;
    artist: string;
    versionStyle: MusicVersionStyle;
    participantDisplayName: string;
    partnerDisplayName?: string;
    isDuet?: boolean;
    toneOffset?: number;
  }>;
  playbackState: PlaybackStatus;
  sessionAlert: {
    message: string;
    type: 'info' | 'warning' | 'error';
    timestamp: string;
  } | null;
  volume?: number;
  isMuted?: boolean;
  scheduledEndTime?: string;
  qrCodeUrl: string;
  callingState?: CallingParticipantState | null;
  branding?: EstablishmentBrandingDTO;
}

export interface Lead {
  id: string;
  name: string;
  normalizedWhatsapp: string;
  establishmentId: string;
  firstParticipation: string;
  lastParticipation: string;
  participationsCount: number;
  consentMarketing: boolean;
  consentDate?: string;
  origin: 'PARTICIPANTE' | 'CONTROLADOR_SESSAO';
}

export interface SessionMetrics {
  totalParticipants: number;
  totalSongsSearched: number;
  totalSongsQueued: number;
  totalSongsPlayed: number;
  totalCancellations: number;
  totalSkips: number;
  playbackErrors: number;
  averageQueueWaitMinutes: number;
}

export interface SessionNotification {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  sessionId: string;
  actorRole: Role;
  actorName: string;
  action: string;
  details: string;
  timestamp: string;
}

// WebSocket Event Types
export type WSEventType =
  | 'session.started'
  | 'session.updated'
  | 'session.ended'
  | 'session.alert'
  | 'participant.joined'
  | 'participant.verified'
  | 'queue.added'
  | 'queue.updated'
  | 'queue.cancelled'
  | 'queue.playing'
  | 'queue.completed'
  | 'player.play'
  | 'player.pause'
  | 'player.next'
  | 'player.skip'
  | 'player.error'
  | 'player.state_changed'
  | 'player.volume'
  | 'controller.assigned'
  | 'controller.changed'
  | 'controller.revoked'
  | 'presence.renewed'
  | 'tv.connected'
  | 'tv.disconnected'
  | 'duet.invitation_received'
  | 'duet.accepted'
  | 'duet.declined'
  | 'duet.cancelled'
  | 'participant.turn_called'
  | 'participant.turn_started'
  | 'participant.turn_missed'
  | 'participant.turn_missed_again'
  | 'queue.item_requeued'
  | 'participant.turn_finished'
  | 'reaction.sent'
  | 'soundboard.play'
  | 'branding.updated'
  | 'state.sync'
  | 'maia.voice.started'
  | 'maia.voice.completed'
  | 'maia.voice.failed';

export interface WSMessage<T = unknown> {
  event: WSEventType;
  sessionId: string;
  payload: T;
  timestamp: string;
}

// ==========================================
// GEMINI AI - RECOMENDAÇÕES DE PLAYLIST
// ==========================================
export interface RecommendedTrack {
  title: string;
  artist: string;
  suggestedToneOffset: number; // -3 to +3 semitons
  karaokeTip: string;
  energyLevel: 'Baixa' | 'Média' | 'Alta' | 'Explosiva';
  difficulty: 'Fácil' | 'Médio' | 'Desafiador';
  catalogMusicId?: string | null;
  hasMatchInCatalog?: boolean;
}

export interface RecommendedPlaylist {
  genre: string;
  playlistTitle: string;
  description: string;
  vibeTag: string;
  curatorNote?: string;
  tracks: RecommendedTrack[];
  source: 'gemini' | 'catalog_fallback';
  generatedAt?: string;
}

// ==========================================
// MAIA NATIVE AI - TYPES & CONFIGURATION
// ==========================================
export type MaIACostTier = 'ECONOMICO' | 'BALANCEADO' | 'ALTA_CAPACIDADE' | 'VOZ' | 'PERSONALIZADO';

export interface MaIAModelMapping {
  CHAT: string;
  LIVE_VOICE: string;
  REASONING: string;
  TTS: string;
  TRANSCRIPTION: string;
  MUSIC_ASSISTANCE: string;
}

export interface VoiceConfig {
  voice_provider: string;
  voice_id: string;
  language: string;
  persona: string;
  speed: number;
  style: string;
  fallback_voice: string;
}

export type MaIAProviderType = 
  | 'gemini_enlace'
  | 'gemini_customer'
  | '9router'
  | 'custom_gateway'
  | 'gemini';

export interface MaIAConfig {
  establishment_id: string;
  enabled: boolean;
  active_provider: MaIAProviderType;
  gateway_url?: string;
  cost_tier: MaIACostTier;
  models: MaIAModelMapping;
  voice: VoiceConfig;
  limits: {
    daily_limit_usd: number;
    monthly_limit_usd: number;
    max_live_session_duration_minutes: number;
    max_tts_requests_per_day: number;
    max_requests_per_minute: number;
  };
  announce_queue_calls: boolean;
  announce_absences: boolean;
  announce_duets: boolean;
  tv_audio_enabled: boolean;
}

export type CredentialStatus = 'ACTIVE' | 'VALIDATED' | 'PENDING_KEY' | 'INVALID' | 'DISABLED';

export interface AICredential {
  id: string;
  tenant_id: string;
  establishment_id: string;
  provider: MaIAProviderType;
  credential_type: 'API_KEY' | 'SERVICE_ACCOUNT' | 'BEARER_TOKEN';
  project_id: string;
  display_name: string;
  status: CredentialStatus;
  allowed_tasks: string[];
  allowed_models: string[];
  priority: number;
  created_at: string;
  updated_at: string;
  last_validated_at?: string;
  masked_key?: string;
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

export interface FallbackEvent {
  id: string;
  tenant_id: string;
  establishment_id: string;
  provider_from: string;
  provider_to: string;
  reason: string;
  model: string;
  task: string;
  timestamp: string;
  result: 'SUCCESS' | 'FAILED';
}

export interface AIAuditEvent {
  id: string;
  actor: string;
  tenant_id: string;
  establishment_id: string;
  event_type: string;
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
    capabilities: string[];
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
    billing_owner: string;
    currency: string;
  };
  fallback_policy: {
    enabled: boolean;
    chain: MaIAProviderType[];
    last_fallback?: FallbackEvent;
  };
  limits: {
    daily_usd: number;
    monthly_usd: number;
    max_rpm: number;
    max_rpd: number;
    warning_threshold: number;
    critical_threshold: number;
    exhausted_threshold: number;
  };
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

