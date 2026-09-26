/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SERVICE FACADE
 * Interface unificada da MaIA para o servidor VozPlay.
 */

import { aiModelRouter } from '../router.js';
import { maiaConfigManager } from '../config.js';
import { maiaTTSService } from '../tts.js';
import { maiaTools } from '../tools.js';
import { MAIA_CORE_SYSTEM_INSTRUCTION, sanitizeAndWrapInput } from '../prompts.js';
import { MaIAToolContext, TTSResponse } from '../types.js';
import { logger } from '../../logger.js';

class MaiaService {
  /**
   * Conversação inteligente com a MaIA respeitando isolamento de papéis e anti-injection
   */
  public async chat(
    context: MaIAToolContext,
    userMessage: string
  ): Promise<{ text: string; role: string; timestamp: string }> {
    const establishmentId = context.establishmentId;
    const sanitizedInput = sanitizeAndWrapInput(userMessage, 'participant_prompt');
    const { provider, model, providerName } = aiModelRouter.resolveRoute(establishmentId, 'CHAT');

    let dynamicContext = '';
    try {
      if (context.actorRole === 'PARTICIPANT' && context.actorId) {
        const turnInfo = await maiaTools.getParticipantTurn.execute(context, { participantId: context.actorId });
        dynamicContext += `\n[Status Real do Participante: ${JSON.stringify(turnInfo)}]`;
      } else if (context.actorRole === 'CONTROLLER' || context.actorRole === 'SUPERVISOR') {
        const queueSummary = await maiaTools.getCurrentQueue.execute(context, { limit: 5 });
        const sessionSummary = await maiaTools.getSessionStatus.execute(context, {});
        dynamicContext += `\n[Status Real da Sessão: ${queueSummary.queueLength} na fila, status de reprodução: ${sessionSummary.playbackStatus}]`;
      }
    } catch {
      // Falha graciosa ao enriquecer contexto sem quebrar a conversa
    }

    const rolePrompt = `Você está conversando com: ${context.actorName} (Papel: ${context.actorRole}).
Se o usuário perguntar sobre a fila, tempo de espera, status ou dicas de karaokê, responda em português brasileiro acolhedor, gentil e objetivo.${dynamicContext}`;

    const systemInstruction = `${MAIA_CORE_SYSTEM_INSTRUCTION}\n\n${rolePrompt}`;

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

      return {
        text: reply,
        role: 'maia',
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      logger.error('[MaiaService] Erro na conversação com MaIA:', err);
      return {
        text: 'Olá! Sou a MaIA do VozPlay. No momento estou concentrada na transmissão do palco. Divirta-se cantando!',
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
   * Executa uma ferramenta autorizada da MaIA
   */
  public async executeTool(context: MaIAToolContext, toolName: string, params: any = {}): Promise<any> {
    const tool = maiaTools[toolName];
    if (!tool) {
      throw new Error(`Ferramenta desconhecida: ${toolName}`);
    }
    return tool.execute(context, params);
  }

  /**
   * Obtém a lista de ferramentas disponíveis
   */
  public getAvailableTools(): Array<{ name: string; description: string }> {
    return Object.values(maiaTools).map(t => ({
      name: t.name,
      description: t.description
    }));
  }
}

export const maiaService = new MaiaService();
