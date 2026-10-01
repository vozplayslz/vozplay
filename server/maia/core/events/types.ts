/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA DOMAIN EVENT & EVENT BUS CONTRACTS (PROMPT 05)
 * Contratos universais para eventos de domínio, publicação, assinatura e métricas do Event Bus.
 */

export type DomainEventCategory = 
  | 'QUEUE'
  | 'PLAYBACK'
  | 'SESSION'
  | 'PRESENCE'
  | 'REACTION'
  | 'OPERATIONAL'
  | 'SYSTEM';

export type DomainEventPriority = 
  | 'P0_CRITICAL'
  | 'P1_HIGH'
  | 'P2_NORMAL'
  | 'P3_LOW';

/**
 * Contrato oficial de Evento de Domínio
 */
export interface DomainEvent<T = any> {
  /** Identificador único e imutável do evento */
  id: string;
  /** Tipo ou nome do evento no padrão de namespace 'dominio.entidade.acao' (ex: 'karaoke.queue.song_added') */
  type: string;
  /** Versão do esquema do evento */
  version: number;
  /** Timestamp ISO 8601 do momento exato em que o evento ocorreu */
  occurredAt: string;
  /** Fonte geradora do evento (ex: 'karaoke.queue', 'controller.mixer', 'presence.guard') */
  source: string;
  /** Identificador do estabelecimento/locatário (multi-tenant isolation) */
  tenantId?: string;
  /** Identificador da sessão ativa */
  sessionId?: string;
  /** Identificador do usuário/ator envolvido (quando aplicável) */
  userId?: string;
  /** Identificador de correlação para rastreabilidade de ponta a ponta */
  correlationId?: string;
  /** Identificador do evento ou causa antecedente */
  causationId?: string;
  /** Carga útil (dados do evento) */
  payload: T;
  /** Metadados adicionais arbitrários */
  metadata?: Record<string, unknown>;

  // Compatibilidade com contratos legados (MaiaCoreEvent):
  name?: string;
  timestamp?: string;
}

/**
 * Função de tratamento de evento de domínio
 */
export type DomainEventHandler<T = any> = (event: DomainEvent<T>) => Promise<void> | void;

/**
 * Representação de uma assinatura ativa no barramento
 */
export interface DomainEventSubscription {
  id: string;
  pattern: string;
  unsubscribe: () => Promise<void> | void;
}

/**
 * Métricas operacionais do Event Bus
 */
export interface EventBusMetrics {
  totalPublished: number;
  totalDelivered: number;
  totalDeduplicated: number;
  totalErrors: number;
  activeSubscriptions: number;
  lastEventPublishedAt?: string;
  recentLatencyMs: number;
}

/**
 * Opções de configuração para o Event Bus
 */
export interface EventBusOptions {
  maxHistoryLength?: number;
  deduplicationWindowMs?: number;
  enableDeduplication?: boolean;
}

/**
 * Interface formal do Barramento de Eventos
 */
export interface IEventBus {
  publish<T = any>(event: DomainEvent<T>): Promise<void>;
  subscribe<T = any>(pattern: string, handler: DomainEventHandler<T>): DomainEventSubscription;
  unsubscribe(subscription: DomainEventSubscription): Promise<void> | void;
  getRecentEvents(limit?: number, tenantId?: string): DomainEvent[];
  getMetrics(): EventBusMetrics;
  clearSubscriptions(): void;
  clearHistory(): void;
  resetMetrics(): void;
}
