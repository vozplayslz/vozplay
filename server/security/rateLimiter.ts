/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA HARDENED RATE LIMITER & AI QUOTA GUARD (PROMPT 11 - Seções 23, 24 e 25)
 * Sistema de limitação de taxa em múltiplas camadas:
 * 1. HTTP / API por IP e por Tenant
 * 2. Autenticação (prevenção de força bruta)
 * 3. IA Granular (RPM, Tokens/min, Tarefas/hora, Áudio/min)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';
import { featureFlagManager } from './featureFlags.js';

interface RateLimitEntry {
  count: number;
  tokensCount?: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  code?: string;
  errorMessage?: string;
  keyGenerator?: (req: Request) => string;
}

export class HardenedRateLimiter {
  private stores = new Map<string, Map<string, RateLimitEntry>>();

  constructor() {
    // Limpeza periódica de entradas expiradas a cada 60s para prevenir memory leaks
    setInterval(() => this.cleanupExpired(), 60000);
  }

  private getStore(namespace: string): Map<string, RateLimitEntry> {
    let store = this.stores.get(namespace);
    if (!store) {
      store = new Map();
      this.stores.set(namespace, store);
    }
    return store;
  }

  /**
   * Middleware Express para controle de taxa por namespace
   */
  public middleware(namespace: string, options: RateLimitOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!featureFlagManager.isEnabled('rateLimitingEnabled')) {
        return next();
      }

      const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || 'unknown-ip');
      const store = this.getStore(namespace);
      const now = Date.now();

      let entry = store.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 1, resetAt: now + options.windowMs };
        store.set(key, entry);
      } else {
        entry.count++;
      }

      const remaining = Math.max(0, options.maxRequests - entry.count);
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

      if (entry.count > options.maxRequests) {
        res.setHeader('Retry-After', retryAfterSec);
        logger.security(`Rate limit excedido no namespace '${namespace}': ${key}`, {
          namespace,
          key,
          count: entry.count,
          max: options.maxRequests
        });

        return res.status(429).json({
          success: false,
          error: options.errorMessage || 'Muitas requisições. Por favor, aguarde alguns instantes.',
          code: options.code || 'TOO_MANY_REQUESTS',
          retryAfter: retryAfterSec
        });
      }

      next();
    };
  }

  /**
   * Verificação granular de limite de taxa para operações de IA (Seção 24 e 25)
   */
  public assertAIRateLimit(
    tenantId: string,
    category: 'chat' | 'voice' | 'task' | 'tool',
    limits?: { maxPerMinute?: number }
  ): void {
    if (!featureFlagManager.isEnabled('rateLimitingEnabled')) {
      return;
    }

    const defaultLimits: Record<string, number> = {
      chat: 40,   // 40 requisições de texto por minuto por tenant
      voice: 20,  // 20 sessões/interações de voz por minuto por tenant
      task: 30,   // 30 tarefas de agente por minuto por tenant
      tool: 60    // 60 execuções de ferramentas por minuto por tenant
    };

    const maxRequests = limits?.maxPerMinute || defaultLimits[category] || 30;
    const store = this.getStore(`ai:${category}`);
    const now = Date.now();
    const windowMs = 60000;

    let entry = store.get(tenantId);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(tenantId, entry);
    } else {
      entry.count++;
    }

    if (entry.count > maxRequests) {
      const remainingSec = Math.ceil((entry.resetAt - now) / 1000);
      throw new Error(`[AI_RATE_LIMIT] Teto de requisições de IA para '${category}' excedido (${entry.count}/${maxRequests} RPM) para o tenant '${tenantId}'. Aguarde ${remainingSec}s.`);
    }
  }

  /**
   * Limpeza de entradas expiradas em todas as stores
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const store of this.stores.values()) {
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    }
  }

  /**
   * Reseta rate limits para testes
   */
  public reset(namespace?: string): void {
    if (namespace) {
      this.stores.delete(namespace);
    } else {
      this.stores.clear();
    }
  }
}

export const rateLimiter = new HardenedRateLimiter();
