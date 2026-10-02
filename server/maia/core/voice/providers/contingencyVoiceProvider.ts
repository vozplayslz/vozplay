/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CONTINGENCY LOCAL VOICE PROVIDER (PROMPT 09 - Seções 26 e 27)
 * Provedor de contingência local offline para quando a IA estiver desativada (AI_ENABLED=false)
 * ou totalmente indisponível.
 * 
 * Regra de Ouro:
 * A indisponibilidade da IA JAMAIS pode derrubar ou travar o produto VozPlay.
 */

import { randomUUID } from 'crypto';
import {
  IVoiceProvider,
  IVoiceSessionHandler,
  VoiceSessionConfig,
  VoiceSession,
  VoiceCapabilities,
  VoiceAudioChunk,
  VoiceEventCallbacks
} from '../types.js';

class ContingencySessionHandler implements IVoiceSessionHandler {
  public readonly session: VoiceSession;
  private callbacks: VoiceEventCallbacks = {};
  private isConnected = false;

  constructor(session: VoiceSession) {
    this.session = session;
  }

  public setCallbacks(callbacks: VoiceEventCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public async connect(): Promise<void> {
    this.session.status = 'CONNECTING';
    this.callbacks.onStatus?.('CONNECTING');
    this.isConnected = true;
    this.session.status = 'LISTENING';
    this.callbacks.onStatus?.('LISTENING');
  }

  public async disconnect(): Promise<void> {
    this.isConnected = false;
    this.session.status = 'ENDED';
    this.session.endedAt = new Date().toISOString();
    this.session.metrics.sessionDurationMs = Date.now() - new Date(this.session.startedAt).getTime();
    this.callbacks.onStatus?.('ENDED');
  }

  public async sendAudio(chunk: VoiceAudioChunk): Promise<void> {
    if (!this.isConnected) return;
    this.session.status = 'THINKING';
    this.callbacks.onStatus?.('THINKING');

    // Resposta local determinística sem IA
    const fallbackMessage = 'MaIA operando em contingência local. A fila e a reprodução seguem 100% ativas no sistema.';
    this.callbacks.onText?.(fallbackMessage, true);

    this.session.status = 'SPEAKING';
    this.callbacks.onStatus?.('SPEAKING');

    this.session.turnCount++;
    this.session.status = 'LISTENING';
    this.callbacks.onStatus?.('LISTENING');
  }

  public async sendText(text: string): Promise<void> {
    if (!this.isConnected) return;
    this.session.status = 'THINKING';
    this.callbacks.onStatus?.('THINKING');

    const fallbackMessage = 'MaIA operando em modo de resiliência local. O sistema permanece íntegro.';
    this.callbacks.onText?.(fallbackMessage, true);

    this.session.turnCount++;
    this.session.status = 'LISTENING';
    this.callbacks.onStatus?.('LISTENING');
  }

  public async interrupt(): Promise<void> {
    this.session.status = 'INTERRUPTED';
    this.session.interruptedCount++;
    this.callbacks.onInterrupted?.();
    this.session.status = 'LISTENING';
    this.callbacks.onStatus?.('LISTENING');
  }

  public async pause(): Promise<void> {
    this.session.status = 'PAUSED';
    this.callbacks.onStatus?.('PAUSED');
  }

  public async resume(): Promise<void> {
    this.session.status = 'LISTENING';
    this.callbacks.onStatus?.('LISTENING');
  }
}

export class ContingencyVoiceProvider implements IVoiceProvider {
  public readonly id = 'contingency-voice';
  public readonly name = 'MaIA Contingency Local Voice';

  public async getCapabilities(): Promise<VoiceCapabilities> {
    return {
      supportsBargeIn: true,
      supportsStreamingInput: false,
      supportsStreamingOutput: false,
      supportsTurnDetection: false,
      supportsTools: true,
      supportedInputFormats: ['wav', 'pcm_16000', 'pcm_24000'],
      supportedOutputFormats: ['wav'],
      nativeRealtime: false
    };
  }

  public async createSession(config: VoiceSessionConfig): Promise<IVoiceSessionHandler> {
    const sessionId = config.sessionId || `vsess-local-${randomUUID()}`;
    const session: VoiceSession = {
      id: sessionId,
      tenantId: config.tenantId,
      userId: config.userId,
      actorRole: config.actorRole,
      channel: config.channel,
      status: 'CONNECTING',
      providerId: this.id,
      modelId: 'contingency-local',
      profile: config.profile || 'ECONOMICO',
      startedAt: new Date().toISOString(),
      correlationId: config.correlationId || `corr-local-${randomUUID()}`,
      capabilities: await this.getCapabilities(),
      metrics: {
        audioInputLatencyMs: 0,
        speechDetectionLatencyMs: 0,
        providerLatencyMs: 0,
        firstAudioResponseLatencyMs: 0,
        totalResponseLatencyMs: 0,
        interruptionLatencyMs: 0,
        sessionDurationMs: 0,
        audioInputSeconds: 0,
        audioOutputSeconds: 0,
        tokensUsed: 0,
        estimatedCostUsd: 0
      },
      interruptedCount: 0,
      turnCount: 0,
      language: config.language || 'pt-BR',
      voiceId: config.voiceId || 'Aoede',
      lastActivityAt: Date.now()
    };

    return new ContingencySessionHandler(session);
  }

  public async checkHealth(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    return { ok: true, latencyMs: 1 };
  }
}

export const contingencyVoiceProvider = new ContingencyVoiceProvider();
