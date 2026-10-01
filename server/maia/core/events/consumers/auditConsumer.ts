/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA DOMAIN EVENT AUDIT CONSUMER (PROMPT 05)
 * Consumidor independente de auditoria com sanitização estrita de dados sensíveis (LGPD).
 * Custodia o rastro cronológico imutável de eventos operacionais sem vazamento de PII.
 */

import { DomainEvent } from '../types.js';
import { eventBus } from '../eventBus.js';

export interface AuditRecord {
  id: string;
  eventId: string;
  eventType: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
  occurredAt: string;
  source: string;
  correlationId?: string;
  sanitizedPayload: any;
  recordedAt: string;
}

export interface AuditFilter {
  tenantId?: string;
  sessionId?: string;
  eventType?: string;
  correlationId?: string;
  limit?: number;
}

export class AuditConsumer {
  private auditHistory: AuditRecord[] = [];
  private readonly maxRecords: number;
  private isSubscribed: boolean = false;
  private subscriptionId?: string;

  constructor(options?: { maxRecords?: number }) {
    this.maxRecords = options?.maxRecords ?? 300;
  }

  /**
   * Chaves e campos confidenciais protegidos por máscara estrita
   */
  private readonly SENSITIVE_KEYS = new Set([
    'password',
    'pass',
    'token',
    'jwt',
    'secret',
    'pin',
    'presencecode',
    'phone',
    'whatsapp',
    'cpf',
    'document',
    'credential',
    'key'
  ]);

  /**
   * Sanitiza a carga útil do evento mascarando valores confidenciais
   */
  public sanitizePayload(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizePayload(item));
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (this.SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizePayload(value);
      } else if (typeof value === 'string' && (lowerKey.includes('phone') || lowerKey.includes('whatsapp'))) {
        sanitized[key] = value.length > 4 ? `***${value.slice(-4)}` : '***';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Inicia o consumo de eventos no barramento
   */
  public start(): void {
    if (this.isSubscribed && this.subscriptionId) {
      this.stop();
    }

    const sub = eventBus.subscribe('#', (event: DomainEvent) => {
      this.handleEvent(event);
    });

    this.subscriptionId = sub.id;
    this.isSubscribed = true;
  }

  /**
   * Interrompe o consumo
   */
  public stop(): void {
    if (this.subscriptionId) {
      eventBus.unsubscribe({ id: this.subscriptionId });
    }
    this.isSubscribed = false;
    this.subscriptionId = undefined;
  }

  /**
   * Processa o evento registrando no histórico de auditoria
   */
  public handleEvent(event: DomainEvent): void {
    const record: AuditRecord = {
      id: `audit-${event.id}`,
      eventId: event.id,
      eventType: event.type,
      tenantId: event.tenantId,
      sessionId: event.sessionId,
      userId: event.userId,
      occurredAt: event.occurredAt,
      source: event.source,
      correlationId: event.correlationId,
      sanitizedPayload: this.sanitizePayload(event.payload),
      recordedAt: new Date().toISOString()
    };

    this.auditHistory.push(record);
    if (this.auditHistory.length > this.maxRecords) {
      this.auditHistory.shift();
    }
  }

  /**
   * Consulta registros de auditoria com suporte a filtros e limites
   */
  public getAuditLogs(filter?: AuditFilter): AuditRecord[] {
    let results = [...this.auditHistory];

    if (filter?.tenantId) {
      results = results.filter(r => r.tenantId === filter.tenantId);
    }
    if (filter?.sessionId) {
      results = results.filter(r => r.sessionId === filter.sessionId);
    }
    if (filter?.eventType) {
      results = results.filter(r => r.eventType === filter.eventType);
    }
    if (filter?.correlationId) {
      results = results.filter(r => r.correlationId === filter.correlationId);
    }

    const limit = filter?.limit ?? 50;
    return results.slice(-limit);
  }

  /**
   * Limpa o buffer de auditoria
   */
  public clearAuditLogs(): void {
    this.auditHistory = [];
  }
}

export const auditConsumer = new AuditConsumer();
