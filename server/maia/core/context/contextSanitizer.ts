/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONTEXT SANITIZER & DATA MINIMIZER
 * Sanitização rigorosa de dados confidenciais, segregação de confiança (TRUSTED vs UNTRUSTED)
 * e congelamento imutável de snapshots (Object.freeze profundo).
 */

import { ContextTrustLevel } from './types.js';

export class ContextSanitizer {
  private static readonly SECRET_KEY_REGEX = 
    /password|secret|token|hash|auth|key|credentials|private|bearer/i;
  
  private static readonly PII_KEY_REGEX = 
    /whatsapp|telefone|phone|cpf|email|creditcard|rg/i;

  private static readonly PROMPT_INJECTION_INDICATORS = [
    /ignore (todas as|todas as suas|all|prior|previous) (instruções|instructions)/i,
    /(agora você é|você é|you are now|finja ser|seja) (um |uma )?(administrador|admin|supervisor|root|jarvis)/i,
    /me torne (administrador|admin|supervisor|root)/i,
    /execute (shutdown|drop|delete|reset|purge)/i,
    /give me full access/i
  ];

  /**
   * Sanitiza recursivamente objetos, expurgando chaves SECRET e mascarando PII
   */
  public static sanitizeData<T>(data: T, allowPii: boolean = false): T {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item, allowPii)) as unknown as T;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // 1. Chaves que contêm segredos são TERMINANTEMENTE removidas
      if (this.SECRET_KEY_REGEX.test(key)) {
        sanitized[key] = '[REDACTED_CONFIDENTIAL]';
        continue;
      }

      // 2. Chaves com PII são mascaradas caso allowPii seja falso
      if (!allowPii && this.PII_KEY_REGEX.test(key)) {
        sanitized[key] = '[REDACTED_CONFIDENTIAL]';
        continue;
      }

      // 3. Objetos aninhados
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value, allowPii);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  /**
   * Sanitiza texto vindo do usuário, identificando tentativas de context poisoning
   */
  public static sanitizeUserText(text: string): {
    cleanText: string;
    trust: ContextTrustLevel;
    potentialPoisoning: boolean;
  } {
    if (!text || typeof text !== 'string') {
      return { cleanText: '', trust: 'UNTRUSTED', potentialPoisoning: false };
    }

    // Limita tamanho para evitar ataques de estouro de contexto
    const cleanText = text.slice(0, 1000).trim();
    const potentialPoisoning = this.PROMPT_INJECTION_INDICATORS.some(pattern => pattern.test(cleanText));

    return {
      cleanText,
      trust: 'UNTRUSTED',
      potentialPoisoning
    };
  }

  /**
   * Congelamento profundo de um objeto tornando-o estritamente imutável
   */
  public static deepFreeze<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    Object.freeze(obj);

    for (const key of Object.getOwnPropertyNames(obj)) {
      const val = (obj as any)[key];
      if (val !== null && (typeof val === 'object' || typeof val === 'function') && !Object.isFrozen(val)) {
        this.deepFreeze(val);
      }
    }

    return obj;
  }
}
