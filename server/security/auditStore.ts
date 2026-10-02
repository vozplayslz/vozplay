/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA HARDENED AUDIT STORE & PII REDACTION (PROMPT 11 - Seções 32, 33, 35, 36 e 43)
 * Registro imutável de eventos de segurança, conformidade com a LGPD e sanitização de dados.
 */

import { randomUUID } from 'crypto';

export type SecurityAuditCategory = 
  | 'AUTH'
  | 'AUTHZ'
  | 'TENANT_VIOLATION'
  | 'IDOR_ATTEMPT'
  | 'PROMPT_INJECTION'
  | 'RATE_LIMIT'
  | 'CIRCUIT_BREAKER'
  | 'EMERGENCY_STOP'
  | 'HUMAN_TAKEOVER'
  | 'TOOL_EXECUTION'
  | 'LGPD_DATA_ACCESS';

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  category: SecurityAuditCategory;
  action: string;
  actorId?: string;
  actorRole?: string;
  tenantId: string;
  ip?: string;
  correlationId?: string;
  details: Record<string, unknown>;
  success: boolean;
}

export class SecurityAuditStore {
  private records: SecurityAuditRecord[] = [];
  private readonly maxRecords: number = 500;

  // Regex de padrões sensíveis para redaction imediata conforme LGPD
  private readonly SENSITIVE_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /bearer/i,
    /cpf/i,
    /rg/i,
    /card/i,
    /cvv/i,
    /whatsapp/i,
    /telefone/i,
    /phone/i
  ];

  /**
   * Sanitiza recursivamente valores de log mascarando PII e credenciais
   */
  public redactSensitive(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') {
      if (typeof data === 'string' && data.length > 300) {
        return data.slice(0, 300) + '...[TRUNCATED]';
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactSensitive(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = this.SENSITIVE_PATTERNS.some(p => p.test(key));
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED_CONFIDENTIAL]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.redactSensitive(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Registra um evento formal na trilha de auditoria
   */
  public log(entry: {
    category: SecurityAuditCategory;
    action: string;
    actorId?: string;
    actorRole?: string;
    tenantId?: string;
    ip?: string;
    correlationId?: string;
    details?: Record<string, unknown>;
    success?: boolean;
  }): SecurityAuditRecord {
    const record: SecurityAuditRecord = {
      id: `sec-audit-${randomUUID()}`,
      timestamp: new Date().toISOString(),
      category: entry.category,
      action: entry.action,
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      tenantId: entry.tenantId || 'global',
      ip: entry.ip || 'internal',
      correlationId: entry.correlationId || `corr-${randomUUID()}`,
      details: this.redactSensitive(entry.details || {}),
      success: entry.success !== false
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    return record;
  }

  /**
   * Consulta registros de auditoria filtrados por tenant
   */
  public getRecords(tenantId?: string, category?: SecurityAuditCategory): SecurityAuditRecord[] {
    let results = this.records;
    if (tenantId) {
      results = results.filter(r => r.tenantId === tenantId || r.tenantId === 'global');
    }
    if (category) {
      results = results.filter(r => r.category === category);
    }
    return [...results].reverse();
  }

  public clear(): void {
    this.records = [];
  }
}

export const securityAuditStore = new SecurityAuditStore();
