/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE TYPES — UNIVERSAL ARCHITECTURAL CONTRACTS
 * Contratos universais do MaIA Core (independente de domínio, voz, interface ou provedor).
 * 
 * Arquitetura Conceitual:
 *                     MAIA
 *                      │
 *                 ┌────▼────┐
 *                 │ MAIA    │
 *                 │  CORE   │
 *                 └────┬────┘
 *                      │
 *         ┌────────────┼────────────┐
 *         │            │            │
 *      Context       Router       Policy
 *         │            │            │
 *         └────────────┼────────────┘
 *                      │
 *                   Runtime
 *                      │
 *         ┌────────────┼────────────┐
 *         │            │            │
 *       Tools        Events       Memory
 *         │            │            │
 *         └────────────┼────────────┘
 *                      │
 *          Domínios Especializados
 *          ├── MaIA Karaokê (VozPlay)
 *          ├── MaIA NAP
 *          ├── MaIA CRM
 *          ├── MaIA ERP
 *          ├── MaIA PBX
 *          └── MaIA DoorIA
 */

// ============================================================================
// 1. IDENTIDADE E DOMÍNIO
// ============================================================================

export interface MaiaCoreIdentity {
  /** Identificador único do core */
  id: 'maia-core';
  /** Nome oficial do cérebro de inteligência */
  name: 'MaIA';
  /** Organização desenvolvedora */
  organization: 'Enlace';
  /** Versão da arquitetura do Core */
  version: string;
  /** Descrição universal do core */
  description: string;
  /** Missão primordial universal */
  mission: string;
  /** Princípios inegociáveis de operação e segurança */
  immutablePrinciples: readonly string[];
  /** Traços universais de personalidade */
  coreTraits: readonly string[];
  /** Idioma padrão */
  defaultLanguage: 'pt-BR';
}

export interface MaiaDomainProfile {
  /** Identificador do domínio (ex: 'maia-karaoke', 'maia-crm') */
  id: string;
  /** Nome do produto ou especialização (ex: 'MaIA Karaokê') */
  product: string;
  /** Domínio funcional (ex: 'karaoke', 'hospitality', 'telephony') */
  domain: string;
  /** Papel/Persona no domínio (ex: 'Anfitriã Digital e Mestre de Cerimônias') */
  role: string;
  /** Descrição específica da persona de domínio */
  description: string;
  /** Diretrizes de tom e voz da persona */
  tone: string[];
  /** Instruções customizadas adicionais para o domínio */
  customInstructions?: readonly string[];
  /** Metadados arbitrários de domínio */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 2. CONTEXTO UNIVERSAL (CONTEXT ENGINE)
// ============================================================================

export interface MaiaTenantContext {
  id: string;
  name?: string;
  tier?: string;
  settings?: Record<string, unknown>;
}

export interface MaiaSessionContext {
  id: string;
  status: string;
  activeSince?: string;
  metadata?: Record<string, unknown>;
}

export interface MaiaActorContext {
  id: string;
  role: string;
  displayName?: string;
  permissions?: string[];
  authenticated: boolean;
  metadata?: Record<string, unknown>;
}

export type MaiaChannel = 
  | 'web' 
  | 'controller' 
  | 'mobile' 
  | 'supervisor' 
  | 'tv' 
  | 'voice' 
  | 'whatsapp' 
  | 'display' 
  | 'api' 
  | 'automation';

export interface MaiaEnvironmentContext {
  channel: MaiaChannel;
  clientVersion?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface MaiaCoreConversationTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  timestamp: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export type CoreConversationTurn = MaiaCoreConversationTurn;

export interface MaiaContext {
  /** Identificador único de rastreabilidade (Correlation ID / Trace ID) */
  correlationId: string;
  /** Timestamp de geração do contexto */
  timestamp: string;
  /** Informações do estabelecimento / locatário */
  tenant: MaiaTenantContext;
  /** Sessão operacional ativa */
  session: MaiaSessionContext;
  /** Ator que realizou a interação */
  actor: MaiaActorContext;
  /** Ambiente / Canal de comunicação */
  environment: MaiaEnvironmentContext;
  /** Dados arbitrários de domínio (ex: fila de karaokê, catálogo, etc.) */
  domain: Record<string, unknown>;
  /** Histórico de diálogo recente */
  history: MaiaCoreConversationTurn[];
}

// ============================================================================
// 3. FERRAMENTAS E POLÍTICAS (TOOL REGISTRY & POLICY ENGINE)
// ============================================================================

export type MaiaToolRiskLevel = 'READ' | 'ACTION' | 'HIGH_RISK' | 'CRITICAL';

export interface MaiaToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: readonly string[] | string[];
    [key: string]: unknown;
  }>;
  required?: readonly string[] | string[];
}

export interface MaiaTool {
  name: string;
  description: string;
  category: MaiaToolRiskLevel;
  allowedRoles: readonly string[] | string[];
  requiredPermissions?: readonly string[] | string[];
  parameters: MaiaToolParameterSchema;
  execute: (context: MaiaContext, params: any) => Promise<any>;
}

export interface MaiaToolExecutionResult {
  toolName: string;
  category: MaiaToolRiskLevel;
  success: boolean;
  result?: any;
  error?: string;
  latencyMs: number;
  correlationId: string;
  timestamp: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
  riskLevel?: MaiaToolRiskLevel;
  code?: string;
}

export interface MaiaPolicyRule {
  name: string;
  description: string;
  priority: number;
  evaluate: (context: MaiaContext, tool: MaiaTool, params: any) => Promise<PolicyDecision | null> | PolicyDecision | null;
}

// ============================================================================
// 4. BARRAMENTO DE EVENTOS (EVENT BUS)
// ============================================================================

export interface MaiaCoreEvent<T = any> {
  id: string;
  name: string;
  type?: string;
  version?: number;
  occurredAt?: string;
  tenantId: string;
  source: string;
  payload: T;
  correlationId?: string;
  timestamp: string;
}

export type MaiaEventHandler<T = any> = (event: MaiaCoreEvent<T>) => Promise<void> | void;

export interface MaiaEventSubscription {
  id: string;
  pattern: string;
  unsubscribe: () => void;
}

// ============================================================================
// 5. PROVEDORES E ROTEAMENTO DE IA (AI ROUTER & PROVIDERS)
// ============================================================================

export type MaiaCoreTaskType = 
  | 'CHAT'
  | 'LIVE_VOICE'
  | 'REASONING'
  | 'TTS'
  | 'TRANSCRIPTION'
  | 'ACTION_PLANNING'
  | 'GENERIC_COMPLETION';

export interface AICompletionOptions {
  systemInstruction?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: MaiaTool[];
  correlationId?: string;
}

export interface AIProviderHealth {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface MaiaCoreAIProvider {
  id: string;
  name: string;
  supportedTasks: readonly MaiaCoreTaskType[] | MaiaCoreTaskType[];
  generateText: (prompt: string, options?: AICompletionOptions) => Promise<string>;
  generateStream?: (prompt: string, options?: AICompletionOptions) => AsyncIterable<string>;
  checkHealth: () => Promise<AIProviderHealth>;
}

export type CoreAIProvider = MaiaCoreAIProvider;

// ============================================================================
// 6. MOTOR DE MEMÓRIA (MEMORY ENGINE)
// ============================================================================

export type MaiaMemoryScope = 'turn' | 'session' | 'tenant' | 'long_term';

export interface MaiaMemoryEntry {
  key: string;
  value: any;
  tenantId: string;
  sessionId?: string;
  actorId?: string;
  scope: MaiaMemoryScope;
  expiresAt?: number;
  createdAt: string;
}

export interface IMaiaMemoryStore {
  get: (key: string, tenantId: string, scope?: MaiaMemoryScope) => Promise<any>;
  set: (entry: MaiaMemoryEntry) => Promise<void>;
  delete: (key: string, tenantId: string, scope?: MaiaMemoryScope) => Promise<boolean>;
  getConversationHistory: (tenantId: string, sessionId: string, actorId: string, limit?: number) => Promise<MaiaCoreConversationTurn[]>;
  appendConversationTurn: (tenantId: string, sessionId: string, actorId: string, turn: MaiaCoreConversationTurn) => Promise<void>;
  clearSessionMemory: (tenantId: string, sessionId: string) => Promise<void>;
}

// ============================================================================
// 7. AGENT RUNTIME & DECISION ENGINE
// ============================================================================

export interface MaiaAgentStep {
  type: 'tool_call' | 'respond' | 'query_memory' | 'emit_event';
  toolName?: string;
  params?: any;
  content?: string;
}

export interface MaiaAgentPlan {
  reasoning?: string;
  steps: MaiaAgentStep[];
}

export interface MaiaAgentRequest {
  context: MaiaContext;
  userMessage: string;
  options?: {
    maxSteps?: number;
    skipTools?: boolean;
    domainProfileId?: string;
  };
}

export interface MaiaAgentResponse {
  text: string;
  role: 'maia' | 'assistant';
  correlationId: string;
  toolInvocations?: MaiaToolExecutionResult[];
  providerUsed?: string;
  modelUsed?: string;
  latencyMs: number;
  fallbackOccurred: boolean;
  timestamp: string;
}
