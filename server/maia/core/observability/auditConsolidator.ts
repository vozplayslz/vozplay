/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONSOLIDATED AUDIT SERVICE (FASE 11)
 * Trilha de auditoria centralizada para segurança, ferramentas, autonomia,
 * provedores de IA e conformidade LGPD com isolamento multi-tenant.
 */

import { randomUUID } from 'crypto';
import { ConsolidatedAuditEntry, AuditQueryOptions } from './types.js';

export class MaiaAuditConsolidator {
  private entries: ConsolidatedAuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 2000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Registra uma nova entrada na trilha de auditoria
   */
  public record(entry: Omit<ConsolidatedAuditEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ConsolidatedAuditEntry {
    const record: ConsolidatedAuditEntry = {
      id: entry.id || `audit-${randomUUID()}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      tenantId: entry.tenantId || 'tenant-default',
      source: entry.source || 'system',
      category: entry.category,
      action: entry.action,
      actor: entry.actor || {},
      status: entry.status,
      details: entry.details || {}
    };

    this.entries.unshift(record);
    if (this.entries.length > this.maxEntries) {
      this.entries.pop();
    }

    return record;
  }

  /**
   * Consulta auditoria com filtros multi-tenant rigorosos
   */
  public query(options: AuditQueryOptions): { total: number; entries: ConsolidatedAuditEntry[] } {
    let filtered = this.entries;

    // Isolamento multi-tenant
    if (options.tenantId) {
      filtered = filtered.filter(e => e.tenantId === options.tenantId);
    }

    if (options.actorId) {
      filtered = filtered.filter(e => e.actor.id === options.actorId);
    }

    if (options.eventType) {
      filtered = filtered.filter(e => e.action.includes(options.eventType!));
    }

    if (options.startTime) {
      const start = new Date(options.startTime).getTime();
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= start);
    }

    if (options.endTime) {
      const end = new Date(options.endTime).getTime();
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= end);
    }

    const total = filtered.length;
    const offset = Math.max(0, options.offset || 0);
    const limit = Math.min(Math.max(1, options.limit || 50), 200);

    return {
      total,
      entries: filtered.slice(offset, offset + limit)
    };
  }

  /**
   * Expurga registros de um tenant (atendimento LGPD ou desativação de conta)
   */
  public purgeTenantAudit(tenantId: string): number {
    const initial = this.entries.length;
    this.entries = this.entries.filter(e => e.tenantId !== tenantId);
    return initial - this.entries.length;
  }

  public getCount(): number {
    return this.entries.length;
  }
}

export const maiaAuditConsolidator = new MaiaAuditConsolidator();
