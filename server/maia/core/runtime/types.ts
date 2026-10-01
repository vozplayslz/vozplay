/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AGENT RUNTIME & PLANNER TYPES (PROMPT 08)
 * Tipagens completas do orquestrador de ciclo fechado, planejador de IA,
 * níveis de autonomia (GREEN/YELLOW/RED), governança humana e controle de loops.
 */

import { MaiaContext, MaiaToolRiskLevel } from '../types.js';

// ============================================================================
// 1. ESTADOS DO AGENTE E DE TAREFAS
// ============================================================================

export type AgentTaskStatus = 
  | 'pending'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'loop_detected';

export type PlanStepStatus = 
  | 'pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

// ============================================================================
// 2. NÍVEIS DE RISCO E AUTONOMIA (Seções 12 e 13)
// ============================================================================

export type TaskRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AutonomyLevel = 
  | 'GREEN'   // Baixo risco (leitura, status): executa automaticamente
  | 'YELLOW'  // Risco moderado (alterações de fila): confirmação conforme contexto/política
  | 'RED';    // Alto risco / Crítico (segurança, sessões, admin): confirmação explícita SEMPRE

// ============================================================================
// 3. ESTRUTURA DO PLANO E ETAPAS (Seções 8 e 9)
// ============================================================================

export interface PlanStep {
  id: string;
  order: number;
  objective: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  dependencies?: string[];
  risk: TaskRiskLevel;
  autonomyLevel: AutonomyLevel;
  requiresConfirmation: boolean;
  status: PlanStepStatus;
  reason?: string;
  result?: unknown;
  error?: string;
  executedAt?: string;
  latencyMs?: number;
  confirmationId?: string;
}

export interface AgentPlan {
  id: string;
  taskId: string;
  goal: string;
  summary: string; // Resumo explicável em linguagem natural (pt-BR)
  steps: PlanStep[];
  createdAt: string;
  status: 'created' | 'validating' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'replanned';
  version: number;
  modelUsed?: string;
  providerUsed?: string;
}

// ============================================================================
// 4. CONFIRMAÇÃO HUMANA E ARGUMENT BINDING (Seções 14, 15, 16, 17)
// ============================================================================

export interface HumanConfirmationRequest {
  id: string;
  taskId: string;
  stepId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  argumentsHash: string; // Hash SHA-256 canonical dos argumentos (Argument Binding)
  explanation: string;  // Mensagem não genérica ("Vou remover João da fila...")
  riskLevel: TaskRiskLevel;
  autonomyLevel: AutonomyLevel;
  tenantId: string;
  sessionId?: string;
  requestedAt: string;
  expiresAt: string;    // TTL de expiração (Seção 16)
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  resolvedBy?: {
    userId: string;
    role: string;
    displayName?: string;
  };
  resolvedAt?: string;
  rejectionReason?: string;
}

// ============================================================================
// 5. REGISTROS DE EXECUÇÃO E HISTÓRICO
// ============================================================================

export interface AgentExecutionRecord {
  stepId: string;
  order: number;
  toolName?: string;
  arguments?: unknown;
  result?: unknown;
  success: boolean;
  error?: string;
  timestamp: string;
  latencyMs: number;
}

// ============================================================================
// 6. ABSTRAÇÃO DE TAREFA DO AGENTE (AGENT TASK - Seção 6)
// ============================================================================

export interface AgentTaskLimits {
  maxSteps: number;
  maxDurationMs: number;
  maxCostUsd: number;
  maxToolCalls: number;
  confirmationTtlMs: number;
  maxConsecutiveFailures: number;
}

export interface AgentTaskMetrics {
  totalToolCalls: number;
  totalStepsExecuted: number;
  totalEstimatedCostUsd: number;
  replanCount: number;
  loopChecksCount: number;
}

export interface AgentTask {
  id: string;
  goal: string;
  
  // Isolamento confiável (Seções 22 e 23 - NUNCA decididos pelo LLM)
  tenantId: string;
  userId?: string;
  sessionId?: string;
  actorRole: string;
  channel?: string;
  correlationId: string;

  status: AgentTaskStatus;
  plan?: AgentPlan;
  currentStepIndex: number;

  confirmationRequest?: HumanConfirmationRequest;
  
  // Origem da percepção (Seção 26)
  perceptionOrigin?: {
    perceptionId: string;
    candidateIntent: string;
    eventId?: string;
    eventType?: string;
  };

  limits: AgentTaskLimits;
  metrics: AgentTaskMetrics;

  startTime: number;
  endTime?: number;
  durationMs?: number;

  executionHistory: AgentExecutionRecord[];

  createdAt: string;
  updatedAt: string;

  finalResult?: unknown;
  finalSummary?: string;
  errorMessage?: string;
  cancellationReason?: string;
}

// ============================================================================
// 7. OPÇÕES E PARÂMETROS DO RUNTIME
// ============================================================================

export interface AgentRuntimeOptions {
  maxSteps?: number;
  maxDurationMs?: number;
  maxCostUsd?: number;
  maxToolCalls?: number;
  confirmationTtlMs?: number;
  maxConsecutiveFailures?: number;
  domainProfileId?: string;
  skipExecution?: boolean;
  autoReplanOnFailure?: boolean;
  requireConfirmationForYellow?: boolean;
}

export interface CreateTaskParams {
  goal: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  actorRole?: string;
  channel?: string;
  correlationId?: string;
  options?: AgentRuntimeOptions;
  perceptionOrigin?: {
    perceptionId: string;
    candidateIntent: string;
    eventId?: string;
    eventType?: string;
  };
}

// ============================================================================
// 8. TELEMETRIA E MÉTRICAS DO RUNTIME
// ============================================================================

export interface AgentRuntimeMetrics {
  totalTasksCreated: number;
  activeTasks: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksCancelled: number;
  tasksAwaitingConfirmation: number;
  confirmationsApproved: number;
  confirmationsRejected: number;
  confirmationsExpired: number;
  loopsDetected: number;
  totalToolExecutions: number;
  totalEstimatedCostUsd: number;
  averageDurationMs: number;
  averageStepsPerTask: number;
}
