/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE MEMORY ENGINE
 * Gestão de memória em camadas: turno recente, sessão de trabalho e persistência de longo prazo.
 */

import { IMaiaMemoryStore, MaiaCoreConversationTurn, MaiaMemoryEntry, MaiaMemoryScope } from '../types.js';

export class InMemoryMaiaMemoryStore implements IMaiaMemoryStore {
  private keyValues = new Map<string, MaiaMemoryEntry>();
  private conversationTurns = new Map<string, MaiaCoreConversationTurn[]>();
  private readonly maxTurnsPerActor: number;

  constructor(options?: { maxTurnsPerActor?: number }) {
    this.maxTurnsPerActor = options?.maxTurnsPerActor || 30;
  }

  private buildKey(tenantId: string, key: string, scope?: MaiaMemoryScope): string {
    return `${tenantId}:${scope || 'session'}:${key}`;
  }

  private buildConversationKey(tenantId: string, sessionId: string, actorId: string): string {
    return `${tenantId}:${sessionId}:${actorId}`;
  }

  public async get(key: string, tenantId: string, scope?: MaiaMemoryScope): Promise<any> {
    const fullKey = this.buildKey(tenantId, key, scope);
    const entry = this.keyValues.get(fullKey);
    if (!entry) return undefined;

    // Checagem de expiração
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.keyValues.delete(fullKey);
      return undefined;
    }

    return entry.value;
  }

  public async set(entry: MaiaMemoryEntry): Promise<void> {
    const fullKey = this.buildKey(entry.tenantId, entry.key, entry.scope);
    this.keyValues.set(fullKey, entry);
  }

  public async delete(key: string, tenantId: string, scope?: MaiaMemoryScope): Promise<boolean> {
    const fullKey = this.buildKey(tenantId, key, scope);
    return this.keyValues.delete(fullKey);
  }

  public async getConversationHistory(
    tenantId: string,
    sessionId: string,
    actorId: string,
    limit: number = 10
  ): Promise<MaiaCoreConversationTurn[]> {
    const convKey = this.buildConversationKey(tenantId, sessionId, actorId);
    const turns = this.conversationTurns.get(convKey) || [];
    return turns.slice(-Math.min(limit, this.maxTurnsPerActor));
  }

  public addConversationTurn(
    tenantId: string,
    sessionId: string,
    actorId: string,
    turn: { role: 'user' | 'maia'; content?: string; text?: string }
  ): void {
    const convKey = this.buildConversationKey(tenantId, sessionId, actorId);
    let turns = this.conversationTurns.get(convKey);
    if (!turns) {
      turns = [];
      this.conversationTurns.set(convKey, turns);
    }

    const textContent = turn.content || turn.text || '';
    const turnRole: 'user' | 'assistant' | 'system' | 'tool' = turn.role === 'maia' ? 'assistant' : 'user';
    turns.push({
      role: turnRole,
      text: textContent,
      timestamp: new Date().toISOString()
    });

    if (turns.length > this.maxTurnsPerActor) {
      turns.shift();
    }
  }

  public getConversationTurnsSync(
    tenantId: string,
    sessionId: string,
    actorId: string,
    limit: number = 10
  ): MaiaCoreConversationTurn[] {
    const convKey = this.buildConversationKey(tenantId, sessionId, actorId);
    const turns = this.conversationTurns.get(convKey) || [];
    return turns.slice(-Math.min(limit, this.maxTurnsPerActor));
  }

  public async appendConversationTurn(
    tenantId: string,
    sessionId: string,
    actorId: string,
    turn: MaiaCoreConversationTurn
  ): Promise<void> {
    const convKey = this.buildConversationKey(tenantId, sessionId, actorId);
    let turns = this.conversationTurns.get(convKey);
    if (!turns) {
      turns = [];
      this.conversationTurns.set(convKey, turns);
    }

    turns.push(turn);
    if (turns.length > this.maxTurnsPerActor) {
      turns.shift();
    }
  }

  public async clearSessionMemory(tenantId: string, sessionId: string): Promise<void> {
    const prefix = `${tenantId}:${sessionId}:`;
    for (const key of this.conversationTurns.keys()) {
      if (key.startsWith(prefix)) {
        this.conversationTurns.delete(key);
      }
    }
  }

  /**
   * Expurgo de dados do participante para cumprimento da LGPD (Direito ao Esquecimento)
   */
  public async purgeParticipantData(
    tenantId: string,
    participantId: string
  ): Promise<{ removedMemories: number; removedTurns: number }> {
    let removedMemories = 0;
    let removedTurns = 0;

    // 1. Remove valores de memória indexados pelo participante
    for (const [key, entry] of this.keyValues.entries()) {
      if (entry.tenantId === tenantId && (key.includes(participantId) || entry.key.includes(participantId))) {
        this.keyValues.delete(key);
        removedMemories++;
      }
    }

    // 2. Remove turnos de conversação do participante
    const suffix = `:${participantId}`;
    for (const key of this.conversationTurns.keys()) {
      if (key.startsWith(`${tenantId}:`) && key.endsWith(suffix)) {
        const count = this.conversationTurns.get(key)?.length || 0;
        this.conversationTurns.delete(key);
        removedTurns += count;
      }
    }

    return { removedMemories, removedTurns };
  }

  /**
   * Expurga todos os dados de memória de um tenant específico (Isolamento e remoção)
   */
  public async purgeTenantData(tenantId: string): Promise<number> {
    let count = 0;
    const prefix = `${tenantId}:`;

    for (const key of this.keyValues.keys()) {
      if (key.startsWith(prefix)) {
        this.keyValues.delete(key);
        count++;
      }
    }

    for (const key of this.conversationTurns.keys()) {
      if (key.startsWith(prefix)) {
        this.conversationTurns.delete(key);
        count++;
      }
    }

    return count;
  }
}

export const maiaMemoryEngine = new InMemoryMaiaMemoryStore();
