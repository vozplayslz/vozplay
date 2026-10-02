/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE SESSION STORE (PROMPT 09 - Seções 8 e 24)
 * Repositório bounded de sessões de voz ativas em memória com isolamento multi-tenant,
 * expurgo automático por TTL e política rigorosa de privacidade (descarte de buffers de áudio brutos).
 */

import { VoiceSession, IVoiceSessionHandler } from './types.js';

interface StoredVoiceSession {
  session: VoiceSession;
  handler: IVoiceSessionHandler;
  createdAt: number;
  lastActivityAt: number;
}

export class VoiceSessionStore {
  private sessions = new Map<string, StoredVoiceSession>();
  private readonly maxSessionsPerTenant: number;
  private readonly sessionTtlMs: number;

  constructor(options?: { maxSessionsPerTenant?: number; sessionTtlMs?: number }) {
    this.maxSessionsPerTenant = options?.maxSessionsPerTenant || 50;
    this.sessionTtlMs = options?.sessionTtlMs || 1800000; // 30 minutos de inatividade
  }

  public save(session: VoiceSession, handler: IVoiceSessionHandler): void {
    const now = Date.now();
    this.sessions.set(session.id, {
      session,
      handler,
      createdAt: now,
      lastActivityAt: now
    });
    this.enforceTenantLimit(session.tenantId);
  }

  public get(sessionId: string, tenantId?: string): VoiceSession | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;
    if (tenantId && entry.session.tenantId !== tenantId) {
      return undefined; // Isolamento estrito de tenant
    }
    return entry.session;
  }

  public getHandler(sessionId: string, tenantId?: string): IVoiceSessionHandler | undefined {
    const entry = this.sessions.get(sessionId);
    if (!entry) return undefined;
    if (tenantId && entry.session.tenantId !== tenantId) {
      return undefined;
    }
    return entry.handler;
  }

  public touch(sessionId: string): void {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.lastActivityAt = Date.now();
      entry.session.lastActivityAt = entry.lastActivityAt;
    }
  }

  public delete(sessionId: string, tenantId?: string): boolean {
    const entry = this.sessions.get(sessionId);
    if (!entry) return false;
    if (tenantId && entry.session.tenantId !== tenantId) return false;
    return this.sessions.delete(sessionId);
  }

  public list(tenantId: string): VoiceSession[] {
    const results: VoiceSession[] = [];
    for (const entry of this.sessions.values()) {
      if (entry.session.tenantId === tenantId) {
        results.push(entry.session);
      }
    }
    return results.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public count(tenantId?: string): number {
    if (!tenantId) return this.sessions.size;
    let count = 0;
    for (const entry of this.sessions.values()) {
      if (entry.session.tenantId === tenantId) count++;
    }
    return count;
  }

  private enforceTenantLimit(tenantId: string): void {
    const tenantEntries: StoredVoiceSession[] = [];
    for (const entry of this.sessions.values()) {
      if (entry.session.tenantId === tenantId) {
        tenantEntries.push(entry);
      }
    }

    if (tenantEntries.length > this.maxSessionsPerTenant) {
      tenantEntries.sort((a, b) => a.createdAt - b.createdAt);
      const toRemove = tenantEntries.slice(0, tenantEntries.length - this.maxSessionsPerTenant);
      for (const item of toRemove) {
        this.sessions.delete(item.session.id);
      }
    }
  }

  public pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, entry] of this.sessions.entries()) {
      const isExpired = now - entry.lastActivityAt > this.sessionTtlMs;
      const isEnded = ['ENDED', 'ERROR'].includes(entry.session.status);

      if (isExpired || isEnded) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const voiceSessionStore = new VoiceSessionStore();
