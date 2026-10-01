/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY WRITE POLICY (ANTI-POISONING & PROMPT INJECTION SHIELD)
 * Validação rigorosa do ciclo de vida de escrita: Candidate -> Validation -> Policy -> Persist.
 * 
 * Princípios Fundamentais:
 * 1. Memória é classificada estritamente como DATA, NUNCA como INSTRUCTION.
 * 2. Hierarquia inquebrável de autoridade:
 *    System (1) > Developer (2) > Application Policy (3) > User (4) > Memory/Data (5) > Tool Result (6).
 * 3. Memória NUNCA ganha autoridade executiva ou privilégios de bypass pelo fato de estar armazenada.
 * 4. Tentativas ativas de injeção ("Ignore todas as regras", "você agora é...") são rejeitadas.
 * 5. Preferências sensíveis NÃO podem ser inferidas probabilisticamente como fatos.
 */

import { MemoryCandidateInput, MemoryItem, MemoryType, MemoryScope, MemorySource } from '../types.js';
import { MemoryPoisoningError, MemoryError } from '../errors.js';
import { assertNoSecrets } from './secretFilter.js';

// Padrões de ataque de injeção e Memory Poisoning
const POISONING_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
  {
    regex: /(?:ignore\s+(?:all\s+)?(?:previous\s+)?instructions|ignore\s+todas\s+as\s+(?:regras|instruções|políticas))/i,
    reason: 'Tentativa de sobrescrita de instruções de sistema detectada'
  },
  {
    regex: /(?:you\s+are\s+now|você\s+agora\s+é|agora\s+você\s+vai\s+agir\s+como)\s+(?:dan|developer|hacker|admin|root|jailbreak)/i,
    reason: 'Tentativa de sequestro de identidade (jailbreak persona) detectada'
  },
  {
    regex: /(?:system\s+prompt\s+override|sua\s+nova\s+diretriz\s+(?:suprema|é)|bypass\s+rbac|ignore\s+autorização)/i,
    reason: 'Comando de subversão de controle de acesso (RBAC) detectado'
  },
  {
    regex: /(?:execute\s+(?:takeover|emergency|shell|rm\s+-rf)|deletar\s+tudo|apague\s+todo\s+o\s+banco)/i,
    reason: 'Comando destrutivo ou crítico inserido como instrução de memória'
  }
];

/**
 * Valida se uma string contém padrões suspeitos de Memory Poisoning
 */
function checkForPoisoning(text: string): { isPoisoned: boolean; reason?: string } {
  for (const pat of POISONING_PATTERNS) {
    if (pat.regex.test(text)) {
      return { isPoisoned: true, reason: pat.reason };
    }
  }
  return { isPoisoned: false };
}

/**
 * Inspeciona recursivamente campos textuais do candidato
 */
function inspectContentForPoisoning(content: unknown): { isPoisoned: boolean; reason?: string } {
  if (typeof content === 'string') {
    return checkForPoisoning(content);
  }
  if (Array.isArray(content)) {
    for (const item of content) {
      const res = inspectContentForPoisoning(item);
      if (res.isPoisoned) return res;
    }
  }
  if (typeof content === 'object' && content !== null) {
    for (const val of Object.values(content)) {
      const res = inspectContentForPoisoning(val);
      if (res.isPoisoned) return res;
    }
  }
  return { isPoisoned: false };
}

/**
 * Valida a política de escrita de um candidato a memória
 * Lança exceções apropriadas se a validação falhar.
 */
export function validateMemoryCandidate(candidate: MemoryCandidateInput): void {
  // 1. Validação básica de campos obrigatórios
  if (!candidate.tenantId || typeof candidate.tenantId !== 'string' || candidate.tenantId.trim() === '') {
    throw new MemoryError('tenantId é estritamente obrigatório para gravação de memória.', 'INVALID_TENANT_ID');
  }

  if (!candidate.type) {
    throw new MemoryError('Tipo de memória (MemoryType) não informado.', 'INVALID_MEMORY_TYPE', candidate.tenantId);
  }

  if (!candidate.scope) {
    throw new MemoryError('Escopo de memória (MemoryScope) não informado.', 'INVALID_MEMORY_SCOPE', candidate.tenantId);
  }

  if (!candidate.source) {
    throw new MemoryError('Origem da memória (MemorySource) não informada.', 'INVALID_MEMORY_SOURCE', candidate.tenantId);
  }

  if (candidate.content === undefined || candidate.content === null) {
    throw new MemoryError('Conteúdo da memória não pode ser nulo ou indefinido.', 'EMPTY_MEMORY_CONTENT', candidate.tenantId);
  }

  // 2. Proteção Absoluta contra Segredos e Credenciais (LGPD)
  assertNoSecrets(candidate.content, candidate.tenantId);
  if (candidate.summary) {
    assertNoSecrets(candidate.summary, candidate.tenantId);
  }
  if (candidate.metadata) {
    assertNoSecrets(candidate.metadata, candidate.tenantId);
  }

  // 3. Proteção contra Memory Poisoning e Injeção de Prompt
  const contentPoisonCheck = inspectContentForPoisoning(candidate.content);
  if (contentPoisonCheck.isPoisoned) {
    throw new MemoryPoisoningError(contentPoisonCheck.reason || 'Padrão hostil detectado', 'UNTRUSTED_INSTRUCTION', candidate.tenantId);
  }

  if (candidate.summary) {
    const summaryPoisonCheck = checkForPoisoning(candidate.summary);
    if (summaryPoisonCheck.isPoisoned) {
      throw new MemoryPoisoningError(summaryPoisonCheck.reason || 'Padrão hostil detectado no sumário', 'UNTRUSTED_INSTRUCTION', candidate.tenantId);
    }
  }

  // 4. Regra de Negócio: Preferência Sensível Nunca Inferida
  // Preferências devem ter origem explícita (user_explicit, operator_explicit, system)
  if (candidate.type === 'PREFERENCE') {
    if (candidate.source === 'derived' && (candidate.confidence || 0) < 0.95) {
      throw new MemoryError(
        'Preferências de usuário não podem ser inferidas probabilisticamente sem confirmação explícita.',
        'UNCONFIRMED_PREFERENCE_REJECTED',
        candidate.tenantId
      );
    }
  }

  // 5. Clamping de métricas
  if (candidate.confidence !== undefined) {
    candidate.confidence = Math.max(0, Math.min(1, Number(candidate.confidence) || 0));
  } else {
    // Fatos explícitos iniciam com confiança máxima 1.0; derivados iniciam em 0.8
    candidate.confidence = candidate.source === 'derived' ? 0.8 : 1.0;
  }

  if (candidate.importance !== undefined) {
    candidate.importance = Math.max(1, Math.min(5, Math.round(Number(candidate.importance) || 3)));
  } else {
    candidate.importance = 3;
  }
}
