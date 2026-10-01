/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA EVENT CONTEXT SOURCE (PROMPT 05)
 * Fornece eventos recentes do Event Bus e percepções sintetizadas da MaIA com expiração por TTL estrito.
 * Princípio: Eventos são contexto temporário e volátil, NÃO memória de longo prazo.
 */

import {
  IContextSource,
  EventContext,
  ContextEventItem,
  ContextSourceResolutionContext,
  ContextPriorityLevel
} from '../types.js';
import { maiaEventBus } from '../../events/eventBus.js';
import { maiaPerceptionEngine } from '../../perception/perceptionEngine.js';

export class EventContextSource implements IContextSource<EventContext> {
  public readonly name = 'EventSource';
  public readonly priority: ContextPriorityLevel = 'P4_RECENT_EVENTS';

  public resolve(context: ContextSourceResolutionContext): EventContext {
    const ttlSeconds = context.profile === 'voice' ? 120 : 300; // 5 minutos por padrão
    const maxEvents = context.profile === 'voice' ? 3 : 6;

    const rawEvents = maiaEventBus.getRecentEvents(20, context.tenantId);
    const now = Date.now();

    const filteredEvents: ContextEventItem[] = [];

    for (const ev of rawEvents) {
      // Isolamento multi-tenant: só inclui eventos do tenant atual
      if (ev.tenantId && ev.tenantId !== context.tenantId) {
        continue;
      }

      const timestampStr = ev.occurredAt || ev.timestamp || new Date().toISOString();
      const eventTime = new Date(timestampStr).getTime();
      const ageSeconds = Math.max(0, Math.floor((now - eventTime) / 1000));
      const isExpired = ageSeconds > ttlSeconds;

      // Eventos expirados pelo TTL NÃO entram no contexto ativo
      if (!isExpired) {
        const eventName = ev.type || ev.name || 'unspecified';
        filteredEvents.push({
          id: ev.id,
          name: eventName,
          source: ev.source,
          timestamp: timestampStr,
          ageSeconds,
          isExpired: false,
          summary: `[${eventName}] via ${ev.source} (${ageSeconds}s atrás)`
        });
      }
    }

    // Percepções semânticas da MaIA para o tenant
    const recentPerceptions = maiaPerceptionEngine.getRecentPerceptions(
      context.tenantId,
      maxEvents
    );

    return {
      recentEvents: filteredEvents.slice(-maxEvents),
      ttlSeconds,
      totalEventsReceived: filteredEvents.length,
      recentPerceptions
    };
  }
}

export const eventContextSource = new EventContextSource();
