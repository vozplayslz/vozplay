/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONTEXT BUILDER & SNAPSHOT PRODUCER
 * Orquestrador central de coleta de fontes, validação de multitenancy,
 * aplicação de prioridades, filtragem por perfil e geração de snapshots imutáveis.
 */

import { randomUUID } from 'crypto';
import {
  MaiaContextSnapshot,
  ContextProfileType,
  ContextChannel,
  ContextInterface,
  ContextSourceResolutionContext,
  ContextMetrics
} from './types.js';
import { ContextSanitizer } from './contextSanitizer.js';
import { ContextFormatter } from './contextFormatter.js';
import { MaiaContextError, MaiaSecurityError } from '../errors.js';

import { identityContextSource } from './sources/identitySource.js';
import { userContextSource } from './sources/userSource.js';
import { sessionContextSource } from './sources/sessionSource.js';
import { domainContextSource } from './sources/domainSource.js';
import { conversationContextSource } from './sources/conversationSource.js';
import { eventContextSource } from './sources/eventSource.js';
import { systemContextSource } from './sources/systemSource.js';
import { memoryContextSource } from '../memory/contextSource.js';
import { ContextMemoryItem } from './types.js';

export interface BuildSnapshotOptions {
  tenantId: string;
  sessionId?: string;
  userId?: string;
  role?: string;
  channel?: ContextChannel;
  interface?: ContextInterface;
  userMessage?: string;
  profile?: ContextProfileType;
  correlationId?: string;
  customDomainData?: Record<string, unknown>;
}

export class ContextBuilder {
  /**
   * Constrói e retorna um MaiaContextSnapshot imutável e seguro
   */
  public static async buildSnapshot(options: BuildSnapshotOptions): Promise<MaiaContextSnapshot> {
    const startTime = Date.now();
    const correlationId = options.correlationId || randomUUID();

    // 1. VALIDAÇÃO DE CONTEXTO OBRIGATÓRIO (Falha segura em ausência)
    if (!options.tenantId || typeof options.tenantId !== 'string' || options.tenantId.trim() === '') {
      throw new MaiaContextError('Falha de contexto: identificador de tenantId é estritamente obrigatório e não pode ser vazio.', {
        correlationId
      });
    }

    // Perfil padrão deduzido pelo canal/papel caso não explicitado
    const profile: ContextProfileType = options.profile || (
      options.role === 'SUPERVISOR' || options.role === 'SYSTEM_ADMIN' ? 'supervisor' :
      options.role === 'CONTROLLER' ? 'operator' :
      options.channel === 'tv' ? 'tv' :
      options.channel === 'voice' ? 'voice' : 'participant'
    );

    const resolutionCtx: ContextSourceResolutionContext = {
      tenantId: options.tenantId,
      sessionId: options.sessionId,
      userId: options.userId,
      role: options.role,
      channel: options.channel,
      interface: options.interface,
      userMessage: options.userMessage,
      profile,
      correlationId
    };

    const sourcesUsed: string[] = [];
    const sourcesSkipped: string[] = [];

    // 2. COLETA DE FONTES POR PRIORIDADE
    // P0: Identidade e Segurança
    const identity = identityContextSource.resolve(resolutionCtx);
    sourcesUsed.push(identityContextSource.name);

    // P1: Usuário e Papel Real (RBAC Verificado)
    const { user, role } = userContextSource.resolve(resolutionCtx);
    sourcesUsed.push(userContextSource.name);

    // P1: Sessão e Tempo
    const { session, temporal } = sessionContextSource.resolve(resolutionCtx);
    sourcesUsed.push(sessionContextSource.name);

    // P1: Permissões, Capacidades e Ambiente
    const { permissions, capabilities, environment, voice } = systemContextSource.resolve(resolutionCtx);
    sourcesUsed.push(systemContextSource.name);

    // P2: Domínio Operacional (Resumo de Fila / Fatos do Lounge)
    const domain = domainContextSource.resolve(resolutionCtx);
    sourcesUsed.push(domainContextSource.name);

    // Se houver dados customizados de domínio injetados, sanitiza e acopla
    if (options.customDomainData) {
      domain.customDomainData = ContextSanitizer.sanitizeData(options.customDomainData, false);
    }

    // P3: Histórico de Diálogo (Janela controlada)
    const conversation = conversationContextSource.resolve(resolutionCtx);
    sourcesUsed.push(conversationContextSource.name);

    // P4: Eventos Recentes (Filtrados por TTL)
    const events = eventContextSource.resolve(resolutionCtx);
    sourcesUsed.push(eventContextSource.name);

    // P5: Memórias Relevantes (Recuperadas sob demanda via Memory Budget - Prompt 06)
    let memories: ContextMemoryItem[] = [];
    try {
      memories = await memoryContextSource.resolve(resolutionCtx);
      sourcesUsed.push(memoryContextSource.name);
    } catch {
      sourcesSkipped.push(memoryContextSource.name);
    }

    // 3. CÁLCULO DE MÉTRICAS E OBSERVABILIDADE
    const buildLatencyMs = Date.now() - startTime;
    const formattedPrompt = ContextFormatter.formatForPrompt({
      contextVersion: 1,
      correlationId,
      generatedAt: new Date().toISOString(),
      profile,
      tenantId: options.tenantId,
      identity,
      user,
      role,
      domain,
      session,
      conversation,
      temporal,
      events,
      permissions,
      capabilities,
      environment,
      voice,
      memories,
      metrics: {
        buildLatencyMs,
        estimatedTokens: 0,
        fieldCount: 11,
        sourcesUsed,
        sourcesSkipped,
        serializedSizeBytes: 0,
        eventsFilteredCount: events.recentEvents.length,
        messagesFilteredCount: conversation.recentMessages.length,
        memoriesRetrievedCount: memories.length
      }
    });

    const estimatedTokens = ContextFormatter.estimateTokens(formattedPrompt);
    const serializedSizeBytes = Buffer.byteLength(formattedPrompt, 'utf8');

    const metrics: ContextMetrics = {
      buildLatencyMs,
      estimatedTokens,
      fieldCount: 11,
      sourcesUsed,
      sourcesSkipped,
      serializedSizeBytes,
      eventsFilteredCount: events.recentEvents.length,
      messagesFilteredCount: conversation.recentMessages.length,
      memoriesRetrievedCount: memories.length
    };

    // 4. CONSTRUÇÃO E CONGELAMENTO IMUTÁVEL DO SNAPSHOT (Object.freeze profundo)
    const snapshot: MaiaContextSnapshot = {
      contextVersion: 1,
      correlationId,
      generatedAt: new Date().toISOString(),
      profile,
      tenantId: options.tenantId,
      identity,
      user,
      role,
      domain,
      session,
      conversation,
      temporal,
      events,
      permissions,
      capabilities,
      environment,
      voice,
      memories,
      metrics
    };

    return ContextSanitizer.deepFreeze(snapshot);
  }

  /**
   * Validação estrita de isolamento multi-tenant entre dois contextos
   */
  public static assertTenantIsolation(sourceTenantId: string, targetTenantId: string): void {
    if (!sourceTenantId || !targetTenantId || sourceTenantId !== targetTenantId) {
      throw new MaiaSecurityError(
        `[Isolamento Multi-Tenant Violado] Tentativa de acesso não autorizada: tenant requisitante '${sourceTenantId}' tentou acessar dados do tenant '${targetTenantId}'.`,
        { details: { sourceTenantId, targetTenantId } }
      );
    }
  }
}
