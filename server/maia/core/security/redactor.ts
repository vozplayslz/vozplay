/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SECRETS REDACTOR & DATA MASKING (FASE 11)
 * Mascaramento rigoroso de chaves, senhas, tokens Bearer, hashes Argon2id e PII
 * em logs, auditoria, telemetria e respostas voltadas ao usuário.
 */

export class MaiaRedactor {
  // Padrões de chaves e dados confidenciais
  private static readonly SECRET_KEY_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /hash/i,
    /auth/i,
    /key/i,
    /credential/i,
    /private/i,
    /bearer/i
  ];

  private static readonly PII_KEY_PATTERNS = [
    /cpf/i,
    /phone/i,
    /telefone/i,
    /whatsapp/i,
    /creditcard/i,
    /cartao/i,
    /document/i
  ];

  // Regex de valores no texto
  private static readonly PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
    // API Keys (ex: AIzaSy..., sk-...)
    { regex: /AIza[0-9A-Za-z-_]{35}/g, replacement: '[REDACTED_API_KEY]' },
    { regex: /sk-[0-9A-Za-z-_]{20,}/g, replacement: '[REDACTED_API_KEY]' },
    // Header Authorization: Bearer
    { regex: /Bearer\s+([A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*)/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
    { regex: /Bearer\s+[A-Za-z0-9\-_]{20,}/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
    // Hash Argon2id ($argon2id$v=19$m=...)
    { regex: /\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+/g, replacement: '[REDACTED_ARGON2_HASH]' },
    // CPF (123.456.789-00 ou 11 dígitos)
    { regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, replacement: '[REDACTED_CPF]' },
    // Telefones / WhatsApp (+55 (98) 98888-8888 ou variantes)
    { regex: /(\+?55\s?)?(\(?\d{2}\)?\s?)?(9\d{4}[-\s]?\d{4})\b/g, replacement: '[REDACTED_PHONE]' }
  ];

  /**
   * Sanitiza e mascara texto puro substituindo segredos por marcadores de segurança
   */
  public static redactText(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    for (const { regex, replacement } of this.PATTERNS) {
      result = result.replace(regex, replacement);
    }
    return result;
  }

  /**
   * Mascara recursivamente objetos, dicionários e listas (clonagem profunda sem mutação)
   */
  public static redactObject<T>(data: T, maskPii: boolean = true): T {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') {
      if (typeof data === 'string') {
        return this.redactText(data) as unknown as T;
      }
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.redactObject(item, maskPii)) as unknown as T;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // 1. Chaves que indicam segredos
      if (this.SECRET_KEY_PATTERNS.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED_SECRET]';
        continue;
      }

      // 2. Chaves que indicam PII (LGPD)
      if (maskPii && this.PII_KEY_PATTERNS.some(pattern => pattern.test(key))) {
        sanitized[key] = '[REDACTED_PII]';
        continue;
      }

      // 3. Processamento recursivo
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.redactObject(value, maskPii);
      } else if (typeof value === 'string') {
        sanitized[key] = this.redactText(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }
}
