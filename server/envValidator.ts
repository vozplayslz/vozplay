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

  if (!process.env.DATABASE_URL) {
    logger.info('[VozPlay Runtime] DATABASE_URL não definida no ambiente. Operando com armazenamento in-memory sincronizado de alta resiliência.');
  }

  // Em produção estrita, abortar SEMPRE se faltarem credenciais obrigatórias (P0 BLOCKER)
  if (isProd) {
    const missing: string[] = [];
    if (!process.env.SUPERVISOR_PASSWORD) missing.push('SUPERVISOR_PASSWORD');
    if (!process.env.CONTROLLER_PASSWORD) missing.push('CONTROLLER_PASSWORD');

    if (missing.length > 0) {
      console.error('================================================================');
      console.error('  [FALHA DE STARTUP EM PRODUÇÃO — P0 BLOCKER]');
      console.error(`  Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
      console.error('  O sistema recusa iniciar com senhas default em ambiente de produção.');
      console.error('  Configure SUPERVISOR_PASSWORD e CONTROLLER_PASSWORD no arquivo .env');
      console.error('  ou nas variáveis de ambiente do orquestrador (Docker / Cloud Run).');
      console.error('================================================================');
      if (allowThrow || process.env.STARTUP_TEST === 'true') {
        throw new Error(`[STARTUP_FAILURE] Variáveis obrigatórias ausentes em produção: ${missing.join(', ')}`);
      }
      process.exit(1);
    }
  } else {
    // Ambiente explícito de desenvolvimento / teste (NODE_ENV !== 'production')
    if (!process.env.SUPERVISOR_PASSWORD) {
      process.env.SUPERVISOR_PASSWORD = 'VozPlay@SuperAdmin2026!SLZ';
      logger.info('[VozPlay Security] Ambiente de desenvolvimento: SUPERVISOR_PASSWORD não definida, utilizando credencial de teste.');
    }
    if (!process.env.CONTROLLER_PASSWORD) {
      process.env.CONTROLLER_PASSWORD = 'VozPlay@SoundDesk704!SLZ';
      logger.info('[VozPlay Security] Ambiente de desenvolvimento: CONTROLLER_PASSWORD não definida, utilizando credencial de teste.');
    }
  }
}
