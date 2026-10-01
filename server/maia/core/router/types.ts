/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI ROUTER TYPES — UNIVERSAL CONTRACTS (PROMPT 07)
 * Tipagens completas e universais para a camada intermediária de decisão e orquestração de IA.
 * 
 * Princípios Fundamentais:
 * - A MaIA pergunta: "Qual capacidade/tarefa preciso?" (AITask)
 * - O AI Router decide: Provedor, Modelo, Gateway, Parâmetros e Fallback.
 * - Desacoplamento absoluto de SDKs proprietários (Gemini, OpenAI, 9router, etc.).
 * - Hierarquia formal de autoridade: System > Developer > Policy > User > Memory > Tool Result.
 */

// ============================================================================
// 1. TAREFAS DE INTELIGÊNCIA ARTIFICIAL (AI TASKS)
// ============================================================================

export type AITask = 
  | 'conversation'          // Resposta conversacional direta ao interlocutor
  | 'reasoning'             // Raciocínio multi-etapa, análise lógica e deduções
  | 'classification'        // Classificação semântica de intenções, sentimento, tópicos
  | 'summarization'         // Sumarização e condensação de textos
  | 'extraction'            // Extração de dados estruturados e entidades (JSON)
  | 'planning'              // Planejamento de ações e resolução de objetivos
  | 'tool_selection'        // Seleção de ferramentas apropriadas
  | 'memory_summarization'  // Consolidação de memórias de sessão para persistência
  | 'translation'           // Tradução e localização linguística
  | 'embedding'             // Geração de vetores para busca semântica
  | 'transcription'         // Transcrição de áudio pré-gravado para texto
  | 'tts'                   // Síntese de fala a partir de texto
  | 'realtime_voice';       // Conversação bidirecional contínua de baixa latência

// ============================================================================
// 2. PERFIS OFICIAIS DE CAPACIDADE (AI PROFILES)
// ============================================================================

export type AIProfile = 
  | 'ECONOMICO'       // Prioriza custo mínimo e baixíssima latência para tarefas simples
  | 'BALANCEADO'      // Ponto de equilíbrio ótimo entre qualidade, custo e tempo de resposta
  | 'ALTA_CAPACIDADE'; // Máxima qualidade e raciocínio profundo para tarefas de alta complexidade

// ============================================================================
// 3. PERFIL DO MODELO DE IA (MODEL PROFILE)
// ============================================================================

export type LatencyClass = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AIModelProfile {
  /** Identificador único do modelo (ex: 'gemini-3.8-flash', 'gemini-3.1-pro-preview') */
  id: string;

  /** Identificador do provedor que serve este modelo (ex: 'gemini', '9router') */
  provider: string;

  /** Nome oficial da API */
  model: string;

  /** Lista de tarefas/capacidades que o modelo atende com excelência */
  capabilities: readonly AITask[] | AITask[];

  /** Tamanho da janela de contexto em tokens */
  contextWindow: number;

  /** Indica se suporta streaming de tokens */
  supportsStreaming: boolean;

  /** Indica se suporta function calling / tools */
  supportsTools: boolean;

  /** Indica se suporta entradas multimodais (visão/imagem) */
  supportsVision: boolean;

  /** Custo estimado por 1M tokens de entrada (USD) */
  costInput: number;

  /** Custo estimado por 1M tokens de saída (USD) */
  costOutput: number;

  /** Classe de latência esperada */
  latencyClass: LatencyClass;

  /** Status de habilitação do modelo */
  enabled: boolean;
}

// ============================================================================
// 4. MENSAGENS E REQUISIÇÃO DE IA (AI REQUEST)
// ============================================================================

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AIRequest {
  /** Capacidade / tarefa solicitada */
  task: AITask;

  /** Mensagens estruturadas da conversa */
  messages: AIMessage[];

  /** Instrução primária de sistema (opcional) */
  systemInstruction?: string;

  /** Contexto empacotado pelo Context Engine (opcional) */
  systemContext?: unknown;

  /** Ferramentas passíveis de chamada (Tool Calling) */
  tools?: any[];

  /** Preferência de perfil de custo/qualidade (opcional) */
  profile?: AIProfile;

  /** Preferência explícita de modelo (opcional, respeita políticas do tenant) */
  modelPreference?: string;

  /** Preferência explícita de provedor (opcional, respeita políticas do tenant) */
  providerPreference?: string;

  /** Temperatura de amostragem (0.0 a 2.0; controlado pelo Router) */
  temperature?: number;

  /** Limite máximo de tokens gerados */
  maxTokens?: number;

  /** Parâmetro Top-P */
  topP?: number;

  /** Timeout limite da requisição em milissegundos */
  timeoutMs?: number;

  /** Locatário associado para aplicação estrita de BYOK e quotas */
  tenantId?: string;

  /** Identificador de correlação para tracing e observabilidade */
  correlationId?: string;

  /** Metadados adicionais */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 5. RESPOSTA NORMALIZADA DE IA (AI RESPONSE & CHUNK)
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  estimatedCost: number;
  currency: 'USD' | 'BRL';
}

export type FinishReason = 'STOP' | 'MAX_TOKENS' | 'TOOL_CALL' | 'SAFETY' | 'UNKNOWN';

export interface AIResponse {
  /** Provedor que executou a inferência */
  provider: string;

  /** Modelo utilizado */
  model: string;

  /** Texto de saída gerado */
  content?: string;

  /** Chamadas de ferramentas sugeridas pelo LLM (normalizadas, não executadas pelo Router) */
  toolCalls?: AIToolCall[];

  /** Métricas de consumo de tokens e custo estimado */
  usage: TokenUsage;

  /** Motivo de encerramento da geração */
  finishReason?: FinishReason;

  /** Latência total de execução em milissegundos */
  latencyMs: number;

  /** Identificador de requisição único */
  requestId: string;

  /** Indica se a resposta foi obtida via fallback */
  fromFallback: boolean;

  /** Cadeia de provedores consultados até a conclusão */
  fallbackChain?: string[];
}

export interface AIChunk {
  text?: string;
  toolCall?: AIToolCall;
  isLast: boolean;
  finishReason?: FinishReason;
  usage?: TokenUsage;
}

// ============================================================================
// 6. HEALTH, CAPACIDADES E STATUS DO PROVEDOR
// ============================================================================

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'disabled';

export interface ProviderHealth {
  status: ProviderHealthStatus;
  latencyMs?: number;
  lastChecked: string;
  error?: string;
}

export interface ProviderCapabilities {
  supportedTasks: readonly AITask[] | AITask[];
  supportedModels: readonly string[] | string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
}

// ============================================================================
// 7. BYOK (BRING YOUR OWN KEY) & POLÍTICAS DE TENANT
// ============================================================================

export type BYOKState = 'managed' | 'byok' | 'gateway' | 'disabled';

export interface BYOKConfig {
  tenantId: string;
  state: BYOKState;
  encryptedApiKey?: string;
  maskedApiKey?: string;
  customEndpointUrl?: string;
  allowedModels?: string[];
  lastRotatedAt?: string;
  updatedAt: string;
}

export interface TenantAIRouterPolicy {
  tenantId: string;
  aiEnabled: boolean;
  allowedProviders: string[];
  disallowedProviders: string[];
  allowedModels: string[];
  disallowedModels: string[];
  preferredProfile: AIProfile;
  monthlyBudgetLimitUsd?: number;
  fallbackAllowed: boolean;
}

// ============================================================================
// 8. MÉTRICAS E TELEMETRIA DO ROUTER
// ============================================================================

export interface RouterMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  retriedRequests: number;
  fallbackRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number;
  averageLatencyMs: number;
  requestsByProvider: Record<string, number>;
  requestsByModel: Record<string, number>;
  requestsByTask: Record<string, number>;
}
