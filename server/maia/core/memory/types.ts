/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY TYPES — CONTRATOS ARQUITETURAIS (PROMPT 06)
 * Contratos universais da camada de memória da MaIA (Enlace / VozPlay).
 * 
 * Princípios Fundamentais:
 * - CONTEXT = o que está acontecendo agora (volátil, snapshot)
 * - MEMORY  = o que vale a pena preservar para uso futuro (selecionado, auditável)
 * - HISTORY = registro factual do que aconteceu
 * - KNOWLEDGE = documentação / informação estática
 * - RAG     = mecanismo de recuperação de conhecimento
 * 
 * Memória NÃO é banco de chat (messages[]).
 * Memória é classificada como DATA, NUNCA como INSTRUCTION.
 */

// ============================================================================
// 1. TIPOS DE MEMÓRIA (MEMORY TYPES)
// ============================================================================

export type MemoryType = 
  | 'WORKING'       // Temporária de curta duração durante operações (objetivos, tarefas, decisões transitórias)
  | 'SESSION'       // Relacionada à sessão ativa (acontecimentos importantes, estado resumido; avaliada no encerramento)
  | 'EPISODIC'      // Acontecimentos relevantes com timestamp, contexto, importância e confiança
  | 'SEMANTIC'      // Conhecimento e fatos operacionais relativamente estáveis
  | 'PREFERENCE'    // Preferências explícitas declaradas (user_explicit ou operator_configured)
  | 'OPERATIONAL';  // Procedimentos, continuidade operacional, configurações (NAP, CRM, ERP, PBX, DoorIA)

// ============================================================================
// 2. ESCOPOS DE MEMÓRIA (MEMORY SCOPES)
// ============================================================================

export type MemoryScope = 
  | 'global'          // Conhecimento universal do produto/sistema
  | 'tenant'          // Específico da organização / locatário
  | 'organization'    // Corporativo multi-unidades
  | 'product'         // Específico do produto (ex: VozPlay / MaIA Karaokê)
  | 'establishment'   // Específico da unidade física (bar, lounge, restaurante)
  | 'user'            // Específico de um usuário individual (cantor, operador, supervisor)
  | 'session'         // Específico da sessão operacional em andamento
  | 'device'          // Específico de um terminal ou tela
  | 'conversation';   // Contexto de diálogo delimitado

// ============================================================================
// 3. ORIGENS DE MEMÓRIA (MEMORY SOURCES)
// ============================================================================

export type MemorySource = 
  | 'user_explicit'        // Usuário declarou expressamente ("Lembre-se que...")
  | 'operator_explicit'    // Operador da mesa configurou
  | 'system'               // Registrado pelo sistema core
  | 'domain_event'         // Originado de evento de domínio qualificado
  | 'conversation'         // Extraído sob política de diálogo
  | 'tool_result'          // Resultado confiável de ferramenta autorizada
  | 'imported'             // Importado de base de dados legada
  | 'derived';             // Inferido/deduzido (confidence < 1.0, não é verdade absoluta)

// ============================================================================
// 4. ESTRUTURA DO ITEM DE MEMÓRIA (MEMORY ITEM)
// ============================================================================

export interface MemoryItem {
  /** Identificador único do item de memória */
  id: string;

  /** Tipo funcional da memória */
  type: MemoryType;

  /** Escopo de visibilidade e isolamento */
  scope: MemoryScope;

  /** Identificador do locatário (Obrigatório para isolamento multi-tenant) */
  tenantId: string;

  /** Identificador opcional do estabelecimento físico */
  establishmentId?: string;

  /** Identificador opcional do usuário associado */
  userId?: string;

  /** Identificador opcional da sessão associada */
  sessionId?: string;

  /** Conteúdo estruturado da memória (DATA, jamais executável) */
  content: Record<string, unknown> | string | number | boolean;

  /** Resumo em linguagem natural pt-BR para rápida assimilação */
  summary?: string;

  /** Origem e proveniência do dado */
  source: MemorySource;

  /** Grau de confiança estocástica ou factual (0.00 a 1.00; default 1.00 para fatos explícitos) */
  confidence: number;

  /** Grau de relevância/impacto da memória (1 a 5; 1 = trivial, 5 = crítico) */
  importance: number;

  /** Data e hora de criação (ISO 8601 UTC) */
  createdAt: string;

  /** Data e hora da última atualização (ISO 8601 UTC) */
  updatedAt: string;

  /** Data e hora de expiração automática (TTL) */
  expiresAt?: string;

  /** Número de versão do registro (incrementado a cada atualização) */
  version: number;

  /** Referência à versão anterior para rastreabilidade e histórico */
  previousVersionId?: string;

  /** Identificador do autor que realizou a última alteração */
  updatedBy?: string;

  /** Tags para indexação e busca estruturada */
  tags?: string[];

  /** Metadados arbitrários de suporte */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// 5. CONSULTA E RECUPERAÇÃO DE MEMÓRIA (MEMORY QUERY & RETRIEVAL)
// ============================================================================

export interface MemoryQuery {
  /** Locatário obrigatório para filtro estrito multi-tenant */
  tenantId: string;

  /** Escopo ou escopos desejados */
  scope?: MemoryScope | MemoryScope[];

  /** Tipos de memória a recuperar */
  types?: MemoryType[];

  /** Filtrar por usuário */
  userId?: string;

  /** Filtrar por sessão */
  sessionId?: string;

  /** Filtrar por estabelecimento */
  establishmentId?: string;

  /** Tags requeridas (ao menos uma correspondente) */
  tags?: string[];

  /** Importância mínima aceita (1 a 5) */
  minImportance?: number;

  /** Confiança mínima aceita (0.0 a 1.0) */
  minConfidence?: number;

  /** Apenas memórias criadas ou atualizadas após esta data */
  since?: string;

  /** Incluir registros expirados (padrão: false) */
  includeExpired?: boolean;

  /** Limite máximo de itens retornados (Memory Budget; padrão: 10, máx: 50) */
  limit?: number;

  /** Orçamento máximo de tokens estimados para a recuperação (padrão: 1000) */
  maxEstimatedTokens?: number;

  /** Termo para busca textual livre */
  searchText?: string;
}

export interface MemoryRetrievalResult {
  /** Itens recuperados ordenados por relevância determinística */
  items: MemoryItem[];

  /** Total de itens correspondentes antes do limite */
  totalMatches: number;

  /** Latência de recuperação em milissegundos */
  retrievalLatencyMs: number;

  /** Estimativa de tokens consumidos pelos itens */
  estimatedTokens: number;

  /** Indica se o orçamento de limite/tokens foi aplicado */
  budgetApplied: boolean;

  /** Indica se a resposta veio de fallback seguro */
  fromFallback: boolean;
}

// ============================================================================
// 6. ENTRADA DE CANDIDATO A MEMÓRIA (CANDIDATE INPUT)
// ============================================================================

export interface MemoryCandidateInput {
  type: MemoryType;
  scope: MemoryScope;
  tenantId: string;
  establishmentId?: string;
  userId?: string;
  sessionId?: string;
  content: Record<string, unknown> | string | number | boolean;
  summary?: string;
  source: MemorySource;
  confidence?: number;
  importance?: number;
  ttlSeconds?: number;
  expiresAt?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

// ============================================================================
// 7. POLÍTICA DE RETENÇÃO (RETENTION POLICY)
// ============================================================================

export interface RetentionPolicyConfig {
  /** TTL padrão em segundos por tipo de memória */
  defaultTtlSeconds: Record<MemoryType, number | null>;

  /** TTL máximo permitido em segundos por tipo */
  maxTtlSeconds: Record<MemoryType, number | null>;

  /** Habilita expiração automática */
  autoPruneEnabled: boolean;
}

// ============================================================================
// 8. AUDITORIA DE OPERAÇÕES DE MEMÓRIA (AUDIT)
// ============================================================================

export type MemoryAuditAction = 
  | 'memory.created'
  | 'memory.updated'
  | 'memory.deleted'
  | 'memory.expired'
  | 'memory.retrieved'
  | 'memory.rejected';

export interface MemoryAuditRecord {
  id: string;
  action: MemoryAuditAction;
  memoryId?: string;
  tenantId: string;
  memoryType?: MemoryType;
  scope?: MemoryScope;
  actor?: string;
  reason?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// 9. MÉTRICAS E TELEMETRIA DE MEMÓRIA
// ============================================================================

export interface MemoryMetrics {
  totalStored: number;
  totalRetrieved: number;
  totalUpdated: number;
  totalDeleted: number;
  totalExpiredPruned: number;
  totalRejected: number;
  averageRetrievalLatencyMs: number;
  cacheHits: number;
  cacheMisses: number;
}
