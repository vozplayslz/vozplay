/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONTROLLED AUTONOMY CONTRACTS (PROMPT 10)
 * Tipagens canônicas da camada de Autonomia Controlada da MaIA no ecossistema Enlace.
 * 
 * Princípios Fundamentais:
 * 1. «Autonomia não significa acesso irrestrito.»
 * 2. Autonomia responde: "A MaIA pode tomar iniciativa neste contexto?"
 * 3. Policy Engine responde: "Esta ação é permitida?"
 * 4. Human Takeover & Emergency Stop são absolutos e externos ao modelo.
 */

import { MaiaToolRiskLevel } from '../types.js';

// ============================================================================
// 1. NÍVEIS DE AUTONOMIA (Seção 3)
// ============================================================================

export type AutonomyTier = 
  | 0 // NÍVEL 0: Somente responder a solicitações diretas (Passivo)
  | 1 // NÍVEL 1: Sugerir ações ao operador (Assistivo)
  | 2 // NÍVEL 2: Executar ações de baixo risco (GREEN) quando autorizado
  | 3 // NÍVEL 3: Executar fluxos autorizados com limites rígidos
  | 4 // NÍVEL 4: Operar tarefas compostas sob supervisão humana
  | 5; // NÍVEL 5: Autonomia administrativa (TERMINANTEMENTE BLOQUEADO POR PADRÃO)

export type ControlledAutonomyLevel = AutonomyTier;

// ============================================================================
// 2. MODOS DE OPERAÇÃO DA AUTONOMIA (Seções 42, 43, 44 e 55)
// ============================================================================

export type AutonomyMode = 
  | 'OFF'          // Autonomia completamente desativada
  | 'OBSERVE_ONLY' // Percebe, analisa, planeja e sugere; NUNCA executa ferramentas reais
  | 'DRY_RUN'      // Simula execução, valida com Policy Engine, registra o plano sem executar ferramentas
  | 'AUTONOMOUS';  // Executa ferramentas autorizadas (GREEN) e solicita confirmação para YELLOW/RED

// ============================================================================
// 3. AÇÃO RESULTANTE DO GATILHO (Seção 11)
// ============================================================================

export type TriggerAutonomyAction = 
  | 'AUTO'    // Execução automática permitida (se política e risco permitirem)
  | 'SUGGEST' // Apenas sugerir ao operador na interface
  | 'CONFIRM' // Requer confirmação humana prévia
  | 'IGNORE'; // Ignorar evento

// ============================================================================
// 4. POLÍTICA DE AUTONOMIA DO TENANT (Seções 6, 7 e 8)
// ============================================================================

export interface TemporaryAutonomyGrant {
  grantedAt: string;
  expiresAt: string;
  grantedBy: string; // ID do operador/supervisor
  reason: string;
  allowedLevel: AutonomyTier;
  allowedTools?: string[];
}

export interface AutonomyPolicy {
  tenantId: string;
  productId: string; // Ex: 'maia-karaoke'
  enabled: boolean;
  mode: AutonomyMode;
  level: AutonomyTier;
  maxSteps: number;
  maxDurationMs: number;
  maxCostUsd: number;
  maxCascadeDepth: number; // Limite de chamadas em cascata (Seção 26)
  allowedTools: string[];   // Lista de ferramentas permitidas para proatividade
  disallowedTools: string[];// Lista explícita de bloqueio
  allowedHours?: {
    startHour: number; // Ex: 18 (18:00)
    endHour: number;   // Ex: 4 (04:00)
  };
  requiresConfirmationForYellow: boolean;
  temporaryGrant?: TemporaryAutonomyGrant;
  updatedAt: string;
}

// ============================================================================
// 5. GATILHOS PROATIVOS (TRIGGERS - Seções 11 e 14)
// ============================================================================

export interface AutonomyTriggerContext {
  tenantId: string;
  sessionId?: string;
  payload: any;
  currentQueueLength?: number;
  activeSinger?: string;
  songTitle?: string;
  isSessionActive?: boolean;
}

export interface AutonomyTrigger {
  id: string;
  name: string;
  description: string;
  eventType: string; // Ex: 'karaoke.playback.song_finished'
  condition: (ctx: AutonomyTriggerContext) => boolean;
  action: string;    // Identificador da ação planejada
  candidateGoal: (ctx: AutonomyTriggerContext) => string;
  riskLevel: MaiaToolRiskLevel;
  autonomyAction: TriggerAutonomyAction;
  cooldownMs: number; // Janela de descanso contra disparos múltiplos
  deduplicationKeyTemplate?: (ctx: AutonomyTriggerContext) => string;
  enabled: boolean;
}

// ============================================================================
// 6. CIRCUITO DE AUTONOMIA (CIRCUIT BREAKER - Seção 29)
// ============================================================================

export type AutonomyCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AutonomyCircuitStats {
  state: AutonomyCircuitState;
  consecutiveFailures: number;
  consecutiveLoops: number;
  lastFailureTime: number;
  lastStateChangeTime: number;
  totalTriggersFired: number;
  totalFailures: number;
}

// ============================================================================
// 7. TELEMETRIA E OBSERVABILIDADE (Seções 39 e 41)
// ============================================================================

export interface AutonomyMetrics {
  totalEventsEvaluated: number;
  triggersFired: number;
  tasksSpawned: number;
  tasksCompleted: number;
  tasksPaused: number;
  tasksFailed: number;
  tasksCancelled: number;
  humanTakeoversCount: number;
  emergencyStopsCount: number;
  circuitBreakerTrips: number;
  observeOnlyCount: number;
  dryRunCount: number;
  actionsExecutedByRisk: {
    GREEN: number;
    YELLOW: number;
    RED: number;
  };
  costAccumulatedUsd: number;
  averageEvaluationLatencyMs: number;
}

// ============================================================================
// 8. REGISTRO DE AUDITORIA FORMAL (Seção 40)
// ============================================================================

export interface AutonomyAuditRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  userId?: string;
  triggerId: string;
  eventType: string;
  eventId?: string;
  taskId?: string;
  planId?: string;
  tool?: string;
  policyResult: 'PERMITTED' | 'DENIED' | 'CONFIRMATION_REQUIRED';
  riskLevel: MaiaToolRiskLevel;
  autonomyMode: AutonomyMode;
  executionType: 'REAL' | 'DRY_RUN' | 'OBSERVE';
  argumentsSummary?: Record<string, unknown>;
  resultStatus: 'SUCCESS' | 'FAILURE' | 'SKIPPED' | 'SIMULATED';
  failureReason?: string;
}
