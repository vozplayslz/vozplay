/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTONOMY CIRCUIT BREAKER (PROMPT 10 - Seção 29)
 * Mecanismo de proteção contra falhas repetidas, tempestades de eventos e loops proativos.
 * Estados:
 * - CLOSED: Operação normal permitida
 * - OPEN: Autonomia bloqueada preventivamente após falhas sucessivas
 * - HALF_OPEN: Janela de teste de restabelecimento
 */

import { AutonomyCircuitState, AutonomyCircuitStats } from './types.js';
import { MaiaAutonomyCircuitBreakerOpenError } from './errors.js';

export interface AutonomyCircuitBreakerConfig {
  failureThreshold: number; // Padrão: 3 falhas ou loops consecutivos
  cooldownPeriodMs: number; // Janela de resfriamento (padrão: 30s)
  successThreshold: number; // Sucessos em HALF_OPEN para fechar o circuito (padrão: 2)
}

export class AutonomyCircuitBreaker {
  private circuits = new Map<string, AutonomyCircuitStats>();
  private readonly config: AutonomyCircuitBreakerConfig;

  constructor(config?: Partial<AutonomyCircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 3,
      cooldownPeriodMs: config?.cooldownPeriodMs || 30000,
      successThreshold: config?.successThreshold || 2
    };
  }

  private getStats(tenantId: string): AutonomyCircuitStats {
    let stats = this.circuits.get(tenantId);
    if (!stats) {
      stats = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        consecutiveLoops: 0,
        lastFailureTime: 0,
        lastStateChangeTime: Date.now(),
        totalTriggersFired: 0,
        totalFailures: 0
      };
      this.circuits.set(tenantId, stats);
    }
    return stats;
  }

  private syncState(stats: AutonomyCircuitStats): AutonomyCircuitState {
    const now = Date.now();
    if (stats.state === 'OPEN' && now - stats.lastFailureTime > this.config.cooldownPeriodMs) {
      stats.state = 'HALF_OPEN';
      stats.lastStateChangeTime = now;
    }
    return stats.state;
  }

  /**
   * Assegura que a autonomia proativa pode ser executada para o tenant
   */
  public assertCanExecute(tenantId: string): void {
    const stats = this.getStats(tenantId);
    const state = this.syncState(stats);

    if (state === 'OPEN') {
      const remainingSec = Math.ceil((this.config.cooldownPeriodMs - (Date.now() - stats.lastFailureTime)) / 1000);
      throw new MaiaAutonomyCircuitBreakerOpenError(
        `Circuito de Autonomia ABERTO para '${tenantId}'. Bloqueio ativo por mais ${remainingSec}s devido a falhas consecutivas.`
      );
    }
  }

  /**
   * Retorna o estado do circuito
   */
  public getState(tenantId: string): AutonomyCircuitState {
    const stats = this.getStats(tenantId);
    return this.syncState(stats);
  }

  public isOpen(tenantId: string): boolean {
    return this.getState(tenantId) === 'OPEN';
  }

  /**
   * Registra um gatilho acionado com sucesso
   */
  public recordSuccess(tenantId: string): void {
    const stats = this.getStats(tenantId);
    this.syncState(stats);
    stats.totalTriggersFired++;

    if (stats.state === 'HALF_OPEN') {
      stats.consecutiveFailures = 0;
      stats.consecutiveLoops = 0;
      stats.state = 'CLOSED';
      stats.lastStateChangeTime = Date.now();
    } else if (stats.state === 'CLOSED') {
      stats.consecutiveFailures = 0;
      stats.consecutiveLoops = 0;
    }
  }

  /**
   * Registra falha ou loop em ação autônoma
   */
  public recordFailure(tenantId: string, isLoop = false): void {
    const stats = this.getStats(tenantId);
    this.syncState(stats);
    const now = Date.now();
    stats.totalFailures++;
    stats.consecutiveFailures++;
    if (isLoop) stats.consecutiveLoops++;
    stats.lastFailureTime = now;

    if (stats.state === 'HALF_OPEN' || stats.consecutiveFailures >= this.config.failureThreshold) {
      stats.state = 'OPEN';
      stats.lastStateChangeTime = now;
    }
  }

  /**
   * Reseta manualmente o circuito de um tenant
   */
  public reset(tenantId?: string): void {
    if (tenantId) {
      this.circuits.delete(tenantId);
    } else {
      this.circuits.clear();
    }
  }
}

export const autonomyCircuitBreaker = new AutonomyCircuitBreaker();
