/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PERCEPTION CONTRACTS (PROMPT 05)
 * Tipagens oficiais da camada de Percepção da MaIA.
 * 
 * REGRA FUNDAMENTAL:
 * Percepção NÃO significa autonomia.
 * A MaIA observa eventos, classifica relevância, prioridade, contextualiza e formula
 * candidatas a intenção, mas NÃO executa ações autonomamente nesta fase.
 */

export type PerceptionRelevance = 
  | 'CRITICAL'   // Exige atenção máxima imediata (emergências, falhas críticas)
  | 'HIGH'       // Evento crucial de palco ou fila (cantor chamado, música concluída, 2ª ausência)
  | 'MEDIUM'     // Evento operacional relevante (música adicionada, 1ª ausência, prorrogação)
  | 'LOW'        // Informação contextual de baixa prioridade (código validado, conexões normais)
  | 'IGNORED';   // Ruído, telemetria, heartbeats ou eventos descartados

export type PerceptionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type PerceptionCategory = 
  | 'QUEUE'
  | 'PERFORMANCE'
  | 'SESSION'
  | 'AUDIENCE'
  | 'OPERATIONAL'
  | 'SYSTEM';

export type CandidateIntent = 
  | 'ANNOUNCE_SINGER'          // Anunciar cantor chamado com energia
  | 'CELEBRATE_PERFORMANCE'    // Celebrar música finalizada e engajar plateia
  | 'ENCOURAGE_AUDIENCE'       // Convidar o público para cantar (ex: fila vazia)
  | 'ALERT_OPERATOR_ABSENCE'   // Notificar ausência de cantor para reorganização
  | 'NOTIFY_SESSION_ENDING'    // Avisar sobre encerramento iminente da sessão
  | 'WELCOME_AUDIENCE'         // Abertura oficial do karaokê
  | 'HANDLE_EMERGENCY'         // Assunção emergencial
  | 'OBSERVE_ONLY'             // Manter no contexto sem intenção reativa
  | 'NONE';

/**
 * Registro de Percepção Estruturado da MaIA
 */
export interface MaiaPerceptionRecord {
  /** Identificador único da percepção gerada */
  id: string;
  /** Identificador do evento que originou a percepção */
  eventId: string;
  /** Tipo ou namespace do evento de domínio */
  eventType: string;
  /** Identificador do estabelecimento/locatário */
  tenantId: string;
  /** Identificador da sessão operacional ativa */
  sessionId?: string;
  /** Timestamp de quando o evento de domínio ocorreu no sistema */
  occurredAt: string;
  /** Timestamp de quando a MaIA percebeu e processou o evento */
  perceivedAt: string;
  /** Nível de relevância da percepção para a inteligência */
  relevance: PerceptionRelevance;
  /** Nível de prioridade operacional */
  priority: PerceptionPriority;
  /** Categoria semântica do evento percebido */
  category: PerceptionCategory;
  /** Resumo scannable e humano da percepção em pt-BR */
  summary: string;
  /** Justificativa e raciocínio de por que esse evento foi percebido e classificado */
  reasoning: string;
  /** Candidata a intenção futura para a próxima camada (Agent Runtime) */
  candidateIntent: CandidateIntent;
  /** Correlação contextual e situacional do momento da percepção */
  contextCorrelation?: {
    correlationId?: string;
    actorId?: string;
    actorRole?: string;
    activeSinger?: string;
    songTitle?: string;
    songArtist?: string;
    queueLength?: number;
    sessionStatus?: string;
    [key: string]: unknown;
  };
  /** Status do ciclo de vida da percepção */
  status: 'PERCEIVED' | 'QUEUED_FOR_AGENT' | 'DISCARDED';
  /** Latência de processamento da percepção em milissegundos */
  latencyMs: number;
}

/**
 * Filtro estruturado para busca de percepções
 */
export interface PerceptionFilter {
  tenantId?: string;
  sessionId?: string;
  relevance?: PerceptionRelevance | PerceptionRelevance[];
  category?: PerceptionCategory | PerceptionCategory[];
  candidateIntent?: CandidateIntent;
  minPriority?: PerceptionPriority;
  limit?: number;
}

/**
 * Métricas operacionais da camada de percepção
 */
export interface PerceptionMetrics {
  totalEventsAnalyzed: number;
  totalPerceptionsCreated: number;
  totalIgnoredEvents: number;
  totalDebouncedEvents: number;
  relevanceCounts: Record<PerceptionRelevance, number>;
  priorityCounts: Record<PerceptionPriority, number>;
  categoryCounts: Record<PerceptionCategory, number>;
  candidateIntentCounts: Record<string, number>;
  averagePerceptionLatencyMs: number;
}
