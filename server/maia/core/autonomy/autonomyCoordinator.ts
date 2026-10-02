/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTONOMY COORDINATOR (PROMPT 10)
 * Orquestrador central da Autonomia Controlada da MaIA no ecossistema Enlace.
 * 
 * Regra Arquitetural Absoluta:
 * «Autonomia não significa autorização.»
 * Fluxo:
 * Evento -> Trigger -> Policy Check -> Mode Resolution (OBSERVE | DRY_RUN | AUTO) ->
 * Agent Runtime -> Policy Engine -> Tool Registry -> Execução / Confirmação.
 */

import { randomUUID } from 'crypto';
import { DomainEvent } from '../events/types.js';
import { eventBus, MaiaEventBus } from '../events/eventBus.js';
import {
  AutonomyPolicy,
  AutonomyMode,
  AutonomyTier,
  AutonomyMetrics,
  AutonomyAuditRecord,
  AutonomyTrigger,
  AutonomyTriggerContext
} from './types.js';
import { autonomyPolicyManager, AutonomyPolicyManager } from './policyManager.js';
import { autonomyCircuitBreaker, AutonomyCircuitBreaker } from './circuitBreaker.js';
import { maiaEmergencyStop, MaiaEmergencyStop } from './emergencyStop.js';
import { autonomyTriggerEngine, AutonomyTriggerEngine } from './triggerEngine.js';
import { KARAOKE_AUTONOMY_TRIGGERS } from './triggers/karaokeTriggers.ts';
import { maiaAgentRuntime, MaiaAgentRuntime } from '../runtime/agentRuntime.js';
import { maiaPolicyEngine, MaiaPolicyEngine } from '../policy/policyEngine.js';
import { maiaToolRegistry, MaiaToolRegistry } from '../tools/toolRegistry.js';
import {
  MaiaAutonomyDisabledError,
  MaiaAutonomyEmergencyStopActiveError,
  MaiaAutonomyCircuitBreakerOpenError,
  MaiaAutonomyPolicyDeniedError
} from './errors.js';

export interface MaiaAutonomyCoordinatorDependencies {
  policyManager?: AutonomyPolicyManager;
  circuitBreaker?: AutonomyCircuitBreaker;
  emergencyStop?: MaiaEmergencyStop;
  triggerEngine?: AutonomyTriggerEngine;
  agentRuntime?: MaiaAgentRuntime;
  policyEngine?: MaiaPolicyEngine;
  toolRegistry?: MaiaToolRegistry;
  eventBus?: MaiaEventBus;
}

export class MaiaAutonomyCoordinator {
  private policyManager: AutonomyPolicyManager;
  private circuitBreaker: AutonomyCircuitBreaker;
  private emergencyStop: MaiaEmergencyStop;
  private triggerEngine: AutonomyTriggerEngine;
  private agentRuntime: MaiaAgentRuntime;
  private policyEngine: MaiaPolicyEngine;
  private toolRegistry: MaiaToolRegistry;
  private eventBus: MaiaEventBus;

  private isSubscribed = false;
  private subscriptionId?: string;

  // Auditoria circular em memória (Seção 40)
  private auditLog: AutonomyAuditRecord[] = [];
  private readonly maxAuditLogSize = 250;

  // Telemetria acumulada da camada de autonomia (Seção 39)
  private metrics: AutonomyMetrics = {
    totalEventsEvaluated: 0,
    triggersFired: 0,
    tasksSpawned: 0,
    tasksCompleted: 0,
    tasksPaused: 0,
    tasksFailed: 0,
    tasksCancelled: 0,
    humanTakeoversCount: 0,
    emergencyStopsCount: 0,
    circuitBreakerTrips: 0,
    observeOnlyCount: 0,
    dryRunCount: 0,
    actionsExecutedByRisk: {
      GREEN: 0,
      YELLOW: 0,
      RED: 0
    },
    costAccumulatedUsd: 0,
    averageEvaluationLatencyMs: 0
  };

  private evaluationLatencies: number[] = [];

  constructor(deps?: MaiaAutonomyCoordinatorDependencies) {
    this.policyManager = deps?.policyManager || autonomyPolicyManager;
    this.circuitBreaker = deps?.circuitBreaker || autonomyCircuitBreaker;
    this.emergencyStop = deps?.emergencyStop || maiaEmergencyStop;
    this.triggerEngine = deps?.triggerEngine || autonomyTriggerEngine;
    this.agentRuntime = deps?.agentRuntime || maiaAgentRuntime;
    this.policyEngine = deps?.policyEngine || maiaPolicyEngine;
    this.toolRegistry = deps?.toolRegistry || maiaToolRegistry;
    this.eventBus = deps?.eventBus || eventBus;

    // Registra gatilhos canônicos do domínio Karaokê
    for (const trig of KARAOKE_AUTONOMY_TRIGGERS) {
      this.triggerEngine.registerTrigger(trig);
    }
  }

  /**
   * Conecta a autonomia ao Barramento de Eventos
   */
  public start(): void {
    if (this.isSubscribed) return;

    const sub = this.eventBus.subscribe('karaoke.*', async (event: DomainEvent) => {
      await this.handleDomainEvent(event);
    });

    this.subscriptionId = sub.id;
    this.isSubscribed = true;
  }

  /**
   * Desconecta a autonomia
   */
  public stop(): void {
    if (this.subscriptionId) {
      this.eventBus.unsubscribe({ id: this.subscriptionId });
      this.subscriptionId = undefined;
    }
    this.isSubscribed = false;
  }

  /**
   * Processa um evento de domínio e avalia oportunidades proativas com segurança máxima
   */
  public async handleDomainEvent(
    event: DomainEvent,
    currentCascadeDepth = 0
  ): Promise<AutonomyAuditRecord[]> {
    const startTime = Date.now();
    this.metrics.totalEventsEvaluated++;

    const tenantId = event.tenantId || 'default-tenant';
    const auditRecords: AutonomyAuditRecord[] = [];

    // 1. Verificação de Parada de Emergência (Seção 28)
    if (this.emergencyStop.isEmergencyStopActive(tenantId)) {
      return [];
    }

    // 2. Verificação de Circuito de Autonomia (Seção 29)
    if (this.circuitBreaker.isOpen(tenantId)) {
      this.metrics.circuitBreakerTrips++;
      return [];
    }

    // 3. Política de Autonomia do Tenant (Seções 6 e 7)
    const policy = this.policyManager.getPolicy(tenantId);
    if (!policy.enabled || policy.mode === 'OFF' || policy.level === 0) {
      return [];
    }

    // 4. Limite de Profundidade em Cascata (Anti-Loop - Seções 13 e 26)
    if (currentCascadeDepth >= policy.maxCascadeDepth) {
      this.circuitBreaker.recordFailure(tenantId, true);
      console.warn(`[MaiaAutonomy] Limite de profundidade em cascata atingido (${currentCascadeDepth}/${policy.maxCascadeDepth}) para tenant '${tenantId}'. Interrupção preventiva.`);
      return [];
    }

    // 5. Montagem do Contexto de Avaliação do Gatilho
    const triggerCtx: AutonomyTriggerContext = {
      tenantId,
      sessionId: event.sessionId,
      payload: event.payload,
      currentQueueLength: event.payload?.queueLength,
      activeSinger: event.payload?.activeSinger || event.payload?.singerName || event.payload?.participantName,
      songTitle: event.payload?.songTitle || event.payload?.title,
      isSessionActive: event.payload?.sessionStatus ? event.payload.sessionStatus === 'ACTIVE' : true
    };

    // 6. Avaliação de Gatilhos Registrados (Seção 11)
    const matchedTriggers = this.triggerEngine.evaluateTriggers(event.type, triggerCtx, event.id);
    if (matchedTriggers.length === 0) {
      return [];
    }

    for (const trigger of matchedTriggers) {
      const audit = await this.executeTrigger(trigger, triggerCtx, event, policy, currentCascadeDepth);
      if (audit) {
        auditRecords.push(audit);
      }
    }

    const latency = Date.now() - startTime;
    this.evaluationLatencies.push(latency);
    if (this.evaluationLatencies.length > 100) this.evaluationLatencies.shift();
    const sum = this.evaluationLatencies.reduce((a, b) => a + b, 0);
    this.metrics.averageEvaluationLatencyMs = Math.round(sum / this.evaluationLatencies.length);

    return auditRecords;
  }

  /**
   * Executa um gatilho selecionado sob o modo de operação configurado
   */
  private async executeTrigger(
    trigger: AutonomyTrigger,
    ctx: AutonomyTriggerContext,
    event: DomainEvent,
    policy: AutonomyPolicy,
    cascadeDepth: number
  ): Promise<AutonomyAuditRecord | null> {
    this.metrics.triggersFired++;
    this.triggerEngine.markFired(trigger, ctx);

    const auditId = `audit-auto-${randomUUID()}`;
    const goal = trigger.candidateGoal(ctx);

    // Mapeamento de risco
    const riskLevel = trigger.riskLevel;
    const isGreen = (riskLevel as string) === 'READ' || (riskLevel as string) === 'LOW';
    const isYellow = (riskLevel as string) === 'ACTION' || (riskLevel as string) === 'MEDIUM';
    const isRed = (riskLevel as string) === 'HIGH_RISK' || (riskLevel as string) === 'CRITICAL' || (riskLevel as string) === 'HIGH';

    // ------------------------------------------------------------------------
    // MODO A: OBSERVE_ONLY (Seção 43)
    // ------------------------------------------------------------------------
    if (policy.mode === 'OBSERVE_ONLY') {
      this.metrics.observeOnlyCount++;
      const record: AutonomyAuditRecord = {
        id: auditId,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
        triggerId: trigger.id,
        eventType: event.type,
        eventId: event.id,
        policyResult: 'PERMITTED',
        riskLevel,
        autonomyMode: 'OBSERVE_ONLY',
        executionType: 'OBSERVE',
        argumentsSummary: { goal, suggestedAction: trigger.action },
        resultStatus: 'SIMULATED'
      };
      this.recordAudit(record);

      await this.eventBus.emit({
        name: 'maia.autonomy.observed',
        tenantId: ctx.tenantId,
        source: 'MaiaAutonomyCoordinator',
        payload: {
          triggerId: trigger.id,
          goal,
          mode: 'OBSERVE_ONLY',
          suggestedAction: trigger.action
        }
      });

      return record;
    }

    // ------------------------------------------------------------------------
    // MODO B: DRY_RUN (Seção 42)
    // ------------------------------------------------------------------------
    if (policy.mode === 'DRY_RUN') {
      this.metrics.dryRunCount++;
      const record: AutonomyAuditRecord = {
        id: auditId,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
        triggerId: trigger.id,
        eventType: event.type,
        eventId: event.id,
        policyResult: 'PERMITTED',
        riskLevel,
        autonomyMode: 'DRY_RUN',
        executionType: 'DRY_RUN',
        argumentsSummary: {
          simulatedGoal: goal,
          simulatedAction: trigger.action,
          wouldExecute: isGreen ? 'AUTOMATICALLY' : 'WITH_CONFIRMATION'
        },
        resultStatus: 'SIMULATED'
      };
      this.recordAudit(record);

      await this.eventBus.emit({
        name: 'maia.autonomy.dry_run_completed',
        tenantId: ctx.tenantId,
        source: 'MaiaAutonomyCoordinator',
        payload: {
          triggerId: trigger.id,
          goal,
          mode: 'DRY_RUN',
          action: trigger.action,
          simulatedRisk: riskLevel
        }
      });

      return record;
    }

    // ------------------------------------------------------------------------
    // MODO C: AUTONOMOUS (Seção 44)
    // ------------------------------------------------------------------------
    this.metrics.tasksSpawned++;

    try {
      // 1. Cria a tarefa no Agent Runtime com limites rígidos do Tenant
      const task = await this.agentRuntime.createTask({
        goal,
        tenantId: ctx.tenantId,
        sessionId: ctx.sessionId,
        actorRole: 'SYSTEM_AGENT',
        channel: 'controller',
        options: {
          maxSteps: policy.maxSteps,
          maxDurationMs: policy.maxDurationMs,
          maxCostUsd: policy.maxCostUsd,
          requireConfirmationForYellow: policy.requiresConfirmationForYellow || trigger.autonomyAction === 'CONFIRM'
        },
        perceptionOrigin: {
          perceptionId: `perc-auto-${randomUUID()}`,
          candidateIntent: trigger.action,
          eventId: event.id,
          eventType: event.type
        }
      });

      const auditRecord: AutonomyAuditRecord = {
        id: auditId,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
        triggerId: trigger.id,
        eventType: event.type,
        eventId: event.id,
        taskId: task.id,
        policyResult: 'PERMITTED',
        riskLevel,
        autonomyMode: 'AUTONOMOUS',
        executionType: 'REAL',
        argumentsSummary: { goal, taskId: task.id },
        resultStatus: 'SUCCESS'
      };

      // Atualiza métricas por risco
      if (isGreen) this.metrics.actionsExecutedByRisk.GREEN++;
      else if (isYellow) this.metrics.actionsExecutedByRisk.YELLOW++;
      else if (isRed) this.metrics.actionsExecutedByRisk.RED++;

      this.metrics.tasksCompleted++;
      this.circuitBreaker.recordSuccess(ctx.tenantId);
      this.recordAudit(auditRecord);

      await this.eventBus.emit({
        name: 'maia.autonomy.task_spawned',
        tenantId: ctx.tenantId,
        source: 'MaiaAutonomyCoordinator',
        payload: {
          triggerId: trigger.id,
          taskId: task.id,
          goal,
          riskLevel,
          status: task.status
        }
      });

      return auditRecord;
    } catch (err: any) {
      this.metrics.tasksFailed++;
      this.circuitBreaker.recordFailure(ctx.tenantId, false);

      const failRecord: AutonomyAuditRecord = {
        id: auditId,
        timestamp: new Date().toISOString(),
        tenantId: ctx.tenantId,
        triggerId: trigger.id,
        eventType: event.type,
        eventId: event.id,
        policyResult: 'DENIED',
        riskLevel,
        autonomyMode: 'AUTONOMOUS',
        executionType: 'REAL',
        resultStatus: 'FAILURE',
        failureReason: err?.message || 'Erro durante despacho da tarefa autônoma'
      };
      this.recordAudit(failRecord);
      return failRecord;
    }
  }

  /**
   * Aciona a Parada de Emergência (Seção 28)
   */
  public triggerEmergencyStop(tenantId?: string, reason?: string): void {
    this.emergencyStop.triggerEmergencyStop(tenantId, reason);
    this.metrics.emergencyStopsCount++;

    // Pausa tarefas ativas no Agent Runtime do tenant
    const activeTasks = this.agentRuntime.listTasks(tenantId, 'executing');
    for (const t of activeTasks) {
      this.agentRuntime.pauseTask(t.id, 'Parada de emergência acionada').catch(() => {});
      this.metrics.tasksPaused++;
    }

    this.eventBus.emit({
      name: 'maia.autonomy.emergency_stop',
      tenantId: tenantId || 'global',
      source: 'MaiaAutonomyCoordinator',
      payload: { reason: reason || 'Parada de emergência ativada pelo operador', tenantId }
    }).catch(() => {});
  }

  /**
   * Desativa a Parada de Emergência
   */
  public resetEmergencyStop(tenantId?: string): void {
    this.emergencyStop.resetEmergencyStop(tenantId);
  }

  /**
   * Aciona Human Takeover (Seção 27)
   */
  public triggerHumanTakeover(
    tenantId: string,
    operatorId: string,
    reason: string,
    sessionId?: string
  ): void {
    this.metrics.humanTakeoversCount++;

    // Interrompe imediatamente tarefas autônomas da MaIA naquele tenant/sessão
    const activeTasks = this.agentRuntime.listTasks(tenantId, 'executing');
    const affectedIds: string[] = [];

    for (const t of activeTasks) {
      affectedIds.push(t.id);
      this.agentRuntime.cancelTask(t.id, `Human Takeover pelo operador ${operatorId}: ${reason}`, tenantId).catch(() => {});
      this.metrics.tasksCancelled++;
    }

    this.emergencyStop.recordTakeover({
      tenantId,
      sessionId,
      operatorId,
      reason,
      timestamp: new Date().toISOString(),
      affectedTaskIds: affectedIds
    });

    this.eventBus.emit({
      name: 'maia.autonomy.human_takeover',
      tenantId,
      source: 'MaiaAutonomyCoordinator',
      payload: {
        operatorId,
        reason,
        affectedTaskIds: affectedIds
      }
    }).catch(() => {});
  }

  private recordAudit(record: AutonomyAuditRecord): void {
    this.auditLog.push(record);
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.shift();
    }
  }

  public getAuditLog(tenantId?: string): AutonomyAuditRecord[] {
    if (!tenantId) return [...this.auditLog];
    return this.auditLog.filter(a => a.tenantId === tenantId);
  }

  public getMetrics(): AutonomyMetrics {
    return { ...this.metrics };
  }
}

export const maiaAutonomyCoordinator = new MaiaAutonomyCoordinator();
