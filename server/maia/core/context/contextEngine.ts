/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE CONTEXT ENGINE (PROMPT 03)
 * Criação, validação, isolamento multi-tenant, priorização e sanitização de dados contextuais.
 * Orquestra a produção de MaiaContextSnapshot e formatação segura para o AI Router.
 */

import { randomUUID } from 'crypto';
import { MaiaContext, MaiaCoreConversationTurn } from '../types.js';
import { MaiaContextError } from '../errors.js';
import { MaiaContextSnapshot, ContextProfileType, ContextChannel, ContextInterface } from './types.js';
import { ContextBuilder, BuildSnapshotOptions } from './contextBuilder.js';
import { ContextSanitizer } from './contextSanitizer.js';
import { ContextFormatter } from './contextFormatter.js';

export interface CreateContextOptions {
  tenantId: string;
  tenantName?: string;
  sessionId?: string;
  sessionStatus?: string;
  actorId?: string;
  actorRole?: string;
  actorDisplayName?: string;
  actorPermissions?: string[];
  actorAuthenticated?: boolean;
  channel?: ContextChannel;
  interface?: ContextInterface;
  clientVersion?: string;
  ip?: string;
  userAgent?: string;
  domain?: Record<string, unknown>;
  history?: MaiaCoreConversationTurn[];
  correlationId?: string;
}

export class MaiaContextEngine {
  /**
   * Constrói uma instância estrita e normalizada de MaiaContext (compatibilidade de baixo nível)
   */
  public createContext(options: CreateContextOptions): MaiaContext {
    if (!options.tenantId || typeof options.tenantId !== 'string' || options.tenantId.trim() === '') {
      throw new MaiaContextError('O campo tenantId é estritamente obrigatório para criação de contexto.');
    }

    const correlationId = options.correlationId || randomUUID();
    const timestamp = new Date().toISOString();

    return {
      correlationId,
      timestamp,
      tenant: {
        id: options.tenantId,
        name: options.tenantName,
        settings: {}
      },
      session: {
        id: options.sessionId || 'session-default',
        status: options.sessionStatus || 'ACTIVE'
      },
      actor: {
        id: options.actorId || 'actor-anon',
        role: options.actorRole || 'ANONYMOUS',
        displayName: options.actorDisplayName || 'Usuário',
        permissions: options.actorPermissions || [],
        authenticated: Boolean(options.actorAuthenticated)
      },
      environment: {
        channel: options.channel || 'web',
        clientVersion: options.clientVersion,
        ip: options.ip,
        userAgent: options.userAgent
      },
      domain: options.domain || {},
      history: options.history || []
    };
  }

  /**
   * Constrói um Context Snapshot completo, estruturado e imutável (Prompt 03)
   */
  public async buildSnapshot(options: BuildSnapshotOptions): Promise<MaiaContextSnapshot> {
    return ContextBuilder.buildSnapshot(options);
  }

  /**
   * Empacota o Context Snapshot em formato otimizado e seguro para consumo pelo AI Router
   */
  public formatSnapshotForPrompt(snapshot: MaiaContextSnapshot): string {
    return ContextFormatter.formatForPrompt(snapshot);
  }

  /**
   * Sanitiza o contexto removendo campos sensíveis (senhas, hashes, tokens, PII protegida)
   */
  public sanitizeContext(context: MaiaContext): MaiaContext {
    const sanitizedDomain = ContextSanitizer.sanitizeData(context.domain, false);
    const sanitizedActorMeta = ContextSanitizer.sanitizeData(context.actor.metadata || {}, false);

    return {
      ...context,
      actor: {
        ...context.actor,
        metadata: sanitizedActorMeta
      },
      domain: sanitizedDomain
    };
  }

  /**
   * Enriquece o contexto existente com fatos ou estados adicionais de domínio
   */
  public enrichDomainContext(context: MaiaContext, domainData: Record<string, unknown>): MaiaContext {
    return {
      ...context,
      domain: {
        ...context.domain,
        ...ContextSanitizer.sanitizeData(domainData, false)
      }
    };
  }

  /**
   * Assegura isolamento estrito de Multi-Tenancy
   */
  public assertTenantIsolation(sourceTenantId: string, targetTenantId: string): void {
    ContextBuilder.assertTenantIsolation(sourceTenantId, targetTenantId);
  }
}

export const maiaContextEngine = new MaiaContextEngine();
