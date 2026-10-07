/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MULTI-TIER RATE LIMITER (FASE 11)
 * Rate limiting em janela deslizante por IP, por Tenant, por Papel (RBAC),
 * por Ferramenta e por streaming de Voz.
 */

import { RateLimitCheckResult, RateLimitRule } from './types.js';
import { maiaPromptShield } from './promptShield.js';

/**
 * Modo operacional do Rate Limiter da MaIA: estritamente local à instância (não distribuído)
 * Prompt 14.3 - Seção 20
 */
export const RATE_LIMIT_MODE = 'INSTANCE_LOCAL';

interface RequestBucket {
  timestamps: number[];
}

export class MaiaRateLimiter {
  private buckets = new Map<string, RequestBucket>();

  // Limites padrão
  private defaultLimits: Record<string, RateLimitRule> = {
    ip: { keyPrefix: 'ip', maxRequests: 120, windowMs: 60000 }, // 120 req/min por IP
    tenant: { keyPrefix: 'tenant', maxRequests: 600, windowMs: 60000 }, // 600 req/min por Tenant
    participant: { keyPrefix: 'role:participant', maxRequests: 30, windowMs: 60000 }, // 30 req/min para participante
    controller: { keyPrefix: 'role:controller', maxRequests: 180, windowMs: 60000 }, // 180 req/min para controlador
    tool_critical: { keyPrefix: 'tool:critical', maxRequests: 10, windowMs: 60000 }, // 10 req/min para ferramentas críticas
    tool_ai: { keyPrefix: 'tool:ai', maxRequests: 40, windowMs: 60000 }, // 40 chamadas LLM/min
    voice_audio: { keyPrefix: 'voice:audio', maxRequests: 120, windowMs: 60000 } // 120 chunks/min
  };

  /**
   * Avalia uma chave contra a regra de rate limit
   */
  public checkLimit(key: string, rule: RateLimitRule): RateLimitCheckResult {
    const now = Date.now();
    const fullKey = `${rule.keyPrefix}:${key}`;
    const windowStart = now - rule.windowMs;

    let bucket = this.buckets.get(fullKey);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(fullKey, bucket);
    }

    // Purga timestamps fora da janela deslizante
    bucket.timestamps = bucket.timestamps.filter(ts => ts > windowStart);

    if (bucket.timestamps.length >= rule.maxRequests) {
      maiaPromptShield.incrementRateLimit();
      const oldestTs = bucket.timestamps[0];
      const resetTimeMs = oldestTs + rule.windowMs;
      const retryAfterSec = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
        retryAfterSec
      };
    }

    bucket.timestamps.push(now);

    return {
      allowed: true,
      remaining: rule.maxRequests - bucket.timestamps.length,
      resetTimeMs: now + rule.windowMs
    };
  }

  /**
   * Atalhos específicos para os perfis do sistema
   */
  public checkIp(ip: string, customLimit?: number): RateLimitCheckResult {
    const rule = { ...this.defaultLimits.ip };
    if (customLimit) rule.maxRequests = customLimit;
    return this.checkLimit(ip || '127.0.0.1', rule);
  }

  public checkTenant(tenantId: string, customLimit?: number): RateLimitCheckResult {
    const rule = { ...this.defaultLimits.tenant };
    if (customLimit) rule.maxRequests = customLimit;
    return this.checkLimit(tenantId || 'tenant-default', rule);
  }

  public checkRole(actorRole: string, actorId: string): RateLimitCheckResult {
    const roleKey = (actorRole || '').toUpperCase();
    const rule = roleKey === 'CONTROLLER' || roleKey === 'SUPERVISOR'
      ? this.defaultLimits.controller
      : this.defaultLimits.participant;

    return this.checkLimit(`${roleKey}:${actorId || 'anon'}`, rule);
  }

  public checkTool(toolName: string, riskLevel: string, tenantId: string): RateLimitCheckResult {
    const isCritical = riskLevel === 'CRITICAL' || riskLevel === 'HIGH';
    const rule = isCritical ? this.defaultLimits.tool_critical : this.defaultLimits.tool_ai;
    return this.checkLimit(`${tenantId}:${toolName}`, rule);
  }

  public checkVoiceAudio(sessionId: string): RateLimitCheckResult {
    return this.checkLimit(sessionId, this.defaultLimits.voice_audio);
  }

  /**
   * Limpa registros expirados em segundo plano
   */
  public purgeExpired(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter(ts => now - ts < 120000);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

export const maiaRateLimiter = new MaiaRateLimiter();
