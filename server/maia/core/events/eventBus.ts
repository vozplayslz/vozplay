/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE EVENT BUS (PROMPT 05)
 * Barramento assíncrono, não-bloqueante e desacoplado de eventos de domínio.
 * Suporta wildcards ('*', '#'), deduplicação temporal, buffer circular,
 * isolamento total de falhas em ouvintes e métricas de observabilidade.
 */

import { randomUUID } from 'crypto';
import {
  DomainEvent,
  DomainEventHandler,
  DomainEventSubscription,
  EventBusMetrics,
  EventBusOptions,
  IEventBus
} from './types.js';
import { MaiaEventGuard } from '../security/eventGuard.js';

interface RegisteredSubscription {
  id: string;
  pattern: string;
  regex: RegExp;
  handler: DomainEventHandler;
}

export class EventBus implements IEventBus {
  private subscriptions: RegisteredSubscription[] = [];
  private eventHistory: DomainEvent[] = [];
  private readonly maxHistoryLength: number;
  private readonly deduplicationWindowMs: number;
  private readonly enableDeduplication: boolean;
  
  // Deduplicação por ID do evento dentro da janela deslizante
  private seenEventIds = new Map<string, number>();
  
  // Cooldowns legados por chave (ex: tenantId:eventName)
  private cooldowns = new Map<string, number>();

  // Métricas operacionais
  private metrics: EventBusMetrics = {
    totalPublished: 0,
    totalDelivered: 0,
    totalDeduplicated: 0,
    totalErrors: 0,
    activeSubscriptions: 0,
    recentLatencyMs: 0
  };

  constructor(options?: EventBusOptions) {
    this.maxHistoryLength = options?.maxHistoryLength ?? 200;
    this.deduplicationWindowMs = options?.deduplicationWindowMs ?? 60000;
    this.enableDeduplication = options?.enableDeduplication ?? true;
  }

  /**
   * Converte padrão com wildcard para RegExp.
   * Suporta:
   * - '*' ou '#' sozinhos: casa com qualquer evento.
   * - '*' no meio/fim: casa com exatamente 1 segmento (sem pontos).
   * - '#' no meio/fim: casa com 1 ou mais segmentos arbitrários.
   */
  private patternToRegex(pattern: string): RegExp {
    if (pattern === '*' || pattern === '#') {
      return /.*/;
    }
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^.]+')
      .replace(/#/g, '.*');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Limpa IDs antigos do mapa de deduplicação expirados pela janela temporal
   */
  private purgeOldDeduplicationEntries(now: number): void {
    if (this.seenEventIds.size > 1000) {
      for (const [id, seenTime] of this.seenEventIds.entries()) {
        if (now - seenTime > this.deduplicationWindowMs) {
          this.seenEventIds.delete(id);
        }
      }
    }
  }

  /**
   * Publica um evento de domínio de forma assíncrona e desacoplada.
   */
  public async publish<T = any>(event: DomainEvent<T>): Promise<void> {
    const startTime = Date.now();

    // 0. Validação de segurança e anti-poisoning de eventos (Fase 11)
    MaiaEventGuard.validateEvent(event);

    const eventType = (event.type || event.name)!;
    const nowIso = new Date().toISOString();

    // Normalização dos campos universais do evento
    const fullEvent: DomainEvent<T> = {
      ...event,
      id: event.id || randomUUID(),
      type: eventType,
      name: eventType,
      version: event.version || 1,
      occurredAt: event.occurredAt || event.timestamp || nowIso,
      timestamp: event.occurredAt || event.timestamp || nowIso,
      source: event.source!,
      payload: event.payload
    };

    // 1. Verificação de deduplicação por ID do evento
    if (this.enableDeduplication && fullEvent.id) {
      const now = Date.now();
      const lastSeen = this.seenEventIds.get(fullEvent.id);
      if (lastSeen && now - lastSeen < this.deduplicationWindowMs) {
        this.metrics.totalDeduplicated++;
        return; // Evento duplicado descartado silenciosamente
      }
      this.seenEventIds.set(fullEvent.id, now);
      this.purgeOldDeduplicationEntries(now);
    }

    this.metrics.totalPublished++;
    this.metrics.lastEventPublishedAt = nowIso;

    // 2. Armazena no buffer circular em memória
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift();
    }

    // 3. Localiza assinantes cujo padrão casa com o tipo do evento
    const matchingSubs = this.subscriptions.filter(s => s.regex.test(eventType));
    if (matchingSubs.length === 0) {
      this.metrics.recentLatencyMs = Date.now() - startTime;
      return;
    }

    // 4. Executa cada manipulador de forma isolada (Zero Cascade Failure)
    Promise.allSettled(
      matchingSubs.map(async sub => {
        try {
          await sub.handler(fullEvent);
          this.metrics.totalDelivered++;
        } catch (handlerErr) {
          this.metrics.totalErrors++;
          console.error(`[EventBus] Erro isolado no ouvinte '${sub.pattern}' para evento '${eventType}':`, handlerErr);
        }
      })
    ).finally(() => {
      this.metrics.recentLatencyMs = Date.now() - startTime;
    });
  }

  /**
   * Inscreve um manipulador para eventos correspondentes a um padrão.
   */
  public subscribe<T = any>(pattern: string, handler: DomainEventHandler<T>): DomainEventSubscription {
    const id = randomUUID();
    const regex = this.patternToRegex(pattern);

    const sub: RegisteredSubscription = {
      id,
      pattern,
      regex,
      handler: handler as DomainEventHandler
    };

    this.subscriptions.push(sub);
    this.metrics.activeSubscriptions = this.subscriptions.length;

    return {
      id,
      pattern,
      unsubscribe: () => {
        this.unsubscribe({ id, pattern, unsubscribe: () => {} });
      }
    };
  }

  /**
   * Remove uma assinatura ativa do barramento.
   */
  public unsubscribe(subscription: { id: string; [key: string]: any }): void {
    const prevCount = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter(s => s.id !== subscription.id);
    if (this.subscriptions.length !== prevCount) {
      this.metrics.activeSubscriptions = this.subscriptions.length;
    }
  }

  // ==========================================================================
  // COMPATIBILIDADE LEGADA COM MAIAEVENTBUS (FASE 02/03/04)
  // ==========================================================================

  /**
   * Alias legado para subscribe (on)
   */
  public on<T = any>(pattern: string, handler: (event: any) => Promise<void> | void): { id: string; pattern: string; unsubscribe: () => void } {
    return this.subscribe(pattern, handler);
  }

  /**
   * Alias legado para publish (emit)
   */
  public async emit<T = any>(eventData: {
    name: string;
    tenantId: string;
    source: string;
    payload: T;
    correlationId?: string;
    cooldownMs?: number;
  }): Promise<void> {
    const { name, tenantId, source, payload, correlationId, cooldownMs } = eventData;

    // Cooldown check legado
    if (cooldownMs && cooldownMs > 0) {
      const cooldownKey = `${tenantId}:${name}`;
      const lastTime = this.cooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      if (now - lastTime < cooldownMs) {
        return;
      }
      this.cooldowns.set(cooldownKey, now);
    }

    const domainEvent: DomainEvent<T> = {
      id: randomUUID(),
      type: name,
      name,
      version: 1,
      occurredAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      tenantId,
      source,
      correlationId,
      payload
    };

    return this.publish(domainEvent);
  }

  /**
   * Consulta os eventos mais recentes registrados no histórico em memória
   */
  public getRecentEvents(limit: number = 20, tenantId?: string): DomainEvent[] {
    let events = this.eventHistory;
    if (tenantId) {
      events = events.filter(e => !e.tenantId || e.tenantId === tenantId);
    }
    return events.slice(-Math.min(limit, this.maxHistoryLength));
  }

  /**
   * Retorna as métricas operacionais atuais
   */
  public getMetrics(): EventBusMetrics {
    return {
      ...this.metrics,
      activeSubscriptions: this.subscriptions.length
    };
  }

  /**
   * Reinicia as métricas
   */
  public resetMetrics(): void {
    this.metrics = {
      totalPublished: 0,
      totalDelivered: 0,
      totalDeduplicated: 0,
      totalErrors: 0,
      activeSubscriptions: this.subscriptions.length,
      recentLatencyMs: 0
    };
  }

  /**
   * Limpa todas as assinaturas registradas
   */
  public clearSubscriptions(): void {
    this.subscriptions = [];
    this.metrics.activeSubscriptions = 0;
  }

  /**
   * Limpa o buffer de histórico e deduplicação
   */
  public clearHistory(): void {
    this.eventHistory = [];
    this.seenEventIds.clear();
    this.cooldowns.clear();
  }
}

// Aliases e Singleton Oficial
export type MaiaEventBus = EventBus;
export const MaiaEventBus = EventBus;
export const eventBus = new EventBus();
export const maiaEventBus = eventBus;
