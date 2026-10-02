/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE AGENT RUNTIME (PROMPT 08)
 * Orquestrador central do ciclo de vida de tarefas, controle de ciclos,
 * governança de autonomia (GREEN/YELLOW/RED), argument binding,
 * observabilidade e integração com Event Bus, Context Engine e Memory.
 * 
 * Ciclo Mandatório:
 * Goal -> Context -> Memory -> Planner -> Agent Runtime -> Policy Engine -> Tool Registry -> Tool -> Result -> Agent Runtime -> Replan -> Complete
 */

import { randomUUID } from 'crypto';
import {
  AgentTask,
  AgentTaskStatus,
  AgentPlan,
  PlanStep,
  HumanConfirmationRequest,
  CreateTaskParams,
  AgentRuntimeOptions,
  AgentRuntimeMetrics
} from './types.js';
import { MaiaPlanner, maiaPlanner } from './planner.js';
import { MaiaStepExecutor, maiaStepExecutor } from './stepExecutor.js';
import { MaiaLoopDetector, maiaLoopDetector } from './loopDetector.js';
import { MaiaConfirmationManager, maiaConfirmationManager } from './confirmationManager.js';
import { MaiaTaskStore, maiaTaskStore } from './taskStore.js';
import { MaiaIdentityEngine, maiaIdentityEngine } from '../identity/identityEngine.js';
import { MaiaContextEngine, maiaContextEngine } from '../context/contextEngine.js';
import { MaiaToolRegistry, maiaToolRegistry } from '../tools/toolRegistry.js';
import { MaiaPolicyEngine, maiaPolicyEngine } from '../policy/policyEngine.js';
import { MaiaEventBus, maiaEventBus } from '../events/eventBus.js';
import { MaiaAIRouter, maiaAIRouter } from '../router/aiRouter.js';
import { IMaiaMemoryStore } from '../types.js';
import { maiaMemoryEngine } from '../memory/memoryEngine.js';
import { MaiaPerceptionRecord } from '../perception/types.js';
import {
  MaiaAgentRequest,
  MaiaAgentResponse,
  MaiaToolExecutionResult
} from '../types.js';
import {
  MaiaNotFoundError,
  MaiaSecurityError,
  MaiaAgentTaskCancelledError,
  MaiaAgentLoopDetectedError,
  MaiaAgentTimeoutError
} from './errors.js';

export interface MaiaAgentRuntimeDependencies {
  planner?: MaiaPlanner;
  stepExecutor?: MaiaStepExecutor;
  loopDetector?: MaiaLoopDetector;
  confirmationManager?: MaiaConfirmationManager;
  taskStore?: MaiaTaskStore;
  identityEngine?: MaiaIdentityEngine;
  contextEngine?: MaiaContextEngine;
  toolRegistry?: MaiaToolRegistry;
  policyEngine?: MaiaPolicyEngine;
  eventBus?: MaiaEventBus;
  aiRouter?: MaiaAIRouter;
  memoryEngine?: IMaiaMemoryStore;
}

export class MaiaAgentRuntime {
  public readonly planner: MaiaPlanner;
  public readonly stepExecutor: MaiaStepExecutor;
  public readonly loopDetector: MaiaLoopDetector;
  public readonly confirmationManager: MaiaConfirmationManager;
  public readonly taskStore: MaiaTaskStore;

  private identity: MaiaIdentityEngine;
  private contextEngine: MaiaContextEngine;
  private toolRegistry: MaiaToolRegistry;
  private policy: MaiaPolicyEngine;
  private eventBus: MaiaEventBus;
  private router: MaiaAIRouter;
  private memory: IMaiaMemoryStore;

  // Telemetria global do Agent Runtime
  private metrics: AgentRuntimeMetrics = {
    totalTasksCreated: 0,
    activeTasks: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    tasksCancelled: 0,
    tasksAwaitingConfirmation: 0,
    confirmationsApproved: 0,
    confirmationsRejected: 0,
    confirmationsExpired: 0,
    loopsDetected: 0,
    totalToolExecutions: 0,
    totalEstimatedCostUsd: 0,
    averageDurationMs: 0,
    averageStepsPerTask: 0
  };

  private durations: number[] = [];
  private stepsCounts: number[] = [];

  constructor(deps?: MaiaAgentRuntimeDependencies) {
    this.planner = deps?.planner || maiaPlanner;
    this.stepExecutor = deps?.stepExecutor || maiaStepExecutor;
    this.loopDetector = deps?.loopDetector || maiaLoopDetector;
    this.confirmationManager = deps?.confirmationManager || maiaConfirmationManager;
    this.taskStore = deps?.taskStore || maiaTaskStore;

    this.identity = deps?.identityEngine || maiaIdentityEngine;
    this.contextEngine = deps?.contextEngine || maiaContextEngine;
    this.toolRegistry = deps?.toolRegistry || maiaToolRegistry;
    this.policy = deps?.policyEngine || maiaPolicyEngine;
    this.eventBus = deps?.eventBus || maiaEventBus;
    this.router = deps?.aiRouter || maiaAIRouter;
    this.memory = deps?.memoryEngine || maiaMemoryEngine;
  }

  // ============================================================================
  // 1. GESTÃO DO CICLO DE VIDA DE TAREFAS (TASK LIFECYCLE)
  // ============================================================================

  /**
   * Cria e inicializa uma nova tarefa do agente (Seção 6)
   */
  public async createTask(params: CreateTaskParams): Promise<AgentTask> {
    if (!params.tenantId) {
      throw new MaiaSecurityError('tenantId é estritamente obrigatório para iniciar qualquer tarefa do agente.');
    }
    if (!params.goal || !params.goal.trim()) {
      throw new MaiaSecurityError('Objetivo (goal) da tarefa não pode estar vazio.');
    }

    const taskId = `task-${randomUUID()}`;
    const correlationId = params.correlationId || `corr-${randomUUID()}`;
    const nowIso = new Date().toISOString();

    const limits = {
      maxSteps: params.options?.maxSteps || 10,
      maxDurationMs: params.options?.maxDurationMs || 30000,
      maxCostUsd: params.options?.maxCostUsd || 0.10,
      maxToolCalls: params.options?.maxToolCalls || 15,
      confirmationTtlMs: params.options?.confirmationTtlMs || 60000,
      maxConsecutiveFailures: params.options?.maxConsecutiveFailures || 3
    };

    const task: AgentTask = {
      id: taskId,
      goal: params.goal.trim(),
      tenantId: params.tenantId,
      userId: params.userId,
      sessionId: params.sessionId,
      actorRole: params.actorRole || 'CONTROLLER',
      channel: params.channel || 'web',
      correlationId,
      status: 'pending',
      currentStepIndex: 0,
      perceptionOrigin: params.perceptionOrigin,
      limits,
      metrics: {
        totalToolCalls: 0,
        totalStepsExecuted: 0,
        totalEstimatedCostUsd: 0,
        replanCount: 0,
        loopChecksCount: 0
      },
      startTime: Date.now(),
      executionHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    this.taskStore.save(task);
    this.metrics.totalTasksCreated++;
    this.metrics.activeTasks++;

    // Emite evento oficial no Event Bus (Seção 27)
    await this.eventBus.emit({
      name: 'maia.agent.task_created',
      tenantId: task.tenantId,
      source: 'MaiaAgentRuntime',
      correlationId: task.correlationId,
      payload: {
        taskId: task.id,
        goal: task.goal,
        actorRole: task.actorRole,
        limits: task.limits,
        perceptionOrigin: task.perceptionOrigin
      }
    });

    return task;
  }

  /**
   * Executa a tarefa no ciclo fechado com detecção de loops e limites rígidos
   */
  public async executeTask(taskId: string, tenantId?: string): Promise<AgentTask> {
    const task = this.taskStore.get(taskId, tenantId);
    if (!task) {
      throw new MaiaNotFoundError(`Tarefa '${taskId}' não encontrada.`);
    }

    if (['completed', 'failed', 'cancelled', 'expired', 'loop_detected'].includes(task.status)) {
      return task;
    }

    return this.runTaskLoop(task);
  }

  /**
   * Ciclo de controle principal do agente (Agent Loop - Seção 4 e 5)
   */
  private async runTaskLoop(task: AgentTask): Promise<AgentTask> {
    const isTerminal = (status: AgentTaskStatus) =>
      ['completed', 'failed', 'cancelled', 'expired', 'loop_detected', 'awaiting_confirmation', 'paused'].includes(status);

    while (!isTerminal(task.status)) {
      // 1. DETECÇÃO ATIVA DE CICLOS E LIMITES (Seções 5, 35 e 36)
      const loopCheck = this.loopDetector.check(task);
      if (loopCheck.hasLoop) {
        task.status = 'loop_detected';
        task.errorMessage = loopCheck.reason || 'Execução interrompida por ciclo vicioso ou estouro de limites.';
        task.endTime = Date.now();
        task.durationMs = task.endTime - task.startTime;

        this.metrics.loopsDetected++;
        this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
        this.metrics.tasksFailed++;

        this.taskStore.save(task);

        await this.eventBus.emit({
          name: 'maia.agent.loop_detected',
          tenantId: task.tenantId,
          source: 'MaiaAgentRuntime',
          correlationId: task.correlationId,
          payload: {
            taskId: task.id,
            code: loopCheck.code,
            reason: loopCheck.reason
          }
        });

        await this.eventBus.emit({
          name: 'maia.agent.task_failed',
          tenantId: task.tenantId,
          source: 'MaiaAgentRuntime',
          correlationId: task.correlationId,
          payload: {
            taskId: task.id,
            error: task.errorMessage,
            reason: loopCheck.code
          }
        });

        break;
      }

      // 2. FASE DE PLANEJAMENTO SE PENDENTE OU REPLANEJAMENTO (Seções 4, 8, 18)
      if (task.status === 'pending' || task.status === 'planning') {
        task.status = 'planning';
        this.taskStore.save(task);

        try {
          const plan = await this.planner.createPlan(task);
          task.plan = plan;
          task.status = 'executing';
          this.taskStore.save(task);

          await this.eventBus.emit({
            name: 'maia.agent.plan_created',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              planId: plan.id,
              summary: plan.summary,
              totalSteps: plan.steps.length,
              modelUsed: plan.modelUsed
            }
          });
        } catch (planErr: any) {
          task.status = 'failed';
          task.errorMessage = `Falha no planejamento da tarefa: ${planErr.message}`;
          task.endTime = Date.now();
          task.durationMs = task.endTime - task.startTime;

          this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
          this.metrics.tasksFailed++;
          this.taskStore.save(task);

          await this.eventBus.emit({
            name: 'maia.agent.task_failed',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: { taskId: task.id, error: task.errorMessage }
          });
          break;
        }
      }

      // 3. FASE DE EXECUÇÃO DE ETAPA (Seção 4, 10, 11, 28)
      if (task.status === 'executing') {
        if (!task.plan || task.currentStepIndex >= task.plan.steps.length) {
          // Todas as etapas foram concluídas com sucesso
          task.status = 'completed';
          task.endTime = Date.now();
          task.durationMs = task.endTime - task.startTime;
          task.finalSummary = task.plan?.summary || 'Tarefa concluída com sucesso.';

          this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
          this.metrics.tasksCompleted++;
          this.recordCompletionMetrics(task.durationMs, task.metrics.totalStepsExecuted);

          this.taskStore.save(task);

          await this.eventBus.emit({
            name: 'maia.agent.task_completed',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              durationMs: task.durationMs,
              totalStepsExecuted: task.metrics.totalStepsExecuted,
              totalToolCalls: task.metrics.totalToolCalls
            }
          });
          break;
        }

        const step = task.plan.steps[task.currentStepIndex];

        await this.eventBus.emit({
          name: 'maia.agent.step_started',
          tenantId: task.tenantId,
          source: 'MaiaAgentRuntime',
          correlationId: task.correlationId,
          payload: {
            taskId: task.id,
            stepId: step.id,
            order: step.order,
            objective: step.objective,
            tool: step.tool
          }
        });

        const stepResult = await this.stepExecutor.executeStep(task, step);

        // CASO A: Exigiu confirmação humana -> Suspende o loop e aguarda (Seção 14)
        if (stepResult.status === 'awaiting_confirmation') {
          task.status = 'awaiting_confirmation';
          task.confirmationRequest = stepResult.confirmationRequest;
          this.metrics.tasksAwaitingConfirmation++;

          this.taskStore.save(task);

          await this.eventBus.emit({
            name: 'maia.agent.confirmation_required',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              confirmationId: stepResult.confirmationRequest?.id,
              stepId: step.id,
              tool: step.tool,
              explanation: stepResult.confirmationRequest?.explanation,
              expiresAt: stepResult.confirmationRequest?.expiresAt
            }
          });
          break; // Pausa o loop até intervenção humana
        }

        // CASO B: Etapa concluída com sucesso
        if (stepResult.status === 'completed') {
          task.metrics.totalStepsExecuted++;
          this.metrics.totalToolExecutions++;

          task.executionHistory.push({
            stepId: step.id,
            order: step.order,
            toolName: step.tool,
            arguments: step.arguments,
            result: stepResult.result,
            success: true,
            timestamp: new Date().toISOString(),
            latencyMs: stepResult.latencyMs
          });

          await this.eventBus.emit({
            name: 'maia.agent.step_completed',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              stepId: step.id,
              tool: step.tool,
              latencyMs: stepResult.latencyMs
            }
          });

          task.currentStepIndex++;
          this.taskStore.save(task);
          continue;
        }

        // CASO C: Falha na etapa (Seção 37)
        if (stepResult.status === 'failed') {
          task.metrics.totalStepsExecuted++;
          task.executionHistory.push({
            stepId: step.id,
            order: step.order,
            toolName: step.tool,
            arguments: step.arguments,
            error: stepResult.error,
            success: false,
            timestamp: new Date().toISOString(),
            latencyMs: stepResult.latencyMs
          });

          await this.eventBus.emit({
            name: 'maia.agent.step_failed',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              stepId: step.id,
              tool: step.tool,
              error: stepResult.error
            }
          });

          // Se a etapa falhou e a política permite replanejamento
          if (task.metrics.replanCount < 2 && !this.stepExecutor.isTransientError(stepResult.error)) {
            task.metrics.replanCount++;
            task.status = 'planning'; // Tenta replanejar com o erro como dado
            this.taskStore.save(task);
            continue;
          }

          // Falha terminal da tarefa
          task.status = 'failed';
          task.errorMessage = stepResult.error || 'Falha na execução da etapa.';
          task.endTime = Date.now();
          task.durationMs = task.endTime - task.startTime;

          this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
          this.metrics.tasksFailed++;
          this.taskStore.save(task);

          await this.eventBus.emit({
            name: 'maia.agent.task_failed',
            tenantId: task.tenantId,
            source: 'MaiaAgentRuntime',
            correlationId: task.correlationId,
            payload: {
              taskId: task.id,
              failedStepId: step.id,
              error: task.errorMessage
            }
          });
          break;
        }
      }
    }

    return task;
  }

  // ============================================================================
  // 2. INTERVENÇÃO E CONFIRMAÇÃO HUMANA (HUMAN IN THE LOOP - Seções 14, 15, 16, 17)
  // ============================================================================

  /**
   * Responde a uma solicitação de confirmação humana pendente (Aprovar ou Rejeitar)
   */
  public async confirmStep(params: {
    taskId: string;
    confirmationId: string;
    decision: 'approved' | 'rejected';
    resolver: {
      userId: string;
      role: string;
      displayName?: string;
    };
    providedArguments?: Record<string, unknown>;
    rejectionReason?: string;
  }): Promise<AgentTask> {
    const task = this.taskStore.get(params.taskId);
    if (!task) {
      throw new MaiaNotFoundError(`Tarefa '${params.taskId}' não encontrada.`);
    }

    if (task.status !== 'awaiting_confirmation') {
      throw new MaiaSecurityError(`A tarefa '${params.taskId}' não está aguardando confirmação (status atual: ${task.status}).`);
    }

    // Resolve no confirmationManager com validações de RBAC, TTL e Argument Binding (Seções 16 e 17)
    const resolvedReq = this.confirmationManager.resolve({
      confirmationId: params.confirmationId,
      decision: params.decision,
      resolver: params.resolver,
      providedArguments: params.providedArguments,
      rejectionReason: params.rejectionReason
    });

    task.confirmationRequest = resolvedReq;
    this.metrics.tasksAwaitingConfirmation = Math.max(0, this.metrics.tasksAwaitingConfirmation - 1);

    await this.eventBus.emit({
      name: 'maia.agent.confirmation_resolved',
      tenantId: task.tenantId,
      source: 'MaiaAgentRuntime',
      correlationId: task.correlationId,
      payload: {
        taskId: task.id,
        confirmationId: params.confirmationId,
        decision: params.decision,
        resolvedBy: params.resolver
      }
    });

    if (params.decision === 'rejected') {
      this.metrics.confirmationsRejected++;
      // Ação rejeitada pelo operador -> tarefa cancelada com motivo explícito
      task.status = 'cancelled';
      task.cancellationReason = params.rejectionReason || 'Ação rejeitada pelo operador responsável.';
      task.endTime = Date.now();
      task.durationMs = task.endTime - task.startTime;

      this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
      this.metrics.tasksCancelled++;
      this.taskStore.save(task);

      await this.eventBus.emit({
        name: 'maia.agent.task_cancelled',
        tenantId: task.tenantId,
        source: 'MaiaAgentRuntime',
        correlationId: task.correlationId,
        payload: {
          taskId: task.id,
          reason: task.cancellationReason
        }
      });

      return task;
    }

    // Aprovada: continua a execução da etapa suspensa
    this.metrics.confirmationsApproved++;
    task.status = 'executing';
    this.taskStore.save(task);

    const step = task.plan?.steps[task.currentStepIndex];
    if (step) {
      step.status = 'approved';
      // Executa a etapa autorizada diretamente com a confirmação válida
      const stepExec = await this.stepExecutor.executeStep(task, step, {
        forceApprovedConfirmationId: params.confirmationId
      });

      if (stepExec.status === 'completed') {
        task.metrics.totalStepsExecuted++;
        this.metrics.totalToolExecutions++;

        task.executionHistory.push({
          stepId: step.id,
          order: step.order,
          toolName: step.tool,
          arguments: step.arguments,
          result: stepExec.result,
          success: true,
          timestamp: new Date().toISOString(),
          latencyMs: stepExec.latencyMs
        });

        await this.eventBus.emit({
          name: 'maia.agent.step_completed',
          tenantId: task.tenantId,
          source: 'MaiaAgentRuntime',
          correlationId: task.correlationId,
          payload: {
            taskId: task.id,
            stepId: step.id,
            tool: step.tool,
            latencyMs: stepExec.latencyMs
          }
        });

        task.currentStepIndex++;
      } else if (stepExec.status === 'failed') {
        task.status = 'failed';
        task.errorMessage = stepExec.error;
        task.endTime = Date.now();
        task.durationMs = task.endTime - task.startTime;

        this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
        this.metrics.tasksFailed++;
        this.taskStore.save(task);
        return task;
      }
    }

    // Retoma o loop para as etapas subsequentes
    return this.runTaskLoop(task);
  }

  /**
   * Cancela voluntariamente uma tarefa
   */
  public async cancelTask(taskId: string, reason: string, tenantId?: string): Promise<AgentTask> {
    const task = this.taskStore.get(taskId, tenantId);
    if (!task) {
      throw new MaiaNotFoundError(`Tarefa '${taskId}' não encontrada.`);
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return task;
    }

    task.status = 'cancelled';
    task.cancellationReason = reason || 'Cancelada pelo usuário';
    task.endTime = Date.now();
    task.durationMs = task.endTime - task.startTime;

    this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
    this.metrics.tasksCancelled++;
    this.taskStore.save(task);

    await this.eventBus.emit({
      name: 'maia.agent.task_cancelled',
      tenantId: task.tenantId,
      source: 'MaiaAgentRuntime',
      correlationId: task.correlationId,
      payload: { taskId: task.id, reason: task.cancellationReason }
    });

    return task;
  }

  /**
   * Obtém uma tarefa pelo ID
   */
  public getTask(taskId: string, tenantId?: string): AgentTask | undefined {
    return this.taskStore.get(taskId, tenantId);
  }

  /**
   * Lista tarefas de um tenant
   */
  public listTasks(tenantId?: string, status?: AgentTaskStatus): AgentTask[] {
    return this.taskStore.list(tenantId || '', { status });
  }

  /**
   * Pausa uma tarefa em execução
   */
  public async pauseTask(taskId: string, reason?: string, tenantId?: string): Promise<AgentTask> {
    const task = this.taskStore.get(taskId, tenantId);
    if (!task) {
      throw new MaiaNotFoundError(`Tarefa '${taskId}' não encontrada.`);
    }

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      return task;
    }

    task.status = 'paused';
    task.updatedAt = new Date().toISOString();
    this.taskStore.save(task);

    await this.eventBus.emit({
      name: 'maia.agent.task_paused',
      tenantId: task.tenantId,
      source: 'MaiaAgentRuntime',
      correlationId: task.correlationId,
      payload: { taskId: task.id, reason: reason || 'Tarefa pausada' }
    });

    return task;
  }

  // ============================================================================
  // 3. INTEGRAÇÃO COM MAIA PERCEPTION (Seção 26)
  // ============================================================================

  /**
   * Converte um registro de percepção com candidata a intenção em tarefa controlada
   */
  public async handlePerception(perception: MaiaPerceptionRecord): Promise<AgentTask | null> {
    // 1. Ignora percepções sem intenção acionável ou irrelevantes
    if (
      perception.candidateIntent === 'NONE' ||
      perception.candidateIntent === 'OBSERVE_ONLY' ||
      perception.relevance === 'IGNORED'
    ) {
      return null;
    }

    // 2. Mapeamento seguro da candidata a intenção para um objetivo (Seção 26)
    let goal = '';
    switch (perception.candidateIntent) {
      case 'ANNOUNCE_SINGER':
        goal = `Anunciar o próximo cantor chamado (${perception.contextCorrelation?.activeSinger || 'palco'}) com entusiasmo.`;
        break;
      case 'CELEBRATE_PERFORMANCE':
        goal = `Celebrar a apresentação finalizada de '${perception.contextCorrelation?.songTitle || 'música'}' e convidar a plateia para aplaudir.`;
        break;
      case 'ENCOURAGE_AUDIENCE':
        goal = 'Engajar e convidar a plateia para escolher músicas e cantar na fila do karaokê.';
        break;
      case 'ALERT_OPERATOR_ABSENCE':
        goal = 'Notificar a mesa de som sobre ausência de participante e reorganizar o estado da fila.';
        break;
      case 'NOTIFY_SESSION_ENDING':
        goal = 'Avisar sobre os últimos momentos da sessão atual e verificar prorrogação.';
        break;
      case 'WELCOME_AUDIENCE':
        goal = 'Boas-vindas oficiais ao karaokê VozPlay.';
        break;
      case 'HANDLE_EMERGENCY':
        // Operação sensível: nunca criar tarefa com execução autônoma imediata sem confirmação
        goal = 'Verificar integridade da sessão após evento emergencial.';
        break;
      default:
        goal = `Analisar evento percebido: ${perception.summary}`;
    }

    // 3. Cria a tarefa sob supervisão com limites seguros
    return this.createTask({
      goal,
      tenantId: perception.tenantId,
      sessionId: perception.sessionId,
      actorRole: 'SYSTEM_AGENT',
      correlationId: perception.contextCorrelation?.correlationId,
      perceptionOrigin: {
        perceptionId: perception.id,
        candidateIntent: perception.candidateIntent,
        eventId: perception.eventId,
        eventType: perception.eventType
      },
      options: {
        maxSteps: 4,
        maxDurationMs: 15000,
        requireConfirmationForYellow: true
      }
    });
  }

  // ============================================================================
  // 4. TELEMETRIA E OBSERVABILIDADE (MÉTRICAS DO RUNTIME)
  // ============================================================================

  public getMetrics(): AgentRuntimeMetrics {
    return { ...this.metrics };
  }

  private recordCompletionMetrics(durationMs: number, stepsCount: number): void {
    this.durations.push(durationMs);
    this.stepsCounts.push(stepsCount);

    if (this.durations.length > 100) this.durations.shift();
    if (this.stepsCounts.length > 100) this.stepsCounts.shift();

    const sumDur = this.durations.reduce((a, b) => a + b, 0);
    this.metrics.averageDurationMs = Math.round(sumDur / this.durations.length);

    const sumSteps = this.stepsCounts.reduce((a, b) => a + b, 0);
    this.metrics.averageStepsPerTask = Number((sumSteps / this.stepsCounts.length).toFixed(2));
  }

  // ============================================================================
  // 5. COMPATIBILIDADE RETROATIVA (EXECUTE MAIA AGENT REQUEST)
  // ============================================================================

  /**
   * Ciclo de execução conversacional direta da MaIA Core (Fases 02-07)
   * Preserva compatibilidade total com os testes e funcionalidades existentes.
   */
  public async execute(request: MaiaAgentRequest): Promise<MaiaAgentResponse> {
    const startTime = Date.now();
    const correlationId = request.context.correlationId;
    const tenantId = request.context.tenant.id;
    const sessionId = request.context.session.id;
    const actorId = request.context.actor.id;

    // 1. Defesa ativa contra tampering / prompt injection
    if (this.identity.detectIdentityTampering(request.userMessage)) {
      const defensiveText = 'Olá! Eu sou a MaIA, a inteligência oficial do sistema. Minha identidade e princípios de segurança são inegociáveis, mas estou totalmente à disposição para te ajudar nas operações autorizadas!';
      const latencyMs = Date.now() - startTime;
      return {
        text: defensiveText,
        role: 'maia',
        correlationId,
        latencyMs,
        fallbackOccurred: false,
        timestamp: new Date().toISOString()
      };
    }

    // 2. Recuperação de memória recente
    const history = await this.memory.getConversationHistory(tenantId, sessionId, actorId, 6);
    const enrichedContext = {
      ...this.contextEngine.sanitizeContext(request.context),
      history
    };

    // 3. Diretriz de sistema
    const systemPrompt = this.identity.buildSystemPrompt({
      context: enrichedContext,
      domainProfileId: request.options?.domainProfileId
    });

    const toolInvocations: MaiaToolExecutionResult[] = [];

    // 4. Síntese via AI Router
    const routingResult = await this.router.executeWithFallback<string>({
      tenantId,
      task: 'CHAT',
      preferredProviderId: 'gemini_enlace',
      options: {
        systemInstruction: systemPrompt,
        correlationId
      },
      action: async (provider) => {
        return provider.generateText(request.userMessage, {
          systemInstruction: systemPrompt,
          correlationId
        });
      },
      localContingency: () => {
        if (request.context.actor.role === 'PARTICIPANT') {
          return 'Estou aqui com você curtindo cada momento da festa! Meu canal principal de inteligência oscilou, mas o sistema segue 100% no ar.';
        }
        return 'MaIA operando em modo de resiliência local. O sistema e a fila permanecem íntegros.';
      }
    });

    const replyText = routingResult.result;
    const latencyMs = Date.now() - startTime;

    // 5. Persistência de memória
    const nowIso = new Date().toISOString();
    await this.memory.appendConversationTurn(tenantId, sessionId, actorId, {
      role: 'user',
      text: request.userMessage,
      timestamp: nowIso
    });
    await this.memory.appendConversationTurn(tenantId, sessionId, actorId, {
      role: 'assistant',
      text: replyText,
      timestamp: new Date().toISOString()
    });

    // 6. Emissão no Barramento de Eventos
    this.eventBus.emit({
      name: 'maia.agent.interaction_completed',
      tenantId,
      source: 'MaiaAgentRuntime',
      payload: {
        actorId,
        actorRole: request.context.actor.role,
        correlationId,
        latencyMs,
        providerUsed: routingResult.usedProviderId,
        fallbackOccurred: routingResult.fallbackOccurred
      },
      correlationId
    }).catch(() => {});

    return {
      text: replyText,
      role: 'maia',
      correlationId,
      toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
      providerUsed: routingResult.usedProviderId,
      latencyMs,
      fallbackOccurred: routingResult.fallbackOccurred,
      timestamp: new Date().toISOString()
    };
  }
}

export const maiaAgentRuntime = new MaiaAgentRuntime();
