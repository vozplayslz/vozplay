/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PERCEPTION STORE (PROMPT 05)
 * Armazenamento volátil em memória para registros de percepção da MaIA.
 * Garante isolamento estrito multi-tenant e retenção bounded em buffer circular.
 */

import { MaiaPerceptionRecord, PerceptionFilter } from './types.js';

export class PerceptionStore {
  // Mapa de registros indexados por tenantId para isolamento seguro
  private storeByTenant = new Map<string, MaiaPerceptionRecord[]>();
  private readonly maxRecordsPerTenant: number;

  constructor(options?: { maxRecordsPerTenant?: number }) {
    this.maxRecordsPerTenant = options?.maxRecordsPerTenant ?? 150;
  }

  /**
   * Adiciona um novo registro de percepção garantindo retenção máxima
   */
  public add(record: MaiaPerceptionRecord): void {
    const tenantId = record.tenantId || 'default';
    let records = this.storeByTenant.get(tenantId);
    if (!records) {
      records = [];
      this.storeByTenant.set(tenantId, records);
    }

    records.push(record);

    if (records.length > this.maxRecordsPerTenant) {
      records.shift();
    }
  }

  /**
   * Recupera percepções recentes com filtros opcionais
   */
  public getRecent(tenantId: string, limit: number = 20, filter?: PerceptionFilter): MaiaPerceptionRecord[] {
    const records = this.storeByTenant.get(tenantId) || [];
    let filtered = [...records];

    if (filter?.sessionId) {
      filtered = filtered.filter(r => r.sessionId === filter.sessionId);
    }

    if (filter?.relevance) {
      const allowed = Array.isArray(filter.relevance) ? filter.relevance : [filter.relevance];
      filtered = filtered.filter(r => allowed.includes(r.relevance));
    }

    if (filter?.category) {
      const allowed = Array.isArray(filter.category) ? filter.category : [filter.category];
      filtered = filtered.filter(r => allowed.includes(r.category));
    }

    if (filter?.candidateIntent) {
      filtered = filtered.filter(r => r.candidateIntent === filter.candidateIntent);
    }

    const effectiveLimit = Math.min(limit, filter?.limit ?? limit);
    return filtered.slice(-effectiveLimit);
  }

  /**
   * Retorna percepções pendentes para futuro consumo pelo Agent Runtime
   */
  public getPendingForAgent(tenantId: string): MaiaPerceptionRecord[] {
    const records = this.storeByTenant.get(tenantId) || [];
    return records.filter(r => r.status === 'QUEUED_FOR_AGENT');
  }

  /**
   * Atualiza o status de uma percepção
   */
  public markStatus(id: string, status: 'PERCEIVED' | 'QUEUED_FOR_AGENT' | 'DISCARDED'): boolean {
    for (const records of this.storeByTenant.values()) {
      const target = records.find(r => r.id === id);
      if (target) {
        target.status = status;
        return true;
      }
    }
    return false;
  }

  /**
   * Conta o total de registros armazenados
   */
  public count(tenantId?: string): number {
    if (tenantId) {
      return (this.storeByTenant.get(tenantId) || []).length;
    }
    let total = 0;
    for (const list of this.storeByTenant.values()) {
      total += list.length;
    }
    return total;
  }

  /**
   * Limpa percepções armazenadas
   */
  public clear(tenantId?: string): void {
    if (tenantId) {
      this.storeByTenant.delete(tenantId);
    } else {
      this.storeByTenant.clear();
    }
  }
}

export const perceptionStore = new PerceptionStore();
