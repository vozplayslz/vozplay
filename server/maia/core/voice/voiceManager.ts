/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE MANAGER & ADAPTER (PROMPT 09)
 * Fachada central da camada de voz da MaIA.
 * Integração com Context Engine, Agent Runtime, Planner, Policy Engine,
 * Tool Registry e Event Bus.
 * 
 * Regras Inegociáveis:
 * 1. «Gemini Live NÃO é a MaIA.»
 * 2. Voz é apenas um canal de entrada; Voz ≠ Autorização.
 * 3. Entrada de voz é tratada estritamente como DADOS (Anti-Injection).
 * 4. Ações de fila e sessão passam obrigatoriamente pelo Agent Runtime e Policy Engine.
 */

import { randomUUID } from 'crypto';
import {
  VoiceSession,
  VoiceSessionConfig,
  VoiceAudioChunk,
  VoiceTelemetryMetrics,
  VoiceIntentResult,
  IVoiceSessionHandler
} from './types.js';
import { MaiaVoiceRouter, maiaVoiceRouter } from './voiceRouter.js';
import { VoiceSessionStore, voiceSessionStore } from './sessionStore.js';
import { MaiaContextEngine, maiaContextEngine } from '../context/contextEngine.js';
import { MaiaAgentRuntime, maiaAgentRuntime } from '../runtime/agentRuntime.js';
import { MaiaToolRegistry, maiaToolRegistry } from '../tools/toolRegistry.js';
import { MaiaToolExecutionContext } from '../tools/types.js';
import { MaiaPolicyEngine, maiaPolicyEngine } from '../policy/policyEngine.js';
import { MaiaEventBus, maiaEventBus } from '../events/eventBus.js';
import { MaiaIdentityEngine, maiaIdentityEngine } from '../identity/identityEngine.js';
import { IMaiaMemoryStore } from '../types.js';
import { maiaMemoryEngine } from '../memory/memoryEngine.js';
import {
  MaiaVoiceError,
  MaiaVoiceSessionError
} from './errors.js';
import {
  MaiaSecurityError,
  MaiaNotFoundError
} from '../errors.js';

export interface MaiaVoiceManagerDependencies {
  voiceRouter?: MaiaVoiceRouter;
  sessionStore?: VoiceSessionStore;
  contextEngine?: MaiaContextEngine;
  agentRuntime?: MaiaAgentRuntime;
  toolRegistry?: MaiaToolRegistry;
  policyEngine?: MaiaPolicyEngine;
  eventBus?: MaiaEventBus;
  identityEngine?: MaiaIdentityEngine;
  memoryStore?: IMaiaMemoryStore;
}

export class MaiaVoiceManager {
  private router: MaiaVoiceRouter;
  private sessionStore: VoiceSessionStore;
  private contextEngine: MaiaContextEngine;
  private agentRuntime: MaiaAgentRuntime;
  private toolRegistry: MaiaToolRegistry;
  private policy: MaiaPolicyEngine;
  private eventBus: MaiaEventBus;
  private identity: MaiaIdentityEngine;
  private memory: IMaiaMemoryStore;

  // Telemetria acumulada da camada de voz (Seção 25)
  private metrics: VoiceTelemetryMetrics = {
    voiceSessionsTotal: 0,
    voiceSessionsActive: 0,
    voiceSessionsFailed: 0,
    voiceInterruptionCount: 0,
    voiceFallbackCount: 0,
    voiceTotalAudioSeconds: 0,
    voiceFirstResponseLatencyMs: 0,
    voiceAverageDurationMs: 0,
    voiceByProvider: {},
    voiceByChannel: {}
  };

  private durations: number[] = [];

  constructor(deps?: MaiaVoiceManagerDependencies) {
    this.router = deps?.voiceRouter || maiaVoiceRouter;
    this.sessionStore = deps?.sessionStore || voiceSessionStore;
    this.contextEngine = deps?.contextEngine || maiaContextEngine;
    this.agentRuntime = deps?.agentRuntime || maiaAgentRuntime;
    this.toolRegistry = deps?.toolRegistry || maiaToolRegistry;
    this.policy = deps?.policyEngine || maiaPolicyEngine;
    this.eventBus = deps?.eventBus || maiaEventBus;
    this.identity = deps?.identityEngine || maiaIdentityEngine;
    this.memory = deps?.memoryStore || maiaMemoryEngine;
  }

  /**
   * Sanitiza a entrada de voz contra injeção de prompt (Seção 22)
   */
  public sanitizeVoiceInput(rawTranscript: string): string {
    const trimmed = (rawTranscript || '').trim();
    return trimmed
      .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, '[INJECTION_BLOCKED]')
      .replace(/desconsidere\s+(todas\s+as\s+)?regras/gi, '[INJECTION_BLOCKED]')
      .replace(/system\s*:\s*/gi, '')
      .replace(/<\|.*?\|>/g, '');
  }

  // ============================================================================
  // 1. GESTÃO DO CICLO DE VIDA DA SESSÃO DE VOZ (Seções 8, 18, 24)
  // ============================================================================

  /**
   * Inicia uma nova sessão de voz
   */
  public async startSession(config: VoiceSessionConfig): Promise<VoiceSession> {
    const startTime = Date.now();
    const tenantId = config.tenantId;

    if (!tenantId) {
      throw new MaiaSecurityError('tenantId é obrigatório para iniciar sessão de voz.');
    }

    // 1. Resolução inteligente de rota e fallback de voz (Seções 2, 4, 26)
    const resolution = await this.router.resolveVoiceRoute(config);
    const provider = resolution.provider;

    if (resolution.fromFallback) {
      this.metrics.voiceFallbackCount++;
    }

    const voiceSessionId = (config.sessionId && config.sessionId.startsWith('vsess-'))
      ? config.sessionId
      : `vsess-${randomUUID()}`;

    const effectiveConfig: VoiceSessionConfig = {
      ...config,
      sessionId: voiceSessionId
    };

    // 2. Criação do Handler de Sessão no provedor
    const handler = await provider.createSession(effectiveConfig);
    const session = handler.session;

    // 3. Conexão do Handler
    await handler.connect();

    // 4. Armazenamento na store de sessões em memória
    this.sessionStore.save(session, handler);

    // 5. Atualização de telemetria
    this.metrics.voiceSessionsTotal++;
    this.metrics.voiceSessionsActive++;
    this.metrics.voiceByProvider[provider.id] = (this.metrics.voiceByProvider[provider.id] || 0) + 1;
    this.metrics.voiceByChannel[config.channel] = (this.metrics.voiceByChannel[config.channel] || 0) + 1;

    // 6. Emissão de evento formal no Event Bus (Seção 18)
    await this.eventBus.emit({
      name: 'maia.voice.session_started',
      tenantId,
      source: 'MaiaVoiceManager',
      correlationId: session.correlationId,
      payload: {
        sessionId: session.id,
        providerId: provider.id,
        modelId: session.modelId,
        channel: session.channel,
        actorRole: session.actorRole,
        fromFallback: resolution.fromFallback
      }
    });

    return session;
  }

  /**
   * Obtém detalhes de uma sessão ativa
   */
  public getSession(sessionId: string, tenantId?: string): VoiceSession | undefined {
    return this.sessionStore.get(sessionId, tenantId);
  }

  /**
   * Envia um chunk de áudio para a sessão de voz
   */
  public async sendAudio(sessionId: string, chunk: VoiceAudioChunk, tenantId?: string): Promise<void> {
    const handler = this.sessionStore.getHandler(sessionId, tenantId);
    if (!handler) {
      throw new MaiaNotFoundError(`Sessão de voz '${sessionId}' não encontrada.`);
    }

    const startTime = Date.now();
    await handler.sendAudio(chunk);

    this.sessionStore.touch(sessionId);
    handler.session.metrics.audioInputLatencyMs = Date.now() - startTime;
    this.metrics.voiceTotalAudioSeconds += (chunk.data.length / (chunk.sampleRate * 2));

    await this.eventBus.emit({
      name: 'maia.voice.input_received',
      tenantId: handler.session.tenantId,
      source: 'MaiaVoiceManager',
      correlationId: handler.session.correlationId,
      payload: {
        sessionId,
        format: chunk.format,
        sampleRate: chunk.sampleRate,
        isFinal: chunk.isFinal
      }
    });
  }

  /**
   * Envia texto para a sessão de voz
   */
  public async sendText(sessionId: string, text: string, tenantId?: string): Promise<void> {
    const handler = this.sessionStore.getHandler(sessionId, tenantId);
    if (!handler) {
      throw new MaiaNotFoundError(`Sessão de voz '${sessionId}' não encontrada.`);
    }

    const sanitized = this.sanitizeVoiceInput(text);
    await handler.sendText(sanitized);
    this.sessionStore.touch(sessionId);
  }

  /**
   * Dispara interrupção (Barge-In) na sessão de voz ativa (Seção 15)
   */
  public async interrupt(sessionId: string, tenantId?: string): Promise<void> {
    const handler = this.sessionStore.getHandler(sessionId, tenantId);
    if (!handler) {
      throw new MaiaNotFoundError(`Sessão de voz '${sessionId}' não encontrada.`);
    }

    await handler.interrupt();
    this.metrics.voiceInterruptionCount++;

    await this.eventBus.emit({
      name: 'maia.voice.response_interrupted',
      tenantId: handler.session.tenantId,
      source: 'MaiaVoiceManager',
      correlationId: handler.session.correlationId,
      payload: { sessionId }
    });
  }

  /**
   * Encerra uma sessão de voz
   */
  public async endSession(sessionId: string, tenantId?: string): Promise<VoiceSession> {
    const handler = this.sessionStore.getHandler(sessionId, tenantId);
    if (!handler) {
      throw new MaiaNotFoundError(`Sessão de voz '${sessionId}' não encontrada.`);
    }

    await handler.disconnect();
    const session = handler.session;

    this.metrics.voiceSessionsActive = Math.max(0, this.metrics.voiceSessionsActive - 1);
    this.durations.push(session.metrics.sessionDurationMs);
    if (this.durations.length > 100) this.durations.shift();
    const sum = this.durations.reduce((a, b) => a + b, 0);
    this.metrics.voiceAverageDurationMs = Math.round(sum / this.durations.length);

    await this.eventBus.emit({
      name: 'maia.voice.session_ended',
      tenantId: session.tenantId,
      source: 'MaiaVoiceManager',
      correlationId: session.correlationId,
      payload: {
        sessionId: session.id,
        durationMs: session.metrics.sessionDurationMs,
        turnCount: session.turnCount,
        interruptedCount: session.interruptedCount
      }
    });

    return session;
  }

  // ============================================================================
  // 2. PROCESSAMENTO DE INTENÇÕES POR VOZ (Seções 14, 19, 21, 31, 35)
  // ============================================================================

  /**
   * Interpreta uma transcrição falada, classifica se é uma pergunta direta ou ação operacional,
   * e despacha para o Agent Runtime e Policy Engine sob governança estrita.
   */
  public async processVoiceIntent(
    session: VoiceSession,
    transcription: string
  ): Promise<VoiceIntentResult> {
    const sanitized = this.sanitizeVoiceInput(transcription);
    const lower = sanitized.toLowerCase();

    // 1. Perguntas informativas diretas (READ -> GREEN)
    if (
      lower.includes('quem é o próximo') ||
      lower.includes('quem esta na fila') ||
      lower.includes('quem está na fila') ||
      lower.includes('status da fila') ||
      lower.includes('minha vez')
    ) {
      let realAnswer = 'Não há informações de fila disponíveis no momento.';
      try {
        const queueTool = this.toolRegistry.get('karaoke.queue.getStatus');
        if (queueTool) {
          const execCtx: MaiaToolExecutionContext = {
            toolRequestId: 'req-voice-' + Date.now(),
            correlationId: session.correlationId,
            tenantId: session.tenantId,
            sessionId: session.channel || 'voice-session',
            actorId: session.userId || 'anon-voice',
            actorRole: session.actorRole,
            actorDisplayName: 'Operador de Voz',
            permissions: ['queue.read']
          };
          const queueData = await queueTool.execute(execCtx, { limit: 10 });
          const items = Array.isArray(queueData?.items) ? queueData.items : [];
          const calling = items.find((q: any) => q.status === 'CALLED');
          const nextInLine = items.find((q: any) => q.status === 'QUEUED');

          if (calling) {
            realAnswer = `O cantor da vez no palco é ${calling.participantDisplayName} cantando "${calling.musicTitle}".`;
          } else if (nextInLine) {
            realAnswer = `A fila possui ${items.length} ${items.length === 1 ? 'música' : 'músicas'}. O próximo cantor é ${nextInLine.participantDisplayName} cantando "${nextInLine.musicTitle}".`;
          } else if (items.length === 0) {
            realAnswer = 'A fila de karaokê está vazia no momento. Escolha uma música pelo catálogo para cantar!';
          }
        }
      } catch {
        realAnswer = 'Não foi possível consultar os dados da fila no momento.';
      }

      return {
        rawTranscript: transcription,
        sanitizedText: sanitized,
        intent: 'QUERY_QUEUE_STATUS',
        toolName: 'karaoke.queue.getStatus',
        arguments: { tenantId: session.tenantId },
        requiresConfirmation: false,
        riskLevel: 'READ',
        confidence: 0.95,
        directAnswer: realAnswer
      };
    }

    // 2. Ações operacionais de fila (ACTION -> YELLOW)
    if (lower.includes('chama o próximo') || lower.includes('chamar proximo') || lower.includes('chamar o próximo')) {
      // Inicia uma tarefa controlada no Agent Runtime (Seção 31)
      const task = await this.agentRuntime.createTask({
        goal: 'Chamar próximo participante da fila a pedido do operador por voz',
        tenantId: session.tenantId,
        userId: session.userId,
        actorRole: session.actorRole,
        channel: session.channel,
        correlationId: session.correlationId
      });

      return {
        rawTranscript: transcription,
        sanitizedText: sanitized,
        intent: 'CALL_NEXT_SINGER',
        toolName: 'karaoke.queue.callNext',
        arguments: { tenantId: session.tenantId },
        requiresConfirmation: false,
        riskLevel: 'ACTION',
        confidence: 0.92,
        taskId: task.id,
        directAnswer: 'Tarefa registrada para chamar o próximo cantor. Aguardando execução pelo controlador de mesa.'
      };
    }

    // 3. Ações que alteram fila ou removem participante (HIGH_RISK -> RED / YELLOW - Seção 21)
    if (lower.includes('remova') || lower.includes('remover') || lower.includes('tirar da fila')) {
      // Cria tarefa no Agent Runtime que exigirá confirmação humana (Seções 14 e 35)
      const task = await this.agentRuntime.createTask({
        goal: `Remover participante a pedido por voz: "${sanitized}"`,
        tenantId: session.tenantId,
        userId: session.userId,
        actorRole: session.actorRole,
        channel: session.channel,
        correlationId: session.correlationId
      });

      return {
        rawTranscript: transcription,
        sanitizedText: sanitized,
        intent: 'REMOVE_PARTICIPANT',
        toolName: 'karaoke.queue.removeSong',
        arguments: { tenantId: session.tenantId },
        requiresConfirmation: true, // Sempre exige confirmação (RED)
        riskLevel: 'HIGH_RISK',
        confidence: 0.90,
        taskId: task.id,
        directAnswer: 'Atenção: remover um participante da fila exige confirmação expressa na tela ou na mesa de som.'
      };
    }

    // 4. Intenção genérica de conversação com a MaIA
    return {
      rawTranscript: transcription,
      sanitizedText: sanitized,
      intent: 'CONVERSATION',
      requiresConfirmation: false,
      riskLevel: 'READ',
      confidence: 0.85,
      directAnswer: 'Estou te ouvindo perfeitamente! Como posso animar o karaokê agora?'
    };
  }

  // ============================================================================
  // 3. TELEMETRIA E OBSERVABILIDADE (Seção 25)
  // ============================================================================

  public getMetrics(): VoiceTelemetryMetrics {
    return { ...this.metrics };
  }
}

export const maiaCoreVoiceManager = new MaiaVoiceManager();
