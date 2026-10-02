/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI CIRCUIT BREAKER (PROMPT 07)
 * Proteção contra falhas em cascata para provedores de IA.
 * Estados:
 * - CLOSED: Operação normal (chamadas permitidas)
 * - OPEN: Falha repetitiva detectada (chamadas bloqueadas sem aguardar timeout)
 * - HALF_OPEN: Período de teste pós-cooldown (permitindo prova de recuperação)
 */

import { AIProviderUnavailableError } from './errors.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Número de falhas consecutivas para abrir o circuito (padrão: 5)
  cooldownPeriodMs: number; // Janela de descanso antes de passar para HALF_OPEN (padrão: 30s)
  successThreshold: number; // Sucessos consecutivos em HALF_OPEN para fechar (padrão: 2)
}

interface ProviderCircuitStats {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastStateChangeTime: number;
  totalCalls: number;
  totalFailures: number;
}

export class AICircuitBreaker {
  private circuits = new Map<string, ProviderCircuitStats>();
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      cooldownPeriodMs: config?.cooldownPeriodMs || 30000,
      successThreshold: config?.successThreshold || 2
    };
  }

  private getStats(providerId: string): ProviderCircuitStats {
    let stats = this.circuits.get(providerId);
    if (!stats) {
      stats = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastFailureTime: 0,
        lastStateChangeTime: Date.now(),
        totalCalls: 0,
        totalFailures: 0
      };
      this.circuits.set(providerId, stats);
    }
    return stats;
  }

  private syncState(stats: ProviderCircuitStats): CircuitState {
    const now = Date.now();
    if (stats.state === 'OPEN' && now - stats.lastFailureTime > this.config.cooldownPeriodMs) {
      stats.state = 'HALF_OPEN';
      stats.consecutiveSuccesses = 0;
      stats.lastStateChangeTime = now;
    }
    return stats.state;
  }

  /**
   * Verifica se uma chamada é permitida para o provedor
   * Lança AIProviderUnavailableError se o circuito estiver ABERTO
   */
  public assertCanCall(providerId: string): void {
    const stats = this.getStats(providerId);
    this.syncState(stats);

    if (stats.state === 'OPEN') {
      const remainingCooldownSec = Math.ceil((this.config.cooldownPeriodMs - (Date.now() - stats.lastFailureTime)) / 1000);
      throw new AIProviderUnavailableError(
        providerId,
        `Circuito ABERTO devido a falhas repetidas. Cooldown ativo por mais ${remainingCooldownSec}s.`
      );
    }
  }

  /**
   * Registra sucesso de execução de um provedor
   */
  public recordSuccess(providerId: string): void {
    const stats = this.getStats(providerId);
    this.syncState(stats);
    stats.totalCalls++;

    if (stats.state === 'HALF_OPEN') {
      stats.consecutiveSuccesses++;
      if (stats.consecutiveSuccesses >= this.config.successThreshold) {
        stats.state = 'CLOSED';
        stats.consecutiveFailures = 0;
        stats.consecutiveSuccesses = 0;
        stats.lastStateChangeTime = Date.now();
      }
    } else if (stats.state === 'CLOSED') {
      stats.consecutiveFailures = 0;
    }
  }

  /**
   * Registra falha de execução de um provedor
   */
  public recordFailure(providerId: string, error?: any): void {
    const stats = this.getStats(providerId);
    this.syncState(stats);
    const now = Date.now();
    stats.totalCalls++;
    stats.totalFailures++;
    stats.consecutiveFailures++;
    stats.lastFailureTime = now;

    if (stats.state === 'HALF_OPEN') {
      // Qualquer falha em HALF_OPEN reabre o circuito imediatamente
      stats.state = 'OPEN';
      stats.lastStateChangeTime = now;
    } else if (stats.state === 'CLOSED' && stats.consecutiveFailures >= this.config.failureThreshold) {
      stats.state = 'OPEN';
      stats.lastStateChangeTime = now;
    }
  }

  /**
   * Retorna o estado atual do circuito de um provedor
   */
  public getState(providerId: string): CircuitState {
    const stats = this.getStats(providerId);
    return this.syncState(stats);
  }

  /**
   * Retorna se o circuito está aberto para o provedor
   */
  public isOpen(providerId: string): boolean {
    return this.getState(providerId) === 'OPEN';
  }

  /**
   * Reseta o circuito de um provedor manualmente
   */
  public reset(providerId?: string): void {
    if (providerId) {
      this.circuits.delete(providerId);
    } else {
      this.circuits.clear();
    }
  }
}
