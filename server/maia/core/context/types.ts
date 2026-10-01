/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ADVANCED CONTEXT ENGINE TYPES (PROMPT 03)
 * Tipagens completas para os 11 tipos de contexto, classificação de dados,
 * níveis de confiança, perfis, métricas, fontes e snapshots imutáveis.
 */

// ============================================================================
// 1. CLASSIFICAÇÃO DE SEGURANÇA E NÍVEL DE CONFIANÇA
// ============================================================================

export type ContextDataClassification = 
  | 'PUBLIC'       // Visível publicamente (ex: nome do produto, música no telão)
  | 'INTERNAL'     // Operacional do sistema (ex: status da sessão, ID do tenant)
  | 'SENSITIVE'    // Dados operacionais protegidos (ex: posição pessoal na fila)
  | 'RESTRICTED'   // Dados sob restrição estrita / PII (ex: telefones autorizados)
  | 'SECRET';      // Segredos, senhas, tokens, hashes -> JAMAIS entram no snapshot

export type ContextTrustLevel = 
  | 'TRUSTED'      // Dados validados pelo backend (sessão, tokens, RBAC, banco)
  | 'UNTRUSTED';   // Entradas do usuário, mensagens, nomes de música, textos externos

export interface UntrustedText {
  value: string;
  trust: 'UNTRUSTED';
  sanitized: boolean;
}

// ============================================================================
// 2. PRIORIDADES E PERFIS DE CONTEXTO
// ============================================================================

export type ContextPriorityLevel = 
  | 'P0_IDENTITY_SECURITY' // Identidade central e diretrizes de segurança
  | 'P1_USER_SESSION'      // Ator autenticado, tenant e sessão ativa
  | 'P2_OPERATIONAL_STATE' // Estado da fila, reprodução e mesa
  | 'P3_CONVERSATION'      // Histórico recente da conversa
  | 'P4_RECENT_EVENTS'     // Eventos de sistema recentes (com TTL)
  | 'P5_COMPLEMENTARY';    // Sugestões, metadados e dicas

export type ContextProfileType = 
  | 'participant'
  | 'operator'
  | 'supervisor'
  | 'admin'
  | 'tv'
  | 'voice';

export interface ContextProfileConfig {
  profile: ContextProfileType;
  maxRecentMessages: number;
  maxRecentEvents: number;
  eventTtlSeconds: number;
  includeQueueDetails: boolean;
  includeSessionMetrics: boolean;
  includeVoiceHints: boolean;
  defaultChannel: ContextChannel;
  responseGuideline: string;
}

// ============================================================================
// 3. OS 11 TIPOS EXPLÍCITOS DE CONTEXTO
// ============================================================================

/** 1. Identity Context */
export interface IdentityContext {
  assistantName: 'MaIA';
  specialization: string; // ex: 'karaoke'
  productName: string;   // ex: 'MaIA Karaokê'
  persona: string;       // ex: 'karaoke-host'
  language: 'pt-BR';
  version: string;
  corePrinciplesSummary: readonly string[];
}

/** 2. User Context (Mínimo necessário, zero PII vazada) */
export interface UserContext {
  userId: string;
  displayName: string;
  isDisplayNameUntrusted: boolean;
  authenticated: boolean;
  authSource: 'BEARER_TOKEN' | 'SESSION_COOKIE' | 'ANONYMOUS';
  channel: ContextChannel;
  interface: ContextInterface;
}

/** 3. Role Context (Derivado estritamente de autenticação, nunca de texto de usuário) */
export interface RoleContext {
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'SYSTEM_ADMIN' | 'TV' | 'ANONYMOUS';
  roleSource: 'AUTHENTICATED_CREDENTIAL' | 'SYSTEM_DEFAULT';
  isPrivileged: boolean;
}

/** 4. Product & Domain Context (Sem regras de negócio no Context Engine) */
export interface DomainContext {
  domain: 'karaoke' | string;
  product: string;
  activeLoungeName?: string;
  queueSummary?: {
    totalItems: number;
    queuedCount: number;
    estimatedWaitTimeMinutes?: number;
    currentSingerName?: string;
    currentSongTitle?: string;
  };
  customDomainData?: Record<string, unknown>;
}

/** 5. Session Context (Modelo real da sessão) */
export interface SessionContext {
  sessionId: string;
  establishmentId: string;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSING' | 'ENDED';
  startedAt?: string;
  endedAt?: string;
  currentPlaybackStatus?: 'PLAYING' | 'PAUSED' | 'IDLE';
  currentSinger?: string;
  currentSong?: string;
  activeControllerName?: string;
  isExpired: boolean;
}

/** 6. Conversation Context (Janela controlada com limites) */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  trust: ContextTrustLevel;
}

export interface ConversationContext {
  conversationId: string;
  totalTurnCount: number;
  recentMessages: ConversationMessage[];
  currentIntent?: string;
  pendingAction?: {
    toolName: string;
    description: string;
    requiresConfirmation: boolean;
  };
}

/** 7. Temporal Context (Momento confiável para raciocínio) */
export interface TemporalContext {
  currentTimeIso: string;
  currentTimestamp: number;
  timezone: string;
  sessionDurationMinutes?: number;
  sessionRemainingMinutes?: number;
  isClosingSoon: boolean; // Menos de 15 minutos para encerramento
}

/** 8. Event Context (Eventos e percepções recentes com TTL estrito, diferente de memória) */
export interface ContextEventItem {
  id: string;
  name: string;
  source: string;
  timestamp: string;
  ageSeconds: number;
  isExpired: boolean;
  summary: string;
  relevance?: string;
  candidateIntent?: string;
}

export interface EventContext {
  recentEvents: ContextEventItem[];
  ttlSeconds: number;
  totalEventsReceived: number;
  recentPerceptions?: any[];
}

/** 9. Permission Context (Permissões reais para validação no Policy Engine) */
export interface PermissionContext {
  permissions: readonly string[];
  effectiveScope: string;
  canExecuteActions: boolean;
  canExecuteCritical: boolean;
}

/** 10. Capability Context (Capacidades do ambiente operacional) */
export interface CapabilityContext {
  voice: boolean;
  queue: boolean;
  notifications: boolean;
  tv: boolean;
  djSoundboard: boolean;
  songRecommendations: boolean;
}

/** 11. System & Environment Context */
export type ContextChannel = 
  | 'web'
  | 'controller'
  | 'mobile'
  | 'supervisor'
  | 'tv'
  | 'voice'
  | 'whatsapp'
  | 'api';

export type ContextInterface = 
  | 'participant-pwa'
  | 'supervisor-pwa'
  | 'controller-desk'
  | 'tv-display'
  | 'voice-interface'
  | 'public-tracker'
  | 'api-gateway';

export interface EnvironmentContext {
  channel: ContextChannel;
  interface: ContextInterface;
  clientVersion?: string;
  runtime: 'node-express' | string;
}

/** Voice Context (Campos preparados para futuras integrações de voz) */
export interface VoiceContext {
  isVoiceActive: boolean;
  audioSessionId?: string;
  turnId?: string;
  preferredVoiceId?: string;
  speechRate?: number;
}

// ============================================================================
// 4. CONTEXT METRICS & OBSERVABILITY
// ============================================================================

export interface ContextMetrics {
  buildLatencyMs: number;
  estimatedTokens: number;
  fieldCount: number;
  sourcesUsed: string[];
  sourcesSkipped: string[];
  serializedSizeBytes: number;
  eventsFilteredCount: number;
  messagesFilteredCount: number;
  memoriesRetrievedCount?: number;
}

// ============================================================================
// 4.1 MEMORY ITEM CONTEXT DTO (CONSULTADO PELO CONTEXT ENGINE)
// ============================================================================

export interface ContextMemoryItem {
  id: string;
  type: string;
  scope: string;
  summary?: string;
  content: any;
  confidence: number;
  importance: number;
  source: string;
  relevanceScore?: number;
}

// ============================================================================
// 5. MAIA CONTEXT SNAPSHOT (OBJETO DE SAÍDA IMUTÁVEL)
// ============================================================================

export interface MaiaContextSnapshot {
  readonly contextVersion: 1;
  readonly correlationId: string;
  readonly generatedAt: string;
  readonly profile: ContextProfileType;
  readonly tenantId: string;

  // Os 11 contextos estruturados
  readonly identity: IdentityContext;
  readonly user: UserContext;
  readonly role: RoleContext;
  readonly domain: DomainContext;
  readonly session: SessionContext;
  readonly conversation: ConversationContext;
  readonly temporal: TemporalContext;
  readonly events: EventContext;
  readonly permissions: PermissionContext;
  readonly capabilities: CapabilityContext;
  readonly environment: EnvironmentContext;
  readonly voice: VoiceContext;

  // Memórias relevantes recuperadas sob demanda (FASE 06)
  readonly memories?: ContextMemoryItem[];

  // Metadados e observabilidade
  readonly metrics: ContextMetrics;
}

// ============================================================================
// 6. INTERFACES DE FONTES DE CONTEXTO (CONTEXT SOURCES)
// ============================================================================

export interface ContextSourceResolutionContext {
  tenantId: string;
  sessionId?: string;
  userId?: string;
  role?: string;
  channel?: ContextChannel;
  interface?: ContextInterface;
  userMessage?: string;
  profile: ContextProfileType;
  correlationId: string;
}

export interface IContextSource<T> {
  readonly name: string;
  readonly priority: ContextPriorityLevel;
  resolve: (context: ContextSourceResolutionContext) => Promise<T> | T;
}
