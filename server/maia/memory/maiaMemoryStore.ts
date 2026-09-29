/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONTEXT MEMORY STORE
 * Armazenamento estruturado de memória de conversação e contexto recente da MaIA Karaokê.
 * Isolado estritamente por estabelecimento, sessão e ator (participante/operador).
 */

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
  private memoryMap: Map<string, MaiaContextMemory> = new Map();
  private readonly maxTurnsPerActor = 8;
  private readonly ttlMs = 1000 * 60 * 60 * 4; // 4 horas

  private buildKey(establishmentId: string, sessionId: string, actorRole: string, actorId = 'anon'): string {
    return `${establishmentId}:${sessionId}:${actorRole}:${actorId}`;
  }

  /**
   * Adiciona uma mensagem ao histórico conversacional do ator
   */
  public addTurn(
    establishmentId: string,
    sessionId: string,
    actorRole: string,
    actorId: string,
    actorName: string,
    turn: { role: 'user' | 'maia'; text: string }
  ) {
    const key = this.buildKey(establishmentId, sessionId, actorRole, actorId);
    let record = this.memoryMap.get(key);

    if (!record) {
      record = {
        establishmentId,
        sessionId,
        actorId,
        actorRole,
        actorName,
        turns: [],
        lastInteractionAt: new Date().toISOString()
      };
      this.memoryMap.set(key, record);
    }

    record.turns.push({
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: turn.role,
      text: turn.text,
      timestamp: new Date().toISOString()
    });

    if (record.turns.length > this.maxTurnsPerActor) {
      record.turns.shift();
    }

    record.lastInteractionAt = new Date().toISOString();
  }

  /**
   * Retorna os turnos recentes formatados para enriquecimento de contexto
   */
  public getRecentHistory(
    establishmentId: string,
    sessionId: string,
    actorRole: string,
    actorId = 'anon'
  ): string {
    const key = this.buildKey(establishmentId, sessionId, actorRole, actorId);
    const record = this.memoryMap.get(key);
    if (!record || record.turns.length === 0) return '';

    return record.turns
      .map(t => `${t.role === 'user' ? 'Usuário' : 'MaIA Karaokê'}: ${t.text}`)
      .join('\n');
  }

  /**
   * Limpa memórias expiradas ou de sessões encerradas
   */
  public clearSessionMemory(sessionId: string) {
    for (const [key, mem] of this.memoryMap.entries()) {
      if (mem.sessionId === sessionId) {
        this.memoryMap.delete(key);
      }
    }
  }
}

export const maiaMemoryStore = new MaiaMemoryStore();
