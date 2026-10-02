/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA EVENT GUARD & ANTI-POISONING FILTER (FASE 11)
 * Validação de integridade de envelope de eventos, prevenção contra injeção de eventos,
 * verificação estrita de origem confiável para tópicos administrativos e sanitização de payload.
 */

import { DomainEvent } from '../events/types.js';
import { MaiaSecurityError, MaiaValidationError } from '../errors.js';
import { maiaPromptShield } from './promptShield.js';

// Lista de fontes autorizadas a emitir eventos administrativos e críticos
const TRUSTED_ADMIN_SOURCES = new Set([
  'system',
  'system_admin',
  'supervisor',
  'auth-engine',
  'MaiaEmergencyStop',
  'MaiaAutonomyCoordinator',
  'MaiaAgentRuntime'
]);

// Padrões de tipos de eventos restritos (exigem origem confiável)
const RESTRICTED_EVENT_PATTERNS = [
  /^admin\./i,
  /^security\./i,
  /^config\./i,
  /^system\.shutdown/i,
  /^system\.purge/i,
  /^maia\.autonomy\.emergency_stop/i,
  /^maia\.autonomy\.takeover/i
];

export class MaiaEventGuard {
  /**
   * Valida envelope e proveniência de um evento antes de ser publicado no barramento
   */
  public static validateEvent<T = any>(event: DomainEvent<T>): void {
    if (!event || typeof event !== 'object') {
      maiaPromptShield.incrementEventPoisoning();
      throw new MaiaValidationError('Evento inválido: envelope nulo ou em formato não reconhecido.');
    }

    const eventType = event.type || event.name;
    if (!eventType || typeof eventType !== 'string' || eventType.trim() === '') {
      maiaPromptShield.incrementEventPoisoning();
      throw new MaiaValidationError('Evento inválido: o campo eventType/name é estritamente obrigatório.');
    }

    const source = (event.source || '').trim();
    if (!source) {
      maiaPromptShield.incrementEventPoisoning();
      throw new MaiaValidationError('Evento inválido: o campo source é obrigatório.');
    }

    // 1. Verificação de Tópicos Administrativos Restritos
    const isRestrictedTopic = RESTRICTED_EVENT_PATTERNS.some(pattern => pattern.test(eventType));
    if (isRestrictedTopic) {
      const isTrusted = TRUSTED_ADMIN_SOURCES.has(source.toLowerCase());
      if (!isTrusted) {
        maiaPromptShield.incrementEventPoisoning();
        throw new MaiaSecurityError(
          `Violação de segurança (Event Poisoning): A origem '${source}' não possui autoridade para emitir o evento administrativo restrito '${eventType}'.`
        );
      }
    }

    // 2. Proteção contra estouro de tamanho de payload (Anti-DoS)
    if (event.payload) {
      try {
        const payloadStr = JSON.stringify(event.payload);
        if (payloadStr.length > 50000) { // 50KB máximo por payload
          throw new MaiaSecurityError(`Payload do evento '${eventType}' excede o limite máximo permitido (50KB).`);
        }
      } catch (err) {
        if (err instanceof MaiaSecurityError) throw err;
        throw new MaiaValidationError(`Payload do evento '${eventType}' não é serializável em JSON válido.`);
      }
    }
  }

  /**
   * Higieniza dados de payload de eventos gerados a partir de interações de usuários
   */
  public static sanitizeEventPayload<T>(payload: T): T {
    if (payload === null || payload === undefined) return payload;
    if (typeof payload === 'string') {
      return maiaPromptShield.scan(payload).sanitizedInput as unknown as T;
    }
    return payload;
  }
}
