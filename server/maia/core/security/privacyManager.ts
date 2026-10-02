/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PRIVACY & LGPD COMPLIANCE MANAGER (FASE 11)
 * Implementação dos direitos do titular (LGPD/GDPR):
 * - Direito ao Esquecimento / Expurgo de dados (Purge)
 * - Anonimização de histórico
 * - Auditoria estrita contra vazamento de PII em TVSessionDTO e saídas públicas
 */

import { LGPDPurgeRequest, LGPDPurgeResult } from './types.js';
import { maiaMemoryEngine } from '../memory/memoryEngine.js';
import { db } from '../../../db.js';
import { maiaPromptShield } from './promptShield.js';
import { MaiaSecurityError } from '../errors.js';

export class MaiaPrivacyManager {
  private static readonly FORBIDDEN_TV_PII_KEYS = [
    'phone',
    'telefone',
    'whatsapp',
    'token',
    'password',
    'hash',
    'cpf',
    'secret',
    'participantphone',
    'participant_phone'
  ];

  /**
   * Valida rigorosamente se um TVSessionDTO está em conformidade com as regras de privacidade
   * e não contém nenhum dado pessoal sensível ou token de segurança.
   */
  public static validateTVSessionDTO(dto: unknown): { isCompliant: boolean; violations: string[] } {
    const violations: string[] = [];

    if (!dto || typeof dto !== 'object') {
      return { isCompliant: true, violations: [] };
    }

    const checkNode = (node: unknown, path: string = 'root') => {
      if (node === null || node === undefined) return;
      if (typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach((item, index) => checkNode(item, `${path}[${index}]`));
        return;
      }

      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (this.FORBIDDEN_TV_PII_KEYS.includes(lowerKey)) {
          violations.push(`Campo PII proibido detectado no TVSessionDTO: '${path}.${key}'`);
        }
        if (typeof value === 'object' && value !== null) {
          checkNode(value, `${path}.${key}`);
        }
      }
    };

    checkNode(dto);

    return {
      isCompliant: violations.length === 0,
      violations
    };
  }

  /**
   * Executa a rotina de exclusão e expurgo de dados de participante (Direito ao Esquecimento - LGPD)
   */
  public static async purgeParticipantData(request: LGPDPurgeRequest): Promise<LGPDPurgeResult> {
    const { tenantId, participantId } = request;
    if (!tenantId || !participantId) {
      throw new MaiaSecurityError('tenantId e participantId são estritamente obrigatórios para expurgo LGPD.');
    }

    let removedMemories = 0;
    let removedHistoryTurns = 0;
    let anonymizedQueueItems = 0;

    // 1. Expurga memórias e histórico de conversação no Memory Engine
    if (typeof (maiaMemoryEngine as any).purgeParticipantData === 'function') {
      const memResult = await (maiaMemoryEngine as any).purgeParticipantData(tenantId, participantId);
      removedMemories = memResult.removedMemories || 0;
      removedHistoryTurns = memResult.removedTurns || 0;
    }

    // 2. Anonimiza registros de fila no banco em memória
    for (const item of db.queue) {
      if (item.participantId === participantId) {
        item.participantDisplayName = 'Participante Anônimo (LGPD)';
        (item as any).participantPhone = undefined;
        anonymizedQueueItems++;
      }
    }

    maiaPromptShield.incrementLgpdPurge();

    return {
      tenantId,
      participantId,
      removedMemories,
      anonymizedQueueItems,
      removedHistoryTurns,
      timestamp: new Date().toISOString(),
      success: true
    };
  }
}
