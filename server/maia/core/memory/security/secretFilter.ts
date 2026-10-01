/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY SECRET FILTER (PRIVACY & LGPD COMPLIANCE)
 * Detecção, bloqueio e redação de credenciais, chaves de API, senhas, tokens e PII sensível.
 * Princípio: A memória NÃO deve armazenar segredos nem virar depósito de dados confidenciais.
 */

import { MemorySecretRejectedError } from '../errors.js';

interface SecretDetectionResult {
  hasSecret: boolean;
  pattern?: string;
  reason?: string;
}

// Expressões regulares para segredos conhecidos e tokens de alta sensibilidade
const SECRET_REGEX_PATTERNS: Array<{ name: string; regex: RegExp; reason: string }> = [
  {
    name: 'JWT_OR_BEARER',
    regex: /(?:bearer\s+)?[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}/i,
    reason: 'Token JWT / Bearer detectado no conteúdo'
  },
  {
    name: 'GEMINI_OR_GOOGLE_API_KEY',
    regex: /AIza[0-9A-Za-z-_]{35}/,
    reason: 'Chave de API do Google / Gemini detectada'
  },
  {
    name: 'GENERIC_API_KEY',
    regex: /(?:api[_-]?key|secret[_-]?key|auth[_-]?token)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/i,
    reason: 'Chave de API ou Token atribuído explicitamente'
  },
  {
    name: 'OPENAI_API_KEY',
    regex: /sk-(?:live|proj|test)?[a-zA-Z0-9]{32,}/,
    reason: 'Chave de API OpenAI detectada'
  },
  {
    name: 'GITHUB_TOKEN',
    regex: /gh[pousr]_[0-9a-zA-Z]{36}/,
    reason: 'Token de acesso GitHub detectado'
  },
  {
    name: 'PRIVATE_KEY',
    regex: /-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP|ENCRYPTED)?\s*PRIVATE\s+KEY-----/i,
    reason: 'Chave criptográfica privada detectada'
  },
  {
    name: 'PASSWORD_FIELD',
    regex: /(?:senha|password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/i,
    reason: 'Senha em texto puro detectada'
  },
  {
    name: 'PRESENCE_PIN_REVEAL',
    regex: /(?:código\s+(?:rotativo\s+)?de\s+presença[^0-9\n]{0,25}|presence[_-]?code[^0-9\n]{0,15}|mesa[_-]?pin[^0-9\n]{0,15})\b\d{4}\b/i,
    reason: 'Código rotativo de presença física (PIN) exposto'
  },
  {
    name: 'CREDIT_CARD',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
    reason: 'Número de cartão de crédito detectado'
  }
];

// Chaves de propriedades proibidas em objetos estruturados
const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'senha',
  'passwordhash',
  'password_hash',
  'secret',
  'jwt',
  'token',
  'authtoken',
  'auth_token',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'privatekey',
  'private_key',
  'creditcard',
  'credit_card'
]);

/**
 * Analisa recursivamente qualquer dado para identificar segredos e credenciais
 */
export function detectSecrets(data: unknown): SecretDetectionResult {
  if (data === null || data === undefined) {
    return { hasSecret: false };
  }

  // Análise de strings
  if (typeof data === 'string') {
    for (const pat of SECRET_REGEX_PATTERNS) {
      if (pat.regex.test(data)) {
        return {
          hasSecret: true,
          pattern: pat.name,
          reason: pat.reason
        };
      }
    }
    return { hasSecret: false };
  }

  // Análise de números e booleanos
  if (typeof data === 'number' || typeof data === 'boolean') {
    return { hasSecret: false };
  }

  // Análise de Arrays
  if (Array.isArray(data)) {
    for (const item of data) {
      const res = detectSecrets(item);
      if (res.hasSecret) return res;
    }
    return { hasSecret: false };
  }

  // Análise de Objetos
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEY_NAMES.has(normalizedKey)) {
        const val = obj[key];
        if (val !== undefined && val !== null && val !== '') {
          return {
            hasSecret: true,
            pattern: `SENSITIVE_KEY_${key.toUpperCase()}`,
            reason: `Propriedade confidencial '${key}' detectada no objeto de memória`
          };
        }
      }

      // Validação do valor da propriedade
      const res = detectSecrets(obj[key]);
      if (res.hasSecret) return res;
    }
  }

  return { hasSecret: false };
}

/**
 * Lança MemorySecretRejectedError se houver segredos detectados
 */
export function assertNoSecrets(data: unknown, tenantId?: string): void {
  const result = detectSecrets(data);
  if (result.hasSecret) {
    throw new MemorySecretRejectedError(result.reason || 'Dado confidencial detectado', result.pattern, tenantId);
  }
}

/**
 * Sanitiza recursivamente objetos, mascarando eventuais dados pessoais ou sensíveis residuais
 */
export function sanitizeSecrets(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    let sanitized = data;
    for (const pat of SECRET_REGEX_PATTERNS) {
      sanitized = sanitized.replace(pat.regex, '***REDACTED***');
    }
    return sanitized;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeSecrets(item));
  }
  if (typeof data === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEY_NAMES.has(normalizedKey)) {
        cleanObj[key] = '***REDACTED***';
      } else {
        cleanObj[key] = sanitizeSecrets(value);
      }
    }
    return cleanObj;
  }
  return data;
}
