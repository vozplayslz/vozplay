/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI AUDIT LOG SERVICE
 * Registro e rastreabilidade de eventos críticos de IA (troca de credenciais, provedores, cotas e fallbacks).
 */

import crypto from 'node:crypto';
import { AIAuditEvent, AIAuditEventType } from '../types.js';
import { pgClient } from '../../pgClient.js';
import { logger } from '../../logger.js';

class AIAuditService {
  private events: AIAuditEvent[] = [];
  private readonly maxMemoryEvents = 1000;

  /**
   * Registra um evento de auditoria de IA
   */
  public record(params: {
    actor: string;
    tenant_id?: string;
    establishment_id: string;
    event_type: AIAuditEventType;
    provider: string;
    model?: string;
    reason?: string;
    details?: Record<string, any>;
  }): AIAuditEvent {
    const event: AIAuditEvent = {
      id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      actor: params.actor || 'System',
      tenant_id: params.tenant_id || params.establishment_id,
      establishment_id: params.establishment_id,
      event_type: params.event_type,
      provider: params.provider,
      model: params.model,
      reason: params.reason,
      details: params.details,
      timestamp: new Date().toISOString()
    };

    this.events.unshift(event);
    if (this.events.length > this.maxMemoryEvents) {
      this.events.length = this.maxMemoryEvents;
    }

    logger.info(`[AIAudit] ${event.event_type} (${event.provider}) por ${event.actor}: ${event.reason || ''}`);

    if (pgClient.isConnected) {
      pgClient.query(
        `INSERT INTO maia_ai_audit_events (
          id, actor, tenant_id, establishment_id, event_type, provider, model, reason, details, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING`,
        [
          event.id,
          event.actor,
          event.tenant_id,
          event.establishment_id,
          event.event_type,
          event.provider,
          event.model || null,
          event.reason || null,
          event.details ? JSON.stringify(event.details) : null,
          event.timestamp
        ]
      ).catch(err => {
        logger.warn('[AIAudit] Notificação: tabela de auditoria persistente não disponível ou erro de escrita:', { error: String(err) });
      });
    }

    return event;
  }

  /**
   * Obtém eventos de auditoria filtrados por estabelecimento
   */
  public getEvents(establishmentId = 'est-slz-lounge', limit = 50): AIAuditEvent[] {
    return this.events
      .filter(e => e.establishment_id === establishmentId || e.tenant_id === establishmentId)
      .slice(0, limit);
  }
}

export const aiAudit = new AIAuditService();
