/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA QUOTA MANAGER & USAGE SEMAPHORE
 * Monitoramento contínuo de consumo, RPM, TPM, RPD, concorrência e custos.
 * Fornece o Semáforo de Quota visual (Normal, Atenção, Crítico, Esgotado) e aciona contingência/fallback.
 */

import {
  QuotaStatus,
  QuotaSource,
  ProviderQuotaReport,
  InternalQuotaLimits,
  MaIAProviderType,
  MaIATaskType
} from '../types.js';
import { aiAudit } from '../audit/aiAudit.js';
import { logger } from '../../logger.js';
import { maiaConfigManager } from '../config.js';

interface MinuteCounter {
  timestamp: number;
  requests: number;
  tokens: number;
}

export class MaiaQuotaManager {
  private requestLog: MinuteCounter[] = [];
  private dailyRequests: number = 0;
  private dailyTokensInput: number = 0;
  private dailyTokensOutput: number = 0;
  private daily429Hits: number = 0;
  private currentLiveConcurrency: number = 0;
  private lastResetDay: string = new Date().toISOString().slice(0, 10);
  private lastAlertLevel: QuotaStatus = 'NORMAL';

  // Limites operacionais internos
  private limits: InternalQuotaLimits = {
    daily_usd: 25.0,
    monthly_usd: 250.0,
    max_rpm: 60,
    max_rpd: 1500,
    warning_threshold: 70,
    critical_threshold: 85,
    exhausted_threshold: 95
  };

  constructor() {
    this.cleanStaleMinuteCounters();
  }

  private cleanStaleMinuteCounters() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestLog = this.requestLog.filter(c => c.timestamp >= oneMinuteAgo);

    // Reset diário automático
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastResetDay !== today) {
      this.dailyRequests = 0;
      this.dailyTokensInput = 0;
      this.dailyTokensOutput = 0;
      this.daily429Hits = 0;
      this.lastResetDay = today;
      this.lastAlertLevel = 'NORMAL';
    }
  }

  /**
   * Registra requisição bem-sucedida e tokens consumidos
   */
  public recordUsage(params: {
    establishmentId: string;
    provider: MaIAProviderType;
    task: MaIATaskType;
    model: string;
    tokensInput?: number;
    tokensOutput?: number;
    latencyMs: number;
  }) {
    this.cleanStaleMinuteCounters();

    const now = Date.now();
    const inTokens = params.tokensInput || 50;
    const outTokens = params.tokensOutput || 100;
    const totalTokens = inTokens + outTokens;

    this.requestLog.push({
      timestamp: now,
      requests: 1,
      tokens: totalTokens
    });

    this.dailyRequests++;
    this.dailyTokensInput += inTokens;
    this.dailyTokensOutput += outTokens;

    // Atualiza métricas no config manager do estabelecimento
    maiaConfigManager.recordUsage(
      params.establishmentId,
      params.task,
      params.model,
      params.latencyMs,
      true,
      false,
      inTokens,
      outTokens
    );

    // Avalia novo nível de semáforo
    this.evaluateAlerts(params.establishmentId, params.provider);
  }

  /**
   * Registra detecção de Rate Limit (HTTP 429 ou Quota Exceeded do provedor)
   */
  public recordRateLimitHit(establishmentId: string, provider: MaIAProviderType) {
    this.daily429Hits++;
    logger.warn(`[QuotaManager] HTTP 429 detectado para o provedor: ${provider}`);

    aiAudit.record({
      actor: 'QuotaManager',
      tenant_id: establishmentId,
      establishment_id: establishmentId,
      event_type: 'AI_QUOTA_EXHAUSTED',
      provider,
      reason: 'Rate limit (HTTP 429) detectado pelo provedor de IA.'
    });

    this.lastAlertLevel = 'EXHAUSTED';
  }

  /**
   * Concorrência de sessões de voz ao vivo
   */
  public adjustLiveConcurrency(delta: number) {
    this.currentLiveConcurrency = Math.max(0, this.currentLiveConcurrency + delta);
  }

  /**
   * Avalia a saúde da quota e dispara alertas automáticos para auditoria
   */
  private evaluateAlerts(establishmentId: string, provider: MaIAProviderType) {
    const report = this.getQuotaReport(establishmentId, provider);

    if (report.status === 'EXHAUSTED' && this.lastAlertLevel !== 'EXHAUSTED') {
      this.lastAlertLevel = 'EXHAUSTED';
      aiAudit.record({
        actor: 'QuotaManager',
        tenant_id: establishmentId,
        establishment_id: establishmentId,
        event_type: 'AI_QUOTA_EXHAUSTED',
        provider,
        reason: `Quota de IA esgotada (${report.overallPercentage.toFixed(1)}%). Fallback recomendado.`
      });
    } else if (report.status === 'CRITICAL' && this.lastAlertLevel !== 'CRITICAL' && this.lastAlertLevel !== 'EXHAUSTED') {
      this.lastAlertLevel = 'CRITICAL';
      aiAudit.record({
        actor: 'QuotaManager',
        tenant_id: establishmentId,
        establishment_id: establishmentId,
        event_type: 'AI_QUOTA_CRITICAL',
        provider,
        reason: `Consumo de IA atingiu nível crítico (${report.overallPercentage.toFixed(1)}%).`
      });
    } else if (report.status === 'WARNING' && this.lastAlertLevel === 'NORMAL') {
      this.lastAlertLevel = 'WARNING';
      aiAudit.record({
        actor: 'QuotaManager',
        tenant_id: establishmentId,
        establishment_id: establishmentId,
        event_type: 'AI_QUOTA_WARNING',
        provider,
        reason: `Consumo de IA atingiu nível de atenção (${report.overallPercentage.toFixed(1)}%).`
      });
    } else if (report.status === 'NORMAL') {
      this.lastAlertLevel = 'NORMAL';
    }
  }

  /**
   * Verifica se o estabelecimento pode executar uma nova chamada
   */
  public canExecute(establishmentId: string, task: MaIATaskType, provider: MaIAProviderType): {
    allowed: boolean;
    reason?: string;
    needsFallback?: boolean;
    status: QuotaStatus;
  } {
    this.cleanStaleMinuteCounters();

    // Se houve 429 recente, aciona fallback imediatamente
    if (this.daily429Hits > 0 && this.lastAlertLevel === 'EXHAUSTED') {
      return {
        allowed: false,
        reason: 'Provedor atual retornou Rate Limit 429 recentemente.',
        needsFallback: true,
        status: 'EXHAUSTED'
      };
    }

    const currentRpm = this.requestLog.reduce((acc, c) => acc + c.requests, 0);
    if (currentRpm >= this.limits.max_rpm) {
      return {
        allowed: false,
        reason: `Limite de requisições por minuto (${this.limits.max_rpm} RPM) atingido.`,
        needsFallback: true,
        status: 'CRITICAL'
      };
    }

    if (this.dailyRequests >= this.limits.max_rpd) {
      return {
        allowed: false,
        reason: `Limite diário de requisições (${this.limits.max_rpd} RPD) atingido.`,
        needsFallback: true,
        status: 'EXHAUSTED'
      };
    }

    return { allowed: true, status: this.lastAlertLevel };
  }

  /**
   * Gera relatório detalhado com Semáforo de Quota
   */
  public getQuotaReport(establishmentId = 'est-slz-lounge', provider: MaIAProviderType = 'gemini_enlace'): ProviderQuotaReport {
    this.cleanStaleMinuteCounters();

    const currentRpm = this.requestLog.reduce((acc, c) => acc + c.requests, 0);
    const currentTpm = this.requestLog.reduce((acc, c) => acc + c.tokens, 0);
    const maxTpm = 60000;

    const rpmPercent = Math.min(100, (currentRpm / this.limits.max_rpm) * 100);
    const tpmPercent = Math.min(100, (currentTpm / maxTpm) * 100);
    const rpdPercent = Math.min(100, (this.dailyRequests / this.limits.max_rpd) * 100);
    const concurrencyPercent = Math.min(100, (this.currentLiveConcurrency / 5) * 100);

    const overallPercentage = Math.max(rpmPercent, tpmPercent, rpdPercent);

    let status: QuotaStatus = 'NORMAL';
    let warningAlert: string | undefined = undefined;

    if (this.daily429Hits > 0 || overallPercentage >= this.limits.exhausted_threshold) {
      status = 'EXHAUSTED';
      warningAlert = 'Quota esgotada ou limite 429 detectado. O sistema acionou a contingência para não parar o karaokê.';
    } else if (overallPercentage >= this.limits.critical_threshold) {
      status = 'CRITICAL';
      warningAlert = 'Atenção crítica: o consumo de IA ultrapassou 85% da capacidade operacional.';
    } else if (overallPercentage >= this.limits.warning_threshold) {
      status = 'WARNING';
      warningAlert = 'Aviso: consumo de IA em nível moderado a alto (> 70%).';
    }

    const calcStatus = (pct: number): QuotaStatus => {
      if (pct >= this.limits.exhausted_threshold) return 'EXHAUSTED';
      if (pct >= this.limits.critical_threshold) return 'CRITICAL';
      if (pct >= this.limits.warning_threshold) return 'WARNING';
      return 'NORMAL';
    };

    const quotaSource: QuotaSource = this.daily429Hits > 0 ? 'DETECTED' : 'ESTIMATED';

    return {
      provider,
      displayName: provider === 'gemini_customer' ? 'Meu projeto Gemini' : provider === '9router' ? '9router Gateway' : 'Gemini Enlace (Padrão)',
      status,
      overallPercentage,
      warningAlert,
      rpm: {
        limit: this.limits.max_rpm,
        used: currentRpm,
        source: quotaSource,
        unit: 'req/min',
        status: calcStatus(rpmPercent),
        percentage: rpmPercent
      },
      tpm: {
        limit: maxTpm,
        used: currentTpm,
        source: quotaSource,
        unit: 'tokens/min',
        status: calcStatus(tpmPercent),
        percentage: tpmPercent
      },
      rpd: {
        limit: this.limits.max_rpd,
        used: this.dailyRequests,
        source: quotaSource,
        unit: 'req/dia',
        status: calcStatus(rpdPercent),
        percentage: rpdPercent
      },
      concurrency: {
        limit: 5,
        used: this.currentLiveConcurrency,
        source: 'ESTIMATED',
        unit: 'sessões simultâneas',
        status: calcStatus(concurrencyPercent),
        percentage: concurrencyPercent
      },
      lastCheckedAt: new Date().toISOString()
    };
  }

  /**
   * Retorna os limites configurados
   */
  public getLimits(): InternalQuotaLimits {
    return { ...this.limits };
  }

  /**
   * Atualiza limites configurados pelo Supervisor
   */
  public updateLimits(newLimits: Partial<InternalQuotaLimits>) {
    this.limits = { ...this.limits, ...newLimits };
  }

  /**
   * Reseta contador de 429 manualmente após validação de recuperação
   */
  public resetRateLimitStatus() {
    this.daily429Hits = 0;
    this.lastAlertLevel = 'NORMAL';
  }
}

export const maiaQuotaManager = new MaiaQuotaManager();
