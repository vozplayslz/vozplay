/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONVERSATION CONTEXT SOURCE
 * Monta o histórico de diálogo com janela controlada, priorizando mensagens recentes
 * e marcando explicitamente a fronteira de confiança (TRUSTED vs UNTRUSTED).
 */

import {
  IContextSource,
  ConversationContext,
  ConversationMessage,
  ContextSourceResolutionContext,
  ContextPriorityLevel
} from '../types.js';
import { ContextSanitizer } from '../contextSanitizer.js';

export class ConversationContextSource implements IContextSource<ConversationContext> {
  public readonly name = 'ConversationSource';
  public readonly priority: ContextPriorityLevel = 'P3_CONVERSATION';

  public resolve(context: ContextSourceResolutionContext): ConversationContext {
    // Janela padrão: 6 mensagens para participante, 4 para operador, 2 para voz
    const maxMessages = context.profile === 'voice' ? 2 : (context.profile === 'operator' ? 4 : 6);

    const messages: ConversationMessage[] = [];

    // Se houver mensagem atual do usuário na requisição
    if (context.userMessage) {
      const sanitized = ContextSanitizer.sanitizeUserText(context.userMessage);
      messages.push({
        role: 'user',
        text: sanitized.cleanText,
        timestamp: new Date().toISOString(),
        trust: 'UNTRUSTED'
      });
    }

    return {
      conversationId: `conv-${context.tenantId}-${context.userId || 'anon'}`,
      totalTurnCount: messages.length,
      recentMessages: messages.slice(-maxMessages),
      currentIntent: undefined
    };
  }
}

export const conversationContextSource = new ConversationContextSource();
