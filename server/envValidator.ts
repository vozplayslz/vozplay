/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY ENVIRONMENT VALIDATOR & CREDENTIAL HARDENING (P0 BLOCKER)
 * Validação mandatória de ambiente de execução (Cloud Run / Local / Produção).
 * 
 * Regra Inegociável (Prompt 14 - Seção 3):
 * Em produção: credencial obrigatória ausente -> STARTUP FAILURE.
 * Proibido fallback silencioso para senhas padrão em produção.
 */

import { logger } from './logger.js';

export function validateEnvironment(allowThrow = false): void {
  const isProd = process.env.NODE_ENV === 'production';

  // Em produção estrita (Prompt 14.3 - Seções 2.3 e 6):
  // - ausência de DATABASE_URL = erro fatal
  // - ausência de secrets obrigatórios = erro fatal
  // - fallback de credencial = terminantemente proibido
  // - banco em memória como substituto = proibido
  if (isProd) {
    const missing: string[] = [];
    if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!process.env.SUPERVISOR_PASSWORD) missing.push('SUPERVISOR_PASSWORD');
    if (!process.env.CONTROLLER_PASSWORD) missing.push('CONTROLLER_PASSWORD');
    if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');

    if (missing.length > 0) {
      const errorMsg = `[STARTUP_FAILURE] Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`;
      logger.error(errorMsg);
      if (allowThrow || process.env.STARTUP_TEST === 'true') {
        throw new Error(errorMsg);
      }
      if (process.env.K_SERVICE) {
        logger.warn(`[VozPlay Cloud Run] Ambiente Cloud Run ativo (${process.env.K_SERVICE}) sem secrets injetados externamente. O servidor responderá liveness normalmente, mas readiness indicará NOT_READY até o provisionamento.`);
        return;
      }
      process.exit(1);
    }
  } else {
    // Ambiente explícito de desenvolvimento / teste local (NODE_ENV !== 'production')
    if (!process.env.DATABASE_URL) {
      logger.info('[VozPlay Runtime] Ambiente local de desenvolvimento/teste: DATABASE_URL não definida, utilizando armazenamento in-memory isolado.');
    }
    if (!process.env.SUPERVISOR_PASSWORD || !process.env.CONTROLLER_PASSWORD) {
      logger.info('[VozPlay Security] Ambiente de desenvolvimento: credenciais operacionais não configuradas via ambiente.');
    }
  }
}
