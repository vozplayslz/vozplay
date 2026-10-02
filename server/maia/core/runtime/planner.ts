/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AGENT PLANNER (Seções 7, 8, 9, 10, 18, 19, 20, 21, 22, 23, 29, 31, 34)
 * Planejador estruturado e governado da MaIA.
 * Converte objetivos em planos estruturados validados contra o Tool Registry,
 * sem autoridade autônoma de execução e com isolamento total multi-tenant.
 */

import { randomUUID } from 'crypto';
import {
  AgentTask,
  AgentPlan,
  PlanStep,
  TaskRiskLevel,
  AutonomyLevel
} from './types.js';
import { MaiaToolRegistry, maiaToolRegistry } from '../tools/toolRegistry.js';
import { MaiaAIRouter, maiaAIRouter } from '../router/aiRouter.js';
import { MaiaContextEngine, maiaContextEngine } from '../context/contextEngine.js';
import { IMaiaMemoryStore } from '../types.js';
import { maiaMemoryEngine } from '../memory/memoryEngine.js';
import { ToolRiskLevel } from '../tools/types.js';
import {
  MaiaAgentInvalidPlanError,
  MaiaSecurityError,
  MaiaAgentToolNotFoundError
} from './errors.js';

// Lista explícita de ferramentas terminantemente proibidas no ecossistema (Fase 11 / Menor Privilégio)
export const FORBIDDEN_TOOL_NAMES = new Set([
  'executeshell',
  'executesql',
  'execute_sql',
  'raw_sql',
  'database_query',
  'runpython',
  'runjavascript',
  'dockerexec',
  'filesystemwrite',
  'arbitraryhttp',
  'eval',
  'bash',
  'sh',
  'zsh',
  'cmd',
  'powershell',
  'python',
  'python3',
  'node',
  'docker',
  'kubectl',
  'ssh',
  'sudo',
  'su'
]);

export interface MaiaPlannerDependencies {
  toolRegistry?: MaiaToolRegistry;
  aiRouter?: MaiaAIRouter;
  contextEngine?: MaiaContextEngine;
  memoryStore?: IMaiaMemoryStore;
}

export class MaiaPlanner {
  private toolRegistry: MaiaToolRegistry;
  private aiRouter: MaiaAIRouter;
  private contextEngine: MaiaContextEngine;
  private memoryStore: IMaiaMemoryStore;

  constructor(deps?: MaiaPlannerDependencies) {
    this.toolRegistry = deps?.toolRegistry || maiaToolRegistry;
    this.aiRouter = deps?.aiRouter || maiaAIRouter;
    this.contextEngine = deps?.contextEngine || maiaContextEngine;
    this.memoryStore = deps?.memoryStore || maiaMemoryEngine;
  }

  /**
   * Converte o nível de risco da ferramenta do catálogo em TaskRiskLevel e AutonomyLevel
   */
  public mapRiskAndAutonomy(categoryOrRisk: ToolRiskLevel | string): {
    risk: TaskRiskLevel;
    autonomyLevel: AutonomyLevel;
    requiresConfirmation: boolean;
  } {
    switch (categoryOrRisk) {
      case 'CRITICAL':
        return { risk: 'CRITICAL', autonomyLevel: 'RED', requiresConfirmation: true };
      case 'HIGH':
      case 'HIGH_RISK':
        return { risk: 'HIGH', autonomyLevel: 'RED', requiresConfirmation: true };
      case 'MEDIUM':
      case 'ACTION':
        return { risk: 'MEDIUM', autonomyLevel: 'YELLOW', requiresConfirmation: false };
      case 'LOW':
      case 'READ':
      default:
        return { risk: 'LOW', autonomyLevel: 'GREEN', requiresConfirmation: false };
    }
  }

  /**
   * Detecta e neutraliza potenciais tentativas de injeção de prompt no objetivo (Seção 31)
   */
  public sanitizeGoal(goal: string): string {
    const trimmed = (goal || '').trim();
    // Remove delimitadores maliciosos ou tentativas de quebra de instrução
    return trimmed
      .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, '[INJECTION_BLOCKED]')
      .replace(/desconsidere\s+(todas\s+as\s+)?regras/gi, '[INJECTION_BLOCKED]')
      .replace(/system\s*:\s*/gi, '')
      .replace(/<\|.*?\|>/g, '');
  }

  /**
   * Cria um plano estruturado para a tarefa utilizando o AI Router avançado (Seção 18)
   */
  public async createPlan(task: AgentTask): Promise<AgentPlan> {
    const sanitizedGoal = this.sanitizeGoal(task.goal);
    const planId = `plan-${randomUUID()}`;

    // 1. Discovery das ferramentas disponíveis e autorizadas para o papel do ator (Seção 20)
    const availableTools = this.toolRegistry.listAvailable({
      actorRole: task.actorRole
    });

    const toolCatalogSummary = availableTools.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      parameters: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : []
    }));

    // 2. Consulta de memória recente como DADOS (Seção 25 - sem transformar em instruções)
    let memorySummary = 'Nenhum contexto de memória específico.';
    try {
      if (task.sessionId && task.userId) {
        const history = await this.memoryStore.getConversationHistory(
          task.tenantId,
          task.sessionId,
          task.userId,
          4
        );
        if (history.length > 0) {
          memorySummary = history
            .map(h => `${h.role}: ${h.text.slice(0, 100)}`)
            .join('\n');
        }
      }
    } catch {
      // Falha de memória não impede o planejamento
    }

    // 3. Montagem do prompt estruturado de planejamento
    const systemPrompt = `Você é o planejador lógico da MaIA (inteligência do sistema de karaokê VozPlay).
Seu objetivo é decompor o pedido em um plano sequencial estruturado de ações usando APENAS as ferramentas fornecidas.

REGRAS RÍGIDAS DE SEGURANÇA:
1. NUNCA crie ferramentas arbitrárias ou comandos de sistema (shell, sql, script, etc.).
2. NUNCA defina ou altere tenantId, userId ou permissões. Esses valores são do sistema.
3. Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "goal": "${sanitizedGoal}",
  "summary": "Resumo amigável em português explicando as etapas",
  "steps": [
    {
      "order": 1,
      "objective": "Objetivo desta etapa específica",
      "tool": "nomeDaFerramenta",
      "arguments": { "param1": "valor" },
      "reason": "Por que esta etapa é necessária"
    }
  ]
}

CATÁLOGO DE FERRAMENTAS AUTORIZADAS:
${JSON.stringify(toolCatalogSummary, null, 2)}

DADOS DE CONTEXTO ATIVO:
- Tenant Confiável: ${task.tenantId}
- Papel do Operador: ${task.actorRole}
- Memória Recente:
${memorySummary}
`;

    const userPrompt = `Objetivo da Tarefa: "${sanitizedGoal}".
Gere o plano estruturado de ação estritamente no formato JSON solicitado.`;

    let modelUsed: string | undefined;
    let providerUsed: string | undefined;
    let rawOutput = '';

    try {
      // 4. Invocação governada via AI Router (NUNCA Gemini SDK direto - Seção 18)
      const aiResponse = await this.aiRouter.generate({
        task: 'planning',
        messages: [{ role: 'user', content: userPrompt }],
        systemInstruction: systemPrompt,
        tenantId: task.tenantId,
        profile: 'BALANCEADO',
        temperature: 0.1 // Baixa temperatura para determinismo
      });

      rawOutput = aiResponse.content || '';
      modelUsed = aiResponse.model;
      providerUsed = aiResponse.provider;
    } catch (err) {
      // 5. RESILIÊNCIA E FALLBACK LOCAL DETERMINÍSTICO (Seção 54)
      // Se a IA estiver indisponível, ativamos o plano determinístico de contingência
      return this.createDeterministicFallbackPlan(task, sanitizedGoal, planId);
    }

    // 6. Parsing e Validação Estrutural da Saída (Seção 19)
    let parsedPlan: any;
    try {
      // Remove possíveis blocos de markdown ```json ... ```
      const cleanJson = rawOutput
        .replace(/```json\s*/gi, '')
        .replace(/```\s*$/gi, '')
        .trim();
      parsedPlan = JSON.parse(cleanJson);
    } catch {
      // Se o modelo não retornou JSON válido, recorrer ao plano determinístico
      return this.createDeterministicFallbackPlan(task, sanitizedGoal, planId, 'fallback_json_parse_error');
    }

    if (!parsedPlan || !Array.isArray(parsedPlan.steps)) {
      return this.createDeterministicFallbackPlan(task, sanitizedGoal, planId, 'fallback_invalid_steps_schema');
    }

    // 7. Validação estrita de cada etapa do plano (Seções 19, 20, 21, 29)
    const validatedSteps: PlanStep[] = [];
    let orderCounter = 1;

    for (const rawStep of parsedPlan.steps) {
      const stepObjective = String(rawStep.objective || rawStep.reason || `Etapa ${orderCounter}`);
      const toolName = rawStep.tool ? String(rawStep.tool).trim() : undefined;

      if (!toolName) {
        // Etapa puramente de síntese / sem ferramenta
        validatedSteps.push({
          id: `step-${orderCounter}-${randomUUID().slice(0, 8)}`,
          order: orderCounter++,
          objective: stepObjective,
          risk: 'LOW',
          autonomyLevel: 'GREEN',
          requiresConfirmation: false,
          status: 'pending',
          reason: rawStep.reason
        });
        continue;
      }

      // Validação de Proibições Absolutas (Seção 29)
      const lowerTool = toolName.toLowerCase();
      if (FORBIDDEN_TOOL_NAMES.has(lowerTool)) {
        throw new MaiaSecurityError(
          `Tentativa de planejamento com ferramenta proibida: '${toolName}'. Operação bloqueada pela governança.`
        );
      }

      // Validação no Tool Registry de existência (Seção 20)
      const registeredTool = this.toolRegistry.get(toolName);
      if (!registeredTool) {
        throw new MaiaAgentToolNotFoundError(
          `A ferramenta sugerida no plano '${toolName}' não existe no Tool Registry ou foi desabilitada.`
        );
      }

      // Validação RBAC estrita da ferramenta para o papel do ator
      const isAllowedRole = registeredTool.allowedRoles.includes(task.actorRole) || registeredTool.allowedRoles.includes('*');
      if (!isAllowedRole) {
        throw new MaiaSecurityError(
          `A ferramenta '${registeredTool.name}' não é autorizada para o papel '${task.actorRole}'.`
        );
      }

      // Validação e Injeção do Tenant Confiável nos Argumentos (Seção 22)
      const args = (rawStep.arguments && typeof rawStep.arguments === 'object') ? { ...rawStep.arguments } : {};
      args.tenantId = task.tenantId; // Força tenantId confiável da tarefa (LLM nunca decide)
      if (task.sessionId) {
        args.sessionId = task.sessionId;
      }

      // Mapeamento inegociável de risco e nível de autonomia (Seções 12 e 13)
      const { risk, autonomyLevel, requiresConfirmation } = this.mapRiskAndAutonomy(registeredTool.riskLevel);

      validatedSteps.push({
        id: `step-${orderCounter}-${randomUUID().slice(0, 8)}`,
        order: orderCounter++,
        objective: stepObjective,
        tool: registeredTool.id, // Usa o ID canônico registrado
        arguments: args,
        risk,
        autonomyLevel,
        requiresConfirmation,
        status: 'pending',
        reason: rawStep.reason
      });
    }

    if (validatedSteps.length === 0) {
      throw new MaiaAgentInvalidPlanError('O plano gerado não contém nenhuma etapa executável.');
    }

    // 8. Geração de Resumo Seguro Explicável em pt-BR (Seção 34)
    const humanSummary = parsedPlan.summary || this.generatePlanSummary(validatedSteps);

    return {
      id: planId,
      taskId: task.id,
      goal: sanitizedGoal,
      summary: humanSummary,
      steps: validatedSteps,
      createdAt: new Date().toISOString(),
      status: 'created',
      version: 1,
      modelUsed,
      providerUsed
    };
  }

  /**
   * Gera um resumo seguro e legível para humanos sobre o plano (Seção 34)
   */
  public generatePlanSummary(steps: PlanStep[]): string {
    const lines = steps.map((s, idx) => `${idx + 1}. ${s.objective}`);
    return `Vou:\n${lines.join('\n')}`;
  }

  /**
   * Plano determinístico de contingência para o domínio de karaokê (Resiliência Seção 54)
   */
  public createDeterministicFallbackPlan(
    task: AgentTask,
    goal: string,
    planId: string,
    reason?: string
  ): AgentPlan {
    const lower = goal.toLowerCase();
    const steps: PlanStep[] = [];

    if (lower.includes('chamar') || lower.includes('próximo') || lower.includes('proximo') || lower.includes('call')) {
      steps.push({
        id: `step-1-${randomUUID().slice(0, 8)}`,
        order: 1,
        objective: 'Consultar estado e ordem ativa da fila do karaokê',
        tool: 'karaoke.queue.getStatus',
        arguments: { tenantId: task.tenantId, limit: 5 },
        risk: 'LOW',
        autonomyLevel: 'GREEN',
        requiresConfirmation: false,
        status: 'pending',
        reason: 'Verificar quem é o próximo cantor da fila'
      });
      steps.push({
        id: `step-2-${randomUUID().slice(0, 8)}`,
        order: 2,
        objective: 'Chamar próximo participante da fila para o palco',
        tool: 'karaoke.queue.callNext',
        arguments: { tenantId: task.tenantId },
        risk: 'MEDIUM',
        autonomyLevel: 'YELLOW',
        requiresConfirmation: false,
        status: 'pending',
        reason: 'Avançar a fila e chamar o cantor'
      });
    } else if (lower.includes('pular') || lower.includes('skip')) {
      steps.push({
        id: `step-1-${randomUUID().slice(0, 8)}`,
        order: 1,
        objective: 'Pular música atual na mesa de som',
        tool: 'karaoke.queue.skipSinger',
        arguments: { tenantId: task.tenantId },
        risk: 'MEDIUM',
        autonomyLevel: 'YELLOW',
        requiresConfirmation: false,
        status: 'pending',
        reason: 'Pular cantor ausente ou pedido'
      });
    } else if (lower.includes('prorrogar') || lower.includes('estender') || lower.includes('extend')) {
      steps.push({
        id: `step-1-${randomUUID().slice(0, 8)}`,
        order: 1,
        objective: 'Prorrogar tempo da sessão ativa em +30 minutos',
        tool: 'karaoke.session.extend',
        arguments: { tenantId: task.tenantId, minutes: 30 },
        risk: 'HIGH',
        autonomyLevel: 'RED',
        requiresConfirmation: true,
        status: 'pending',
        reason: 'Operação de supervisão com impacto no encerramento'
      });
    } else {
      // Plano padrão seguro: consulta de status e fila
      steps.push({
        id: `step-1-${randomUUID().slice(0, 8)}`,
        order: 1,
        objective: 'Consultar status da fila e sessão do karaokê',
        tool: 'karaoke.queue.getStatus',
        arguments: { tenantId: task.tenantId, limit: 10 },
        risk: 'LOW',
        autonomyLevel: 'GREEN',
        requiresConfirmation: false,
        status: 'pending',
        reason: 'Leitura inicial para compreensão do ambiente'
      });
    }

    return {
      id: planId,
      taskId: task.id,
      goal,
      summary: this.generatePlanSummary(steps),
      steps,
      createdAt: new Date().toISOString(),
      status: 'created',
      version: 1,
      modelUsed: 'deterministic-contingency-engine',
      providerUsed: 'contingency-local'
    };
  }
}

export const maiaPlanner = new MaiaPlanner();
