/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA KARAOKÊ DOMAIN BRIDGE (PROMPT 04)
 * Ponte de integração entre o domínio especializado MaIA Karaokê e o MaIA Core.
 * Registra a persona, ferramentas de karaokê com namespaces oficiais ('karaoke.*'),
 * esquemas estritos, regras de privacidade e barramento de eventos.
 */

import {
  maiaIdentityEngine,
  maiaToolRegistry,
  maiaPolicyEngine,
  maiaEventBus,
  maiaAIRouter,
  MaiaContext,
  MaiaTool,
  MaiaToolContract,
  ToolRiskLevel,
  MaiaCoreAIProvider,
  maiaContextEngine,
  MaiaToolExecutionContext
} from './core/index.js';

import {
  MAIA_KARAOKE_IDENTITY,
  MAIA_KARAOKE_DESCRIPTION,
  MAIA_CORE_INSTRUCTIONS
} from './identity.js';

import { maiaTools } from './tools.js';
import { maiaAuthorizationEngine } from './authorization/maiaAuthorizationEngine.js';
import { MaIAToolContext } from './types.js';
import { getAIProvider } from './providers/index.js';
import { db } from '../db.js';
import { wsServer } from '../wsServer.js';
import { logger } from '../logger.js';

/**
 * Converte MaIAToolContext legado para MaiaContext do Core
 */
export function toMaiaContext(context: MaIAToolContext): MaiaContext {
  return maiaContextEngine.createContext({
    tenantId: context.establishmentId,
    sessionId: context.sessionId,
    actorId: context.actorId,
    actorRole: context.actorRole,
    actorDisplayName: context.actorName,
    actorAuthenticated: (context.actorRole as string) !== 'ANONYMOUS'
  });
}

/**
 * Converte MaiaContext do Core para MaIAToolContext do domínio
 */
export function toToolContext(coreContext: MaiaContext): MaIAToolContext {
  return {
    establishmentId: coreContext.tenant.id,
    sessionId: coreContext.session.id,
    actorRole: coreContext.actor.role as any,
    actorId: coreContext.actor.id,
    actorName: coreContext.actor.displayName || 'Usuário'
  };
}

/**
 * Converte MaiaToolExecutionContext para MaIAToolContext
 */
export function executionContextToToolContext(ctx: MaiaToolExecutionContext): MaIAToolContext {
  return {
    establishmentId: ctx.tenantId,
    sessionId: ctx.sessionId,
    actorRole: ctx.actorRole as any,
    actorId: ctx.actorId,
    actorName: ctx.actorDisplayName || 'Usuário'
  };
}

/**
 * Mapeamento de metadados avançados de cada ferramenta de karaokê (Prompt 04)
 */
const KARAOKE_TOOL_METADATA: Record<string, {
  id: string;
  riskLevel: ToolRiskLevel;
  permissions: string[];
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  isIdempotent?: boolean;
  timeoutMs?: number;
  isRetryable?: boolean;
}> = {
  getCurrentQueue: {
    id: 'karaoke.queue.getStatus',
    riskLevel: 'LOW',
    permissions: ['queue.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getParticipantTurn: {
    id: 'karaoke.queue.getParticipantTurn',
    riskLevel: 'LOW',
    permissions: ['queue.read', 'participant.turn.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getSessionStatus: {
    id: 'karaoke.session.getStatus',
    riskLevel: 'LOW',
    permissions: ['session.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getNextParticipant: {
    id: 'karaoke.queue.getNextParticipant',
    riskLevel: 'LOW',
    permissions: ['queue.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getCurrentSong: {
    id: 'karaoke.session.getCurrentSong',
    riskLevel: 'LOW',
    permissions: ['session.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getTVStatus: {
    id: 'karaoke.tv.getStatus',
    riskLevel: 'LOW',
    permissions: ['tv.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getControllerStatus: {
    id: 'karaoke.controller.getStatus',
    riskLevel: 'LOW',
    permissions: ['controller.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getSessionMetrics: {
    id: 'karaoke.session.getMetrics',
    riskLevel: 'LOW',
    permissions: ['session.metrics.read'],
    timeoutMs: 3000,
    isRetryable: true
  },
  getMusicRecommendations: {
    id: 'karaoke.music.getRecommendations',
    riskLevel: 'LOW',
    permissions: ['music.browse'],
    timeoutMs: 5000,
    isRetryable: true
  },
  skipSong: {
    id: 'karaoke.queue.skip',
    riskLevel: 'MEDIUM',
    permissions: ['queue.write', 'playback.control'],
    timeoutMs: 4000,
    isIdempotent: false
  },
  broadcastAlert: {
    id: 'karaoke.tv.broadcast',
    riskLevel: 'MEDIUM',
    permissions: ['alert.broadcast', 'tv.write'],
    timeoutMs: 4000,
    isIdempotent: false
  },
  removeQueueItem: {
    id: 'karaoke.queue.removeSong',
    riskLevel: 'HIGH',
    permissions: ['queue.write', 'queue.manage'],
    requiresConfirmation: true,
    confirmationPrompt: 'Confirma o cancelamento e remoção definitiva deste item da fila?',
    timeoutMs: 5000,
    isIdempotent: true
  },
  takeoverController: {
    id: 'karaoke.session.takeover',
    riskLevel: 'CRITICAL',
    permissions: ['session.takeover', 'admin.emergency'],
    requiresConfirmation: true,
    confirmationPrompt: 'Confirmar Assunção Emergencial da mesa de som pelo Supervisor? O token do operador anterior será revogado imediatamente.',
    timeoutMs: 5000
  }
};

/**
 * Inicializa e conecta a especialização MaIA Karaokê ao MaIA Core
 */
export function bootstrapKaraokeDomain(): void {
  // 1. REGISTRA PERFIL DE DOMÍNIO NO IDENTITY ENGINE
  maiaIdentityEngine.registerDomainProfile({
    id: 'maia-karaoke',
    product: 'MaIA Karaokê (VozPlay)',
    domain: 'karaoke',
    role: 'Anfitriã Digital e Mestre de Cerimônias',
    description: MAIA_KARAOKE_DESCRIPTION,
    tone: ['descontraída', 'acolhedora', 'musical', 'animada', 'humana', 'espontânea'],
    customInstructions: MAIA_CORE_INSTRUCTIONS,
    metadata: {
      version: MAIA_KARAOKE_IDENTITY.version,
      capabilities: MAIA_KARAOKE_IDENTITY.capabilities
    }
  });

  // 2. REGISTRA AS 13 FERRAMENTAS COM NAMESPACE OFICIAL ('karaoke.*') E ALIASES LEGADOS
  for (const [legacyName, toolDef] of Object.entries(maiaTools)) {
    const meta = KARAOKE_TOOL_METADATA[legacyName] || {
      id: `karaoke.${legacyName}`,
      riskLevel: toolDef.category === 'CRITICAL' ? 'CRITICAL' :
                 toolDef.category === 'HIGH_RISK' ? 'HIGH' :
                 toolDef.category === 'ACTION' ? 'MEDIUM' : 'LOW',
      permissions: ['queue.read'],
      timeoutMs: 5000
    };

    // Contrato Oficial Namespaced (ex: 'karaoke.queue.getStatus')
    const namespacedContract: MaiaToolContract = {
      id: meta.id,
      name: legacyName,
      description: toolDef.description,
      version: 'v1',
      category: toolDef.category,
      riskLevel: meta.riskLevel,
      inputSchema: {
        type: 'object',
        properties: (toolDef.parameters?.properties as any) || {},
        required: toolDef.parameters?.required || []
      },
      permissions: meta.permissions,
      allowedRoles: toolDef.allowedRoles,
      requiresConfirmation: meta.requiresConfirmation,
      confirmationPrompt: meta.confirmationPrompt,
      isIdempotent: meta.isIdempotent,
      timeoutMs: meta.timeoutMs || 5000,
      isRetryable: meta.isRetryable,
      enabled: true,
      execute: async (ctx, params) => {
        const toolCtx = executionContextToToolContext(ctx);
        return maiaAuthorizationEngine.executeAuthorizedTool(toolCtx, toolDef, params);
      }
    };

    maiaToolRegistry.register(namespacedContract);

    // Registro com Nome Legado (ex: 'getCurrentQueue') para 100% de compatibilidade reversa
    const legacyContract: MaiaToolContract = {
      ...namespacedContract,
      id: legacyName,
      name: legacyName
    };
    maiaToolRegistry.register(legacyContract);
  }

  // 3. REGISTRA FERRAMENTA OPERACIONAL ADICIONAL: karaoke.queue.addSong COM IDEMPOTÊNCIA
  const addSongTool: MaiaToolContract = {
    id: 'karaoke.queue.addSong',
    name: 'addSongToQueue',
    description: 'Adiciona uma música solicitada à fila de karaokê da sessão ativa com suporte a idempotência.',
    version: 'v1',
    category: 'ACTION',
    riskLevel: 'MEDIUM',
    permissions: ['queue.write'],
    allowedRoles: ['PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'],
    isIdempotent: true,
    timeoutMs: 5000,
    inputSchema: {
      type: 'object',
      properties: {
        participantId: { type: 'string', description: 'ID do participante solicitante' },
        musicId: { type: 'string', description: 'ID da música no catálogo' },
        versionId: { type: 'string', description: 'ID da versão da música (opcional)' },
        toneOffset: { type: 'number', minimum: -3, maximum: 3, description: 'Semiltons (-3 a +3)' },
        isDuet: { type: 'boolean', description: 'Se a apresentação será em dupla' },
        partnerDisplayName: { type: 'string', maxLength: 50, description: 'Nome do parceiro no dueto' }
      },
      required: ['participantId', 'musicId']
    },
    enabled: true,
    execute: async (ctx, params: { participantId: string; musicId: string; toneOffset?: number; isDuet?: boolean; partnerDisplayName?: string }) => {
      if (db.session.status !== 'ACTIVE') {
        throw new Error('A sessão não está ativa para inclusão de novas músicas.');
      }

      // Validação de participante
      const participant = db.participants.get(params.participantId);
      if (!participant) {
        throw new Error('Participante não cadastrado na sessão.');
      }

      const music = db.catalog.find(m => m.id === params.musicId);
      if (!music) {
        throw new Error(`Música '${params.musicId}' não encontrada no catálogo.`);
      }

      const toneOffset = Math.max(-3, Math.min(3, Math.trunc(Number(params.toneOffset) || 0)));
      const version = music.versions[0];
      const queueItem = await db.addSongToQueue(
        participant,
        music,
        version,
        toneOffset,
        {
          isDuet: Boolean(params.isDuet),
          partnerDisplayName: params.partnerDisplayName
        }
      );

      return {
        success: true,
        queueItemId: queueItem.id,
        orderIndex: queueItem.orderIndex,
        musicTitle: music.title,
        participantDisplayName: participant.displayName
      };
    }
  };
  maiaToolRegistry.register(addSongTool);

  // 4. REGRA DE GOVERNANÇA: PRIVACIDADE DE CONSULTA DE VAGA DO PARTICIPANTE
  maiaPolicyEngine.registerRule({
    name: 'KaraokeParticipantTurnPrivacy',
    description: 'Participantes só podem consultar o status da sua própria vaga',
    priority: 10,
    evaluate: (context, tool, params) => {
      if (tool.name === 'getParticipantTurn' || tool.name === 'karaoke.queue.getParticipantTurn') {
        const actorRole = context.actor.role;
        const targetId = params?.participantId || context.actor.id;
        if (actorRole === 'PARTICIPANT' && context.actor.id && targetId && context.actor.id !== targetId) {
          return {
            allowed: false,
            reason: '[Acesso Negado MaIA] Violação de privacidade: participantes só podem consultar o status da sua própria vaga.',
            riskLevel: tool.category,
            code: 'ERR_PARTICIPANT_PRIVACY_VIOLATION'
          };
        }
      }
      return null;
    }
  });

  // 5. REGISTRA PROVEDOR PADRÃO GEMINI NO AI ROUTER DO CORE
  const defaultProvider: MaiaCoreAIProvider = {
    id: 'gemini_enlace',
    name: 'Google Gemini (Enlace Official Gateway)',
    supportedTasks: ['CHAT', 'LIVE_VOICE', 'REASONING', 'TTS', 'TRANSCRIPTION', 'ACTION_PLANNING', 'GENERIC_COMPLETION'],
    generateText: async (prompt, options) => {
      const p = getAIProvider('gemini_enlace');
      return p.generateText(prompt, {
        systemInstruction: options?.systemInstruction,
        model: options?.model || 'gemini-3.8-flash',
        maxTokens: options?.maxTokens || 500
      });
    },
    checkHealth: async () => {
      try {
        const p = getAIProvider('gemini_enlace');
        const available = p.isAvailable();
        return { ok: available };
      } catch (err: any) {
        return { ok: false, error: err?.message };
      }
    }
  };

  maiaAIRouter.registerProvider(defaultProvider);

  logger.info('[MaiaKaraokeBridge] Tool Registry Avançado carregado com sucesso (13 ferramentas oficiais + addSong).');
}

// Inicializa a ponte automaticamente ao carregar o módulo
bootstrapKaraokeDomain();
