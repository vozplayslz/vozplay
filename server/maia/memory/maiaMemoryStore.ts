/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONTEXT MEMORY STORE (ADAPTER CONSOLIDADO)
 * Adaptador de compatibilidade que delega o histórico conversacional ao
 * MemoryEngine oficial do MaIA Core (server/maia/core/memory/memoryEngine.ts).
 * 
 * Regra Arquitetural (Prompt 14 - Seção 6):
 * Única fonte de verdade para memória de sessão e histórico conversacional.
 */

import { maiaMemoryEngine } from '../core/memory/memoryEngine.js';

export interface MaiaConversationTurn {
  id: string;
  role: 'user' | 'maia';
  text: string;
  timestamp: string;
}

export interface MaiaContextMemory {
  establishmentId: string;
  sessionId: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  turns: MaiaConversationTurn[];
  lastInteractionAt: string;
}

class MaiaMemoryStore {
  /**
   * Adiciona uma mensagem ao histórico conversacional delegando ao maiaMemoryEngine
   */
  public addTurn(
    establishmentId: string,
    sessionId: string,
    actorRole: string,
    actorId: string,
    actorName: string,
    turn: { role: 'user' | 'maia'; text: string }
  ) {
    const actorKey = `${actorRole}:${actorId || 'anon'}`;
    maiaMemoryEngine.addConversationTurn(establishmentId, sessionId, actorKey, {
      role: turn.role,
      content: turn.text
    });
  }

  /**
   * Retorna os turnos recentes formatados consultando o maiaMemoryEngine oficial
   */
  public getRecentHistory(
    establishmentId: string,
    sessionId: string,
    actorRole: string,
    actorId = 'anon'
  ): string {
    const actorKey = `${actorRole}:${actorId || 'anon'}`;
    // Executa busca síncrona consultando a store oficial do maiaMemoryEngine
    const turns = maiaMemoryEngine.getConversationTurnsSync(establishmentId, sessionId, actorKey);
    if (!turns || turns.length === 0) return '';

    return turns
      .map(t => `${t.role === 'user' ? 'Usuário' : 'MaIA Karaokê'}: ${t.text}`)
      .join('\n');
  }

  /**
   * Limpa memórias de sessões encerradas no maiaMemoryEngine oficial
   */
  public clearSessionMemory(sessionId: string, establishmentId = 'est-slz-lounge') {
    maiaMemoryEngine.clearSessionMemory(establishmentId, sessionId);
  }
}

export const maiaMemoryStore = new MaiaMemoryStore();
