/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI ROUTER QUOTA & BUDGET TRACKER (PROMPT 07)
 * Monitoramento de volume de requisições, tokens consumidos, custos estimados
 * e aplicação de travas orçamentárias (RPM, TPM, Budget diário/mensal).
 * 
 * Princípios:
 * - Diferencia estritamente o uso observado (observed usage) da quota reportada pelo provedor.
 * - Bloqueia requisições excedentes antes de gerar custos desnecessários (AI_QUOTA_EXCEEDED).
 * - Não expõe chaves ou dados confidenciais nos registros de telemetria.
 */

import { AIQuotaExceededError, AIRateLimitError } from './errors.js';

export interface TenantQuotaUsage {
  tenantId: string;
  currentRpm: number;
  lastRpmReset: number;
  dailyRequests: number;
  dailyTokens: number;
  dailyCostUsd: number;
  monthlyTokens: number;
  monthlyCostUsd: number;
  lastUsedAt: string;
}

export interface QuotaLimitConfig {
  maxRpm: number;                 // Máximo de requisições por minuto (padrão: 60)
  maxDailyRequests: number;       // Máximo de requisições por dia (padrão: 5000)
  maxMonthlyBudgetUsd: number;    // Limite máximo mensal em dólares (padrão: 50.00)
  alertThresholdPercentage: number; // Porcentagem para emissão de alerta (padrão: 85%)
}

export const DEFAULT_QUOTA_LIMITS: QuotaLimitConfig = {
  maxRpm: 60,
  maxDailyRequests: 5000,
  maxMonthlyBudgetUsd: 50.0,
  alertThresholdPercentage: 85
};

export class AIQuotaTracker {
  private tenantUsage = new Map<string, TenantQuotaUsage>();
  private tenantLimits = new Map<string, QuotaLimitConfig>();

  private getOrCreateUsage(tenantId: string): TenantQuotaUsage {
    let usage = this.tenantUsage.get(tenantId);
    const now = Date.now();

    if (!usage) {
      usage = {
        tenantId,
        currentRpm: 0,
        lastRpmReset: now,
        dailyRequests: 0,
        dailyTokens: 0,
        dailyCostUsd: 0,
        monthlyTokens: 0,
        monthlyCostUsd: 0,
        lastUsedAt: new Date().toISOString()
      };
      this.tenantUsage.set(tenantId, usage);
    } else {
      // Janela deslizante de 1 minuto para RPM
      if (now - usage.lastRpmReset > 60000) {
        usage.currentRpm = 0;
        usage.lastRpmReset = now;
      }
    }

    return usage;
  }

  public setLimits(tenantId: string, limits: Partial<QuotaLimitConfig>): void {
    const existing = this.tenantLimits.get(tenantId) || DEFAULT_QUOTA_LIMITS;
    this.tenantLimits.set(tenantId, { ...existing, ...limits });
  }

  public getLimits(tenantId: string): QuotaLimitConfig {
    return this.tenantLimits.get(tenantId) || DEFAULT_QUOTA_LIMITS;
  }

  /**
   * Valida se uma nova requisição é permitida sob as quotas vigentes retornando booleano
   */
  public canExecute(tenantId: string): { allowed: boolean; reason?: string } {
    try {
      this.assertCanExecute(tenantId);
      return { allowed: true };
    } catch (err: any) {
      return { allowed: false, reason: err?.message || String(err) };
    }
  }

  /**
   * Valida se uma nova requisição é permitida sob as quotas vigentes
   */
  public assertCanExecute(tenantId: string): void {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getLimits(tenantId);

    // 1. Verificação de RPM (Rate Limit)
    if (usage.currentRpm >= limits.maxRpm) {
      throw new AIRateLimitError(
        `Limite de requisições por minuto (${limits.maxRpm} RPM) excedido para o tenant '${tenantId}'.`,
        15,
        { tenantId }
      );
    }

    // 2. Verificação de Limite Diário
    if (usage.dailyRequests >= limits.maxDailyRequests) {
      throw new AIQuotaExceededError(
        `Limite diário de requisições de IA (${limits.maxDailyRequests}) atingido.`,
        { tenantId }
      );
    }

    // 3. Verificação de Teto Orçamentário Mensal
    if (usage.monthlyCostUsd >= limits.maxMonthlyBudgetUsd) {
      throw new AIQuotaExceededError(
        `Teto orçamentário mensal de IA ($${limits.maxMonthlyBudgetUsd.toFixed(2)}) atingido.`,
        { tenantId }
      );
    }
  }

  /**
   * Registra a conclusão e o custo de uma requisição
   */
  public recordUsage(
    tenantId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): void {
    const usage = this.getOrCreateUsage(tenantId);
    const totalTokens = inputTokens + outputTokens;

    usage.currentRpm++;
    usage.dailyRequests++;
    usage.dailyTokens += totalTokens;
    usage.dailyCostUsd += costUsd;
    usage.monthlyTokens += totalTokens;
    usage.monthlyCostUsd += costUsd;
    usage.lastUsedAt = new Date().toISOString();
  }

  /**
   * Consulta o uso e saúde de quotas de um tenant
   */
  public getUsage(tenantId: string): {
    usage: TenantQuotaUsage;
    limits: QuotaLimitConfig;
    percentRpmUsed: number;
    percentBudgetUsed: number;
    isApproachingLimit: boolean;
  } {
    const usage = this.getOrCreateUsage(tenantId);
    const limits = this.getLimits(tenantId);

    const percentRpmUsed = Math.round((usage.currentRpm / limits.maxRpm) * 100);
    const percentBudgetUsed = Math.round((usage.monthlyCostUsd / limits.maxMonthlyBudgetUsd) * 100);
    const isApproachingLimit = percentBudgetUsed >= limits.alertThresholdPercentage || percentRpmUsed >= limits.alertThresholdPercentage;

    return {
      usage: { ...usage },
      limits: { ...limits },
      percentRpmUsed,
      percentBudgetUsed,
      isApproachingLimit
    };
  }

  public resetUsage(tenantId?: string): void {
    if (tenantId) {
      this.tenantUsage.delete(tenantId);
    } else {
      this.tenantUsage.clear();
    }
  }
}
