/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA TOOL AUDIT LOGGER
 * Registro estruturado de execuções de ferramentas e auditoria de negativas de segurança.
 * Não vaza segredos, senhas ou dados confidenciais nos logs.
 */

import { randomUUID } from 'crypto';
import { MaiaToolAuditRecord } from './types.js';
import { ContextSanitizer } from '../context/contextSanitizer.js';

export class ToolAuditLogger {
  private auditHistory: MaiaToolAuditRecord[] = [];
  private readonly maxRecords: number;

  constructor(options?: { maxRecords?: number }) {
    this.maxRecords = options?.maxRecords || 200;
  }

  /**
   * Registra um evento de auditoria de ferramenta
   */
  public log(entry: Omit<MaiaToolAuditRecord, 'id' | 'timestamp'>): MaiaToolAuditRecord {
    const record: MaiaToolAuditRecord = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      inputSummary: entry.inputSummary ? ContextSanitizer.sanitizeData(entry.inputSummary, false) : undefined
    };

    this.auditHistory.push(record);
    if (this.auditHistory.length > this.maxRecords) {
      this.auditHistory.shift();
    }

    return record;
  }

  /**
   * Consulta registros de auditoria com filtros
   */
  public query(filters?: {
    toolId?: string;
    tenantId?: string;
    status?: MaiaToolAuditRecord['status'];
    limit?: number;
  }): MaiaToolAuditRecord[] {
    let list = this.auditHistory;

    if (filters?.toolId) {
      list = list.filter(r => r.toolId === filters.toolId);
    }
    if (filters?.tenantId) {
      list = list.filter(r => r.tenantId === filters.tenantId);
    }
    if (filters?.status) {
      list = list.filter(r => r.status === filters.status);
    }

    const limit = filters?.limit || 50;
    return list.slice(-limit);
  }

  /**
   * Limpa o histórico de auditoria
   */
  public clear(): void {
    this.auditHistory = [];
  }
}

export const toolAuditLogger = new ToolAuditLogger();
