/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PERCEPTION CLASSIFIER (PROMPT 05)
 * Classificador semântico e operacional de eventos de domínio.
 * Determina relevância, prioridade, categoria e candidata a intenção futura
 * para a MaIA sem executar nenhuma ação autônoma.
 */

import { DomainEvent } from '../events/types.js';
import {
  CandidateIntent,
  PerceptionCategory,
  PerceptionPriority,
  PerceptionRelevance
} from './types.js';

export interface ClassificationResult {
  relevance: PerceptionRelevance;
  priority: PerceptionPriority;
  category: PerceptionCategory;
  candidateIntent: CandidateIntent;
  summary: string;
  reasoning: string;
}

export class PerceptionClassifier {
  /**
   * Classifica o evento de domínio com base no tipo, payload e contexto
   */
  public classify(event: DomainEvent): ClassificationResult {
    const type = (event.type || event.name || '').toLowerCase();
    const payload = event.payload || {};

    // 1. EVENTOS CRÍTICOS DE SISTEMA (P0 - CRITICAL)
    if (type.includes('emergency_takeover') || type === 'system.emergency') {
      return {
        relevance: 'CRITICAL',
        priority: 'P0',
        category: 'SYSTEM',
        candidateIntent: 'HANDLE_EMERGENCY',
        summary: 'Assunção emergencial acionada pela supervisão da casa.',
        reasoning: 'O supervisor acionou a assunção emergencial com rotação de credenciais. A MaIA deve registrar a transição prioritária.'
      };
    }

    if (type === 'system.error.critical' || type === 'system.panic') {
      return {
        relevance: 'CRITICAL',
        priority: 'P0',
        category: 'SYSTEM',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Falha crítica operacional registrada: ${payload.message || 'Erro de sistema'}.`,
        reasoning: 'Erro severo de infraestrutura ou barramento detectado; relevância crítica para auditoria.'
      };
    }

    // 2. EVENTOS CRUCIAIS DE PALCO E FILA (P1 - HIGH)
    if (type === 'karaoke.queue.participant_called' || type === 'karaoke.participant_called') {
      const singer = payload.participantDisplayName || payload.singerName || 'Nosso cantor';
      const song = payload.musicTitle || payload.songTitle || 'a música escolhida';
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'QUEUE',
        candidateIntent: 'ANNOUNCE_SINGER',
        summary: `Cantor(a) ${singer} chamado(a) ao palco com "${song}".`,
        reasoning: 'A mesa de som chamou o próximo participante. Relevância alta para apresentar o cantor e acolher o público com entusiasmo.'
      };
    }

    if (type === 'karaoke.queue.song_finished' || type === 'karaoke.song_finished') {
      const singer = payload.participantDisplayName || payload.singerName || 'O cantor';
      const song = payload.musicTitle || payload.songTitle || 'a música';
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'PERFORMANCE',
        candidateIntent: 'CELEBRATE_PERFORMANCE',
        summary: `Apresentação de "${song}" por ${singer} concluída.`,
        reasoning: 'A música terminou no palco. Relevância alta para celebrar a coragem/talento do cantor e aquecer o próximo da fila.'
      };
    }

    if (type === 'karaoke.queue.moved_to_back' || type === 'karaoke.participant_moved_to_back') {
      const singer = payload.participantDisplayName || payload.singerName || 'Participante';
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'QUEUE',
        candidateIntent: 'ALERT_OPERATOR_ABSENCE',
        summary: `Participante ${singer} ausente pela 2ª vez; música movida para o final da fila.`,
        reasoning: 'O participante não compareceu após duas chamadas consecutivas. Reorganização justa da fila com tolerância esgotada.'
      };
    }

    if (type === 'karaoke.queue.empty' || type === 'karaoke.queue_empty') {
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'QUEUE',
        candidateIntent: 'ENCOURAGE_AUDIENCE',
        summary: 'A fila de karaokê está livre e sem músicas pendentes.',
        reasoning: 'Nenhum cantor na fila. Momento ideal para incentivar as mesas a escanear o QR Code e escolherem suas músicas.'
      };
    }

    if (type === 'karaoke.session.started' || type === 'karaoke.session_started') {
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'SESSION',
        candidateIntent: 'WELCOME_AUDIENCE',
        summary: 'Sessão de karaokê iniciada oficialmente no lounge.',
        reasoning: 'Início dos trabalhos da noite. Relevância alta para desejar boas-vindas e declarar o microfone aberto.'
      };
    }

    if (type === 'karaoke.session.ending' || type === 'karaoke.session_ending') {
      return {
        relevance: 'HIGH',
        priority: 'P1',
        category: 'SESSION',
        candidateIntent: 'NOTIFY_SESSION_ENDING',
        summary: 'A sessão de karaokê está em fase final de encerramento.',
        reasoning: 'Sessão próxima do término. Relevância alta para avisar os últimos cantores e garantir encerramento pontual.'
      };
    }

    // 3. EVENTOS OPERACIONAIS RELEVANTES (P2 - MEDIUM)
    if (type === 'karaoke.queue.song_added' || type === 'karaoke.song_added') {
      const singer = payload.participantDisplayName || payload.singerName || 'Alguém';
      const song = payload.musicTitle || payload.songTitle || 'uma nova canção';
      return {
        relevance: 'MEDIUM',
        priority: 'P2',
        category: 'QUEUE',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Nova música adicionada à fila: "${song}" por ${singer}.`,
        reasoning: 'Fila atualizada. Contexto relevante para acompanhar tempo de espera e dinamismo da casa.'
      };
    }

    if (type === 'karaoke.queue.participant_missed' || type === 'karaoke.participant_missed') {
      const singer = payload.participantDisplayName || payload.singerName || 'Participante';
      return {
        relevance: 'MEDIUM',
        priority: 'P2',
        category: 'QUEUE',
        candidateIntent: 'ALERT_OPERATOR_ABSENCE',
        summary: `Primeira ausência registrada para ${singer} (tolerância de 30s concedida).`,
        reasoning: 'Cantor chamado não se apresentou de imediato. A MaIA observa a concessão de tempo extra.'
      };
    }

    if (type === 'karaoke.session.extended' || type === 'karaoke.session_extended') {
      const minutes = payload.additionalMinutes || payload.minutes || 15;
      return {
        relevance: 'MEDIUM',
        priority: 'P2',
        category: 'SESSION',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Sessão de karaokê prorrogada em +${minutes} minutos.`,
        reasoning: 'A supervisão estendeu a duração do karaokê. Relevância temporal para recálculo de fila.'
      };
    }

    if (type === 'karaoke.queue.song_cancelled' || type === 'karaoke.song_removed') {
      return {
        relevance: 'MEDIUM',
        priority: 'P2',
        category: 'QUEUE',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Música cancelada da fila pelo participante ou operador.`,
        reasoning: 'Remoção voluntária de música da fila. Relevância média para recálculo do tempo estimado.'
      };
    }

    // 4. EVENTOS DE BAIXA PRIORIDADE (P3 - LOW)
    if (type.includes('presence') || type.includes('code_validated')) {
      return {
        relevance: 'LOW',
        priority: 'P3',
        category: 'OPERATIONAL',
        candidateIntent: 'OBSERVE_ONLY',
        summary: 'Código de presença física validado na mesa de som.',
        reasoning: 'Confirmação física de proximidade do participante. Informação de suporte operacional.'
      };
    }

    if (type.includes('reaction')) {
      return {
        relevance: 'LOW',
        priority: 'P3',
        category: 'AUDIENCE',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Reação da plateia recebida: ${payload.emoji || payload.type || 'aplauso'}.`,
        reasoning: 'Engajamento da plateia em tempo real enviado para o telão.'
      };
    }

    if (type.includes('connected') || type.includes('disconnected')) {
      return {
        relevance: 'LOW',
        priority: 'P3',
        category: 'OPERATIONAL',
        candidateIntent: 'OBSERVE_ONLY',
        summary: `Conexão de dispositivo ou interface: ${type}.`,
        reasoning: 'Sincronização de conectividade de terminal (TV, Controller ou PWA).'
      };
    }

    // 5. RUÍDOS, HEARTBEATS OU EVENTOS NÃO OPERACIONAIS (IGNORED)
    if (
      type.includes('heartbeat') ||
      type.includes('ping') ||
      type.includes('telemetry') ||
      type.includes('metric')
    ) {
      return {
        relevance: 'IGNORED',
        priority: 'P3',
        category: 'SYSTEM',
        candidateIntent: 'NONE',
        summary: 'Sinal de heartbeat ou telemetria ignorado pela percepção.',
        reasoning: 'Ruído de infraestrutura não relevante para o domínio cognitivo da MaIA.'
      };
    }

    // Fallback genérico para eventos desconhecidos
    return {
      relevance: 'LOW',
      priority: 'P3',
      category: 'OPERATIONAL',
      candidateIntent: 'OBSERVE_ONLY',
      summary: `Evento de domínio registrado: ${type}.`,
      reasoning: 'Evento registrado sem classificação semântica especializada.'
    };
  }
}

export const perceptionClassifier = new PerceptionClassifier();
