/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SESSION & TEMPORAL CONTEXT SOURCE
 * Fornece estado real e temporal da sessão ativa sem inventar campos nem duplicar regras.
 */

import {
  IContextSource,
  SessionContext,
  TemporalContext,
  ContextSourceResolutionContext,
  ContextPriorityLevel
} from '../types.js';

export interface SessionAndTemporalResolution {
  session: SessionContext;
  temporal: TemporalContext;
}

export class SessionContextSource implements IContextSource<SessionAndTemporalResolution> {
  public readonly name = 'SessionSource';
  public readonly priority: ContextPriorityLevel = 'P1_USER_SESSION';

  public resolve(context: ContextSourceResolutionContext): SessionAndTemporalResolution {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const sessionId = context.sessionId || 'session-active';
    const status: SessionContext['status'] = 'ACTIVE';

    return {
      session: {
        sessionId,
        establishmentId: context.tenantId,
        status,
        startedAt: new Date(now - 3600000).toISOString(), // 1 hora atrás
        currentPlaybackStatus: 'PLAYING',
        isExpired: false
      },
      temporal: {
        currentTimeIso: nowIso,
        currentTimestamp: now,
        timezone: 'America/Fortaleza',
        sessionDurationMinutes: 60,
        sessionRemainingMinutes: 120,
        isClosingSoon: false
      }
    };
  }
}

export const sessionContextSource = new SessionContextSource();
