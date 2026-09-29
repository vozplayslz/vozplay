/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SERVICE FACADE — VOZPLAY NATIVE V1.0
 * Interface unificada da MaIA Karaokê para o servidor VozPlay.
 * Conecta personas por papel, motor de autorização, memória contextual e router de IA.
 */

import { aiModelRouter } from '../router.js';
import { maiaConfigManager } from '../config.js';
import { maiaTTSService } from '../tts.js';
import { maiaTools } from '../tools.js';
import { maiaAuthorizationEngine } from '../authorization/maiaAuthorizationEngine.js';
import { maiaMemoryStore } from '../memory/maiaMemoryStore.js';
import { buildMaiaSystemInstruction } from '../personas.js';
import { sanitizeAndWrapInput } from '../prompts.js';
import { MaIAToolContext, TTSResponse } from '../types.js';
import { logger } from '../../logger.js';

class MaiaService {
  /**
   * Conversação inteligente com a MaIA Karaokê respeitando isolamento de papéis, contexto e anti-injection
   */
  public async chat(
    context: MaIAToolContext,
    userMessage: string
  ): Promise<{ text: string; role: string; timestamp: string }> {
    const establishmentId = context.establishmentId;
    const sanitizedInput = sanitizeAndWrapInput(userMessage, 'participant_prompt');
    const { provider, model } = aiModelRouter.resolveRoute(establishmentId, 'CHAT');

    let dynamicContext = '';

    // Enriquecimento contextual seguro via tools autorizadas
    try {
      if (context.actorRole === 'PARTICIPANT' && context.actorId) {
        const turnInfo = await maiaTools.getParticipantTurn.execute(context, { participantId: context.actorId });
        if (turnInfo.hasTurn) {
          dynamicContext += `\n[Status Real do Participante: Música "${turnInfo.musicTitle}" (${turnInfo.musicArtist}), Posição na fila: ${turnInfo.position}º lugar (${turnInfo.queuedBefore} pessoas antes), Status: ${turnInfo.status}]`;
        } else {
          dynamicContext += `\n[Status Real do Participante: Nenhuma música ativa na fila no momento]`;
        }
      } else if (['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(context.actorRole)) {
        const queueSummary = await maiaTools.getCurrentQueue.execute(context, { limit: 5 });
        const sessionSummary = await maiaTools.getSessionStatus.execute(context, {});
        dynamicContext += `\n[Status Real da Sessão: ${queueSummary.queueLength} pessoas na fila, Status do Player: ${sessionSummary.playbackStatus}, Operador Ativo: ${sessionSummary.activeControllerName || 'Nenhum'}]`;
      }
    } catch {
      // Falha graciosa ao enriquecer contexto sem quebrar a conversa
    }

    // Recupera memória conversacional recente deste ator
    const recentHistory = maiaMemoryStore.getRecentHistory(
      establishmentId,
      context.sessionId,
      context.actorRole,
      context.actorId || 'anon'
    );
    if (recentHistory) {
      dynamicContext += `\n[Histórico Recente da Conversa]:\n${recentHistory}`;
    }

    // Constrói a diretriz de sistema oficial da MaIA Karaokê para o papel do usuário
    const systemInstruction = buildMaiaSystemInstruction({
      role: context.actorRole,
      actorName: context.actorName,
      dynamicContext
    });

    const startTime = Date.now();
    try {
      const reply = await provider.generateText(sanitizedInput, {
        systemInstruction,
        model,
        maxTokens: 500
      });

      const latencyMs = Date.now() - startTime;
      maiaConfigManager.recordUsage(
        establishmentId,
        'CHAT',
        model,
        latencyMs,
        true,
        false,
        userMessage.length,
        reply.length
      );

      // Armazena turno na memória estruturada
      maiaMemoryStore.addTurn(
        establishmentId,
        context.sessionId,
        context.actorRole,
        context.actorId || 'anon',
        context.actorName,
        { role: 'user', text: userMessage }
      );
      maiaMemoryStore.addTurn(
        establishmentId,
        context.sessionId,
        context.actorRole,
        context.actorId || 'anon',
        context.actorName,
        { role: 'maia', text: reply }
      );

      return {
        text: reply,
        role: 'maia',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      logger.warn('[MaiaService] Conversação com MaIA operando em contingência local:', {
        error: err?.message || String(err)
      });
      const fallbackReply = context.actorRole === 'PARTICIPANT'
        ? 'Relaxa! A MaIA Karaokê tá aqui de olho no palco animando a festa! Prepara a sua voz e vem soltar o som! 🎤✨'
        : 'A MaIA Karaokê está online e acompanhando a sessão. Fila e sistema operando normalmente.';

      return {
        text: fallbackReply,
        role: 'maia',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Síntese vocal direta para mensagens avulsas (ex: avisos do operador ou supervisor)
   */
  public async speak(establishmentId: string, text: string): Promise<TTSResponse> {
    return maiaTTSService.synthesize(establishmentId, { text });
  }

  /**
   * Executa uma ferramenta autorizada da MaIA através do MaiaAuthorizationEngine
   */
  public async executeTool(context: MaIAToolContext, toolName: string, params: any = {}): Promise<any> {
    const tool = maiaTools[toolName];
    if (!tool) {
      throw new Error(`Ferramenta desconhecida: ${toolName}`);
    }
    return maiaAuthorizationEngine.executeAuthorizedTool(context, tool, params);
  }

  /**
   * Obtém a lista de ferramentas disponíveis com suas respectivas categorias e permissões
   */
  public getAvailableTools(): Array<{ name: string; description: string; category: string; allowedRoles: string[] }> {
    return Object.values(maiaTools).map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      allowedRoles: t.allowedRoles
    }));
  }
}

export const maiaService = new MaiaService();
