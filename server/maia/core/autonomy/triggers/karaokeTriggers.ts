/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA KARAOKE AUTONOMY TRIGGERS (PROMPT 10 - Seções 20 e 21)
 * Gatilhos canônicos pré-aprovados do domínio MaIA Karaokê para o produto VozPlay.
 * 
 * Regra Inegociável:
 * A MaIA NÃO inventa regras de negócio (como prazos de 30s ou ausências).
 * Ela consome as regras e estados oficiais do domínio VozPlay.
 */

import { AutonomyTrigger, AutonomyTriggerContext } from '../types.js';

export const KARAOKE_AUTONOMY_TRIGGERS: AutonomyTrigger[] = [
  // --------------------------------------------------------------------------
  // CASO 1: FIM DE MÚSICA -> ANUNCIAR PRÓXIMO PARTICIPANTE (GREEN AUTO)
  // --------------------------------------------------------------------------
  {
    id: 'trigger-song-finished-announce',
    name: 'Anúncio Próximo Cantor pós Término',
    description: 'Quando uma música termina e há participantes na fila, celebra a performance e prepara anúncio do próximo.',
    eventType: 'karaoke.playback.song_finished',
    condition: (ctx: AutonomyTriggerContext) => {
      // Se a sessão está ativa e há pelo menos 1 participante na fila
      return Boolean(ctx.isSessionActive !== false && (ctx.currentQueueLength ?? 1) > 0);
    },
    action: 'announce_next_singer',
    candidateGoal: (ctx: AutonomyTriggerContext) => {
      return `Celebrar apresentação e anunciar a próxima música da fila com entusiasmo e cortesia.`;
    },
    riskLevel: 'READ',
    autonomyAction: 'AUTO',
    cooldownMs: 15000, // Cooldown de 15 segundos para evitar repetição rápida
    deduplicationKeyTemplate: (ctx) => ctx.songTitle || 'current-song',
    enabled: true
  },

  // --------------------------------------------------------------------------
  // CASO 2: PARTICIPANTE CHAMADO -> MONITORAR PRESENÇA NA MESA (GREEN AUTO)
  // --------------------------------------------------------------------------
  {
    id: 'trigger-singer-called-presence',
    name: 'Monitorar Presença do Cantor Chamado',
    description: 'Quando um cantor é chamado para o palco, acompanha a validação de presença do código de 60s.',
    eventType: 'karaoke.queue.singer_called',
    condition: (ctx: AutonomyTriggerContext) => {
      return Boolean(ctx.activeSinger);
    },
    action: 'monitor_presence',
    candidateGoal: (ctx: AutonomyTriggerContext) => {
      return `Acompanhar a chegada do participante ${ctx.activeSinger || 'chamado'} à mesa de som.`;
    },
    riskLevel: 'READ',
    autonomyAction: 'AUTO',
    cooldownMs: 20000,
    deduplicationKeyTemplate: (ctx) => ctx.activeSinger || 'singer',
    enabled: true
  },

  // --------------------------------------------------------------------------
  // CASO 3: AUSÊNCIA DO PARTICIPANTE -> ALERTAR OPERADOR (YELLOW CONFIRM)
  // --------------------------------------------------------------------------
  {
    id: 'trigger-singer-absent-alert',
    name: 'Tratamento de Ausência de Participante',
    description: 'Quando um cantor não comparece dentro da janela de presença, sugere ação de tolerância ao operador.',
    eventType: 'karaoke.queue.singer_absent',
    condition: (_ctx: AutonomyTriggerContext) => {
      return true;
    },
    action: 'handle_absence',
    candidateGoal: (ctx: AutonomyTriggerContext) => {
      return `Notificar o operador sobre a ausência de ${ctx.activeSinger || 'participante'} e sugerir aplicação da regra de tolerância da casa.`;
    },
    riskLevel: 'ACTION',
    autonomyAction: 'CONFIRM', // Ação moderada: exige confirmação do operador (YELLOW)
    cooldownMs: 30000,
    deduplicationKeyTemplate: (ctx) => ctx.activeSinger || 'absent',
    enabled: true
  },

  // --------------------------------------------------------------------------
  // CASO 4: ALTERAÇÃO NA FILA -> ATUALIZAR CONTEXTO (GREEN AUTO)
  // --------------------------------------------------------------------------
  {
    id: 'trigger-queue-changed-sync',
    name: 'Sincronização de Contexto de Fila',
    description: 'Mantém o contexto cognitivo e memória da MaIA sincronizados após adições ou reordenações na fila.',
    eventType: 'karaoke.queue.changed',
    condition: (_ctx: AutonomyTriggerContext) => {
      return true;
    },
    action: 'sync_queue_context',
    candidateGoal: (_ctx: AutonomyTriggerContext) => {
      return 'Sincronizar o estado e estimativas da fila de karaokê no Context Engine.';
    },
    riskLevel: 'READ',
    autonomyAction: 'AUTO',
    cooldownMs: 5000,
    enabled: true
  },

  // --------------------------------------------------------------------------
  // CASO 5: SESSÃO TERMINANDO -> INFORMAR OPERADOR (GREEN SUGGEST)
  // --------------------------------------------------------------------------
  {
    id: 'trigger-session-ending-notice',
    name: 'Aviso de Encerramento ou Prorrogação de Sessão',
    description: 'Quando a sessão entra nos últimos 15 minutos, informa o supervisor sobre necessidade de prorrogação.',
    eventType: 'karaoke.session.ending',
    condition: (_ctx: AutonomyTriggerContext) => {
      return true;
    },
    action: 'notify_session_ending',
    candidateGoal: (_ctx: AutonomyTriggerContext) => {
      return 'Avisar a equipe sobre o término iminente da sessão de karaokê e opções de prorrogação.';
    },
    riskLevel: 'READ',
    autonomyAction: 'SUGGEST',
    cooldownMs: 60000, // Cooldown de 1 minuto
    enabled: true
  }
];
