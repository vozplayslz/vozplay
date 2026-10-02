/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA EMERGENCY STOP & HUMAN TAKEOVER (PROMPT 10 - Seções 27 e 28)
 * Mecanismo de infraestrutura determinístico, externo ao LLM, para interrupção
 * imediata e assunção humana de tarefas autônomas.
 * 
 * Princípios Fundamentais:
 * 1. A MaIA JAMAIS disputa controle com o operador humano.
 * 2. O comando de parada (MaIA STOP) NÃO depende do modelo para ser acatado.
 */

import { MaiaAutonomyEmergencyStopActiveError } from './errors.js';

export interface HumanTakeoverRecord {
  tenantId: string;
  sessionId?: string;
  operatorId: string;
  reason: string;
  timestamp: string;
  affectedTaskIds: string[];
}

export class MaiaEmergencyStop {
  private globalStop = false;
  private tenantStops = new Set<string>();
  private takeovers: HumanTakeoverRecord[] = [];

  /**
   * Ativa a Parada de Emergência (Emergency Stop)
   */
  public triggerEmergencyStop(tenantId?: string, reason = 'Parada de emergência acionada pelo operador'): void {
    if (tenantId) {
      this.tenantStops.add(tenantId);
    } else {
      this.globalStop = true;
    }
  }

  /**
   * Desativa a Parada de Emergência e rearma o sistema
   */
  public resetEmergencyStop(tenantId?: string): void {
    if (tenantId) {
      this.tenantStops.delete(tenantId);
    } else {
      this.globalStop = false;
      this.tenantStops.clear();
    }
  }

  /**
   * Verifica se a parada de emergência está ativa para o tenant
   */
  public isEmergencyStopActive(tenantId?: string): boolean {
    if (this.globalStop) return true;
    if (tenantId && this.tenantStops.has(tenantId)) return true;
    return false;
  }

  /**
   * Assegura que o sistema não está em parada de emergência
   */
  public assertNotStopped(tenantId?: string): void {
    if (this.isEmergencyStopActive(tenantId)) {
      throw new MaiaAutonomyEmergencyStopActiveError(
        `Parada de emergência ativa para ${tenantId ? `'${tenantId}'` : 'sistema global'}. Ações autônomas suspensas.`
      );
    }
  }

  /**
   * Registra uma assunção humana (Human Takeover)
   * O operador assume a fila ou controle; todas as tarefas autônomas ativas são paradas.
   */
  public recordTakeover(record: HumanTakeoverRecord): void {
    this.takeovers.push(record);
    if (this.takeovers.length > 100) this.takeovers.shift();
  }

  public getRecentTakeovers(tenantId?: string): HumanTakeoverRecord[] {
    if (!tenantId) return [...this.takeovers];
    return this.takeovers.filter(t => t.tenantId === tenantId);
  }
}

export const maiaEmergencyStop = new MaiaEmergencyStop();
