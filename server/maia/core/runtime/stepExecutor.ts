/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA STEP EXECUTOR (Seções 10, 11, 14, 28, 29, 30, 37)
 * Executor governado de etapas do plano.
 * Fluxo obrigatório:
 * Plan Step -> Policy Engine -> Authorization -> Tool Registry -> Validation -> Execution -> Tool Result (Data)
 */

import { randomUUID } from 'crypto';
import {
  AgentTask,
  PlanStep,
  HumanConfirmationRequest,
  AgentExecutionRecord
} from './types.js';
import { MaiaToolRegistry, maiaToolRegistry } from '../tools/toolRegistry.js';
import { MaiaPolicyEngine, maiaPolicyEngine } from '../policy/policyEngine.js';
import { MaiaConfirmationManager, maiaConfirmationManager } from './confirmationManager.js';
import { MaiaContext, MaiaTool } from '../types.js';
import {
  MaiaAgentPolicyRejectedError,
  MaiaAgentAwaitingConfirmationError,
  MaiaSecurityError,
  MaiaAgentArgumentMismatchError
} from './errors.js';
import { FORBIDDEN_TOOL_NAMES } from './planner.js';

export interface StepExecutionResult {
  step: PlanStep;
  status: 'completed' | 'failed' | 'awaiting_confirmation' | 'skipped';
  confirmationRequest?: HumanConfirmationRequest;
  result?: unknown;
  error?: string;
  latencyMs: number;
}

export interface MaiaStepExecutorDependencies {
  toolRegistry?: MaiaToolRegistry;
  policyEngine?: MaiaPolicyEngine;
  confirmationManager?: MaiaConfirmationManager;
}

export class MaiaStepExecutor {
  private toolRegistry: MaiaToolRegistry;
  private policyEngine: MaiaPolicyEngine;
  private confirmationManager: MaiaConfirmationManager;

  constructor(deps?: MaiaStepExecutorDependencies) {
    this.toolRegistry = deps?.toolRegistry || maiaToolRegistry;
    this.policyEngine = deps?.policyEngine || maiaPolicyEngine;
    this.confirmationManager = deps?.confirmationManager || maiaConfirmationManager;
  }

  /**
   * Determina se um erro de execução é transitório (permite retry) ou semântico/permanente (falha imediata)
   * (Seção 37)
   */
  public isTransientError(error: any): boolean {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    const code = String(error.code || error.errorCode || '').toUpperCase();

    // Erros transitórios de rede/timeout
    if (
      code === 'TIMEOUT' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      msg.includes('timeout') ||
      msg.includes('connection reset') ||
      msg.includes('temporariamente indisponível')
    ) {
      return true;
    }

    // Erros semânticos permanentes (não devem sofrer retry cego)
    // Ex: validação, permissão negada, não encontrado, violacao de tenant
    return false;
  }

  /**
   * Sanitiza e isola o resultado da ferramenta estritamente como DADOS (Seção 30)
   * NUNCA converte texto do resultado em instruções privilegiadas
   */
  public sanitizeToolResultAsData(rawResult: any): any {
    if (rawResult === null || rawResult === undefined) {
      return rawResult;
    }
    // Se for string com potencial payload malicioso, mantém como dado puro
    if (typeof rawResult === 'string') {
      return rawResult;
    }
    // Se for objeto, clona profundamente para evitar mutações de referências
    try {
      return JSON.parse(JSON.stringify(rawResult));
    } catch {
      return String(rawResult);
    }
  }

  /**
   * Executa uma etapa individual sob governança integral do Policy Engine e Tool Registry
   */
  public async executeStep(
    task: AgentTask,
    step: PlanStep,
    options?: { forceApprovedConfirmationId?: string }
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    step.status = 'executing';

    // 1. Etapa sem ferramenta (etapa lógica ou de síntese)
    if (!step.tool) {
      step.status = 'completed';
      step.result = { completed: true, objective: step.objective };
      step.executedAt = new Date().toISOString();
      step.latencyMs = Date.now() - startTime;

      return {
        step,
        status: 'completed',
        result: step.result,
        latencyMs: step.latencyMs
      };
    }

    // 2. Verificação de Ferramentas Proibidas (Seção 29)
    if (FORBIDDEN_TOOL_NAMES.has(step.tool.toLowerCase())) {
      const latencyMs = Date.now() - startTime;
      step.status = 'failed';
      step.error = `Execução bloqueada: ferramenta proibida '${step.tool}'.`;
      step.latencyMs = latencyMs;

      throw new MaiaSecurityError(step.error);
    }

    // 3. Obtenção do Contrato da Ferramenta no Tool Registry (Seção 20)
    const toolContract = this.toolRegistry.get(step.tool);
    if (!toolContract || !toolContract.enabled) {
      const latencyMs = Date.now() - startTime;
      step.status = 'failed';
      step.error = `A ferramenta '${step.tool}' não foi encontrada ou está inativa no Tool Registry.`;
      step.latencyMs = latencyMs;

      return {
        step,
        status: 'failed',
        error: step.error,
        latencyMs
      };
    }

    // 4. Montagem do Contexto Maia Core Confiável
    const coreContext: MaiaContext = {
      correlationId: task.correlationId,
      timestamp: new Date().toISOString(),
      tenant: { id: task.tenantId },
      session: { id: task.sessionId || 'active-session', status: 'ACTIVE' },
      actor: {
        id: task.userId || 'system-agent',
        role: task.actorRole,
        authenticated: task.actorRole !== 'ANONYMOUS'
      },
      environment: { channel: (task.channel as any) || 'web' },
      domain: {},
      history: []
    };

    const stepArgs = (step.arguments || {}) as Record<string, unknown>;
    // Isolamento multi-tenant estrito: força tenantId confiável
    stepArgs.tenantId = task.tenantId;

    // 5. Avaliação Obrigatória no Policy Engine (Seção 10 e 11)
    // O Agent Runtime NUNCA faz bypass no Policy Engine
    const legacyTool: MaiaTool = {
      name: toolContract.name,
      description: toolContract.description,
      category: toolContract.category,
      allowedRoles: toolContract.allowedRoles,
      requiredPermissions: toolContract.permissions,
      parameters: {
        type: 'object',
        properties: (toolContract.inputSchema?.properties as any) || {}
      },
      execute: async () => {}
    };

    const policyDecision = await this.policyEngine.evaluate(coreContext, legacyTool, stepArgs);
    if (!policyDecision.allowed) {
      const latencyMs = Date.now() - startTime;
      step.status = 'failed';
      step.error = `Operação rejeitada pelo Policy Engine: ${policyDecision.reason || 'Política de segurança negou execução'}`;
      step.latencyMs = latencyMs;

      return {
        step,
        status: 'failed',
        error: step.error,
        latencyMs
      };
    }

    // 6. Governança de Autonomia e Confirmação Humana (Seções 13, 14, 15, 16, 17)
    const requiresConfirmation = 
      policyDecision.requiresConfirmation || 
      step.requiresConfirmation ||
      step.autonomyLevel === 'RED' ||
      (step.autonomyLevel === 'YELLOW' && task.actorRole === 'PARTICIPANT');

    if (requiresConfirmation) {
      // Verifica se já temos uma confirmação aprovada válida
      let validConfirmation: HumanConfirmationRequest | undefined;

      if (options?.forceApprovedConfirmationId || step.confirmationId) {
        const confId = options?.forceApprovedConfirmationId || step.confirmationId!;
        const req = this.confirmationManager.getRequest(confId);

        if (req && req.status === 'approved' && !this.confirmationManager.isUsed(confId)) {
          // Validação de Argument Binding (Seção 17)
          const currentHash = this.confirmationManager.computeArgumentsHash(stepArgs);
          if (currentHash !== req.argumentsHash) {
            throw new MaiaAgentArgumentMismatchError(
              'Falha de Argument Binding: os argumentos foram alterados após a aprovação humana.'
            );
          }
          validConfirmation = req;
          this.confirmationManager.markAsUsed(confId);
        }
      }

      if (!validConfirmation) {
        // Interrompe imediatamente e gera solicitação de confirmação não-genérica (Seção 15)
        const confirmationRequest = this.confirmationManager.createRequest(task, step);
        step.confirmationId = confirmationRequest.id;
        step.status = 'pending';

        const latencyMs = Date.now() - startTime;
        return {
          step,
          status: 'awaiting_confirmation',
          confirmationRequest,
          latencyMs
        };
      }
    }

    // 7. Execução Controlada da Ferramenta via Tool Registry (Seção 28)
    task.metrics.totalToolCalls++;

    try {
      const executionResult = await this.toolRegistry.execute(
        {
          toolRequestId: randomUUID(),
          correlationId: task.correlationId,
          tenantId: task.tenantId,
          sessionId: task.sessionId || 'active-session',
          actorId: task.userId || 'system-agent',
          actorRole: task.actorRole,
          actorDisplayName: 'Operador / MaIA Agent',
          permissions: []
        },
        toolContract.id,
        stepArgs
      );

      const latencyMs = Date.now() - startTime;

      if (!executionResult.success) {
        step.status = 'failed';
        step.error = executionResult.error || 'Falha na execução da ferramenta.';
        step.latencyMs = latencyMs;

        return {
          step,
          status: 'failed',
          error: step.error,
          latencyMs
        };
      }

      // 8. O resultado da ferramenta é tratado estritamente como DADOS (Seção 30)
      const sanitizedData = this.sanitizeToolResultAsData(executionResult.data);
      step.status = 'completed';
      step.result = sanitizedData;
      step.executedAt = new Date().toISOString();
      step.latencyMs = latencyMs;

      return {
        step,
        status: 'completed',
        result: sanitizedData,
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      step.status = 'failed';
      step.error = err.message || 'Erro inesperado na execução da ferramenta.';
      step.latencyMs = latencyMs;

      return {
        step,
        status: 'failed',
        error: step.error,
        latencyMs
      };
    }
  }
}

export const maiaStepExecutor = new MaiaStepExecutor();
