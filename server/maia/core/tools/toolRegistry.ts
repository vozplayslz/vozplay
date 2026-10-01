/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ADVANCED TOOL REGISTRY (PROMPT 04)
 * Registro central de ferramentas desacopladas, discovery inteligente,
 * validação estrita de esquemas, governança pelo Policy Engine, timeout,
 * idempotência, confirmação humana e auditoria de execuções e negativas.
 */

import { randomUUID } from 'crypto';
import {
  MaiaToolContract,
  MaiaToolExecutionContext,
  MaiaToolResult,
  MaiaToolDiscoveryFilter,
  ToolRiskLevel,
  ToolCategory,
  ToolErrorCode
} from './types.js';
import { ToolSchemaValidator } from './schemaValidator.js';
import { toolIdempotencyStore } from './idempotencyStore.js';
import { toolAuditLogger } from './auditLogger.js';
import { maiaPolicyEngine, MaiaPolicyEngine } from '../policy/policyEngine.js';
import { MaiaContext, MaiaTool, MaiaToolExecutionResult } from '../types.js';
import { MaiaSecurityError, MaiaValidationError, MaiaNotFoundError } from '../errors.js';

export class MaiaToolRegistry {
  private toolsById = new Map<string, MaiaToolContract>();
  private toolsByName = new Map<string, MaiaToolContract>();

  /**
   * Registra uma nova ferramenta no catálogo
   */
  public register(tool: MaiaToolContract): void {
    this.toolsById.set(tool.id, tool);
    this.toolsByName.set(tool.name, tool);
  }

  /**
   * Método de compatibilidade da Fase 2 (registerTool)
   */
  public registerTool(tool: MaiaTool | MaiaToolContract): void {
    if ('id' in tool) {
      this.register(tool as MaiaToolContract);
    } else {
      // Converte MaiaTool legado para MaiaToolContract
      const converted: MaiaToolContract = {
        id: tool.name,
        name: tool.name,
        description: tool.description,
        version: 'v1',
        category: tool.category,
        riskLevel: tool.category === 'CRITICAL' ? 'CRITICAL' : 
                   tool.category === 'HIGH_RISK' ? 'HIGH' : 
                   tool.category === 'ACTION' ? 'MEDIUM' : 'LOW',
        inputSchema: {
          type: 'object',
          properties: (tool.parameters?.properties as any) || {},
          required: tool.parameters?.required || []
        },
        permissions: tool.requiredPermissions || [],
        allowedRoles: tool.allowedRoles,
        enabled: true,
        execute: async (ctx, params) => {
          const coreContext: MaiaContext = {
            correlationId: ctx.correlationId,
            timestamp: new Date().toISOString(),
            tenant: { id: ctx.tenantId },
            session: { id: ctx.sessionId, status: 'ACTIVE' },
            actor: {
              id: ctx.actorId,
              role: ctx.actorRole,
              displayName: ctx.actorDisplayName,
              authenticated: ctx.actorRole !== 'ANONYMOUS'
            },
            environment: { channel: (ctx.channel as any) || 'web' },
            domain: {},
            history: []
          };
          return tool.execute(coreContext, params);
        }
      };
      this.register(converted);
    }
  }

  /**
   * Registra múltiplas ferramentas em lote
   */
  public registerBatch(tools: (MaiaTool | MaiaToolContract)[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Desregistra uma ferramenta
   */
  public unregister(idOrName: string): boolean {
    const tool = this.toolsById.get(idOrName) || this.toolsByName.get(idOrName);
    if (!tool) return false;
    this.toolsById.delete(tool.id);
    this.toolsByName.delete(tool.name);
    return true;
  }

  /**
   * Obtém uma ferramenta registrada por ID ou nome
   */
  public get(idOrName: string): MaiaToolContract | undefined {
    return this.toolsById.get(idOrName) || this.toolsByName.get(idOrName);
  }

  /**
   * Método de compatibilidade da Fase 2 (getTool)
   */
  public getTool(name: string): MaiaTool | undefined {
    const contract = this.get(name);
    if (!contract) return undefined;

    return {
      name: contract.name,
      description: contract.description,
      category: contract.category,
      allowedRoles: contract.allowedRoles,
      requiredPermissions: contract.permissions,
      parameters: {
        type: 'object',
        properties: (contract.inputSchema.properties as any) || {},
        required: contract.inputSchema.required
      },
      execute: async (context: MaiaContext, params: any) => {
        const executionCtx: MaiaToolExecutionContext = {
          toolRequestId: randomUUID(),
          correlationId: context.correlationId,
          tenantId: context.tenant.id,
          sessionId: context.session.id,
          actorId: context.actor.id,
          actorRole: context.actor.role,
          actorDisplayName: context.actor.displayName || 'Usuário',
          permissions: context.actor.permissions || []
        };
        const result = await this.execute(executionCtx, contract.id, params);
        if (!result.success) {
          throw new Error(result.error || 'Falha na execução da ferramenta');
        }
        return result.data;
      }
    };
  }

  /**
   * Lista todas as ferramentas registradas
   */
  public listTools(category?: ToolCategory | ToolRiskLevel): MaiaTool[] {
    const contracts = Array.from(this.toolsById.values());
    const filtered = category
      ? contracts.filter(c => c.category === category || c.riskLevel === category)
      : contracts;

    return filtered.map(c => this.getTool(c.id)!);
  }

  /**
   * TOOL DISCOVERY: Filtra ferramentas ativas e autorizadas para o contexto do interlocutor
   */
  public listAvailable(filter: MaiaToolDiscoveryFilter): MaiaToolContract[] {
    const all = Array.from(this.toolsById.values());

    return all.filter(tool => {
      // 1. Deve estar habilitada globalmente
      if (!tool.enabled) return false;

      // 2. Papel RBAC deve ser permitido
      const isRoleAllowed = tool.allowedRoles.includes(filter.actorRole) || tool.allowedRoles.includes('*');
      if (!isRoleAllowed) return false;

      // 3. Categoria / Nível de Risco se filtrado
      if (filter.category && tool.category !== filter.category) return false;
      if (filter.riskLevel && tool.riskLevel !== filter.riskLevel) return false;

      return true;
    });
  }

  /**
   * Filtra ferramentas legadas para um papel
   */
  public getToolsForActor(actorRole: string): MaiaTool[] {
    return this.listAvailable({ actorRole }).map(c => this.getTool(c.id)!);
  }

  /**
   * Validação de parâmetros
   */
  public validateParameters(tool: MaiaTool | MaiaToolContract, params: any): void {
    const schema: any = 'inputSchema' in tool ? tool.inputSchema : {
      type: 'object',
      properties: tool.parameters?.properties || {},
      required: tool.parameters?.required || []
    };

    const res = ToolSchemaValidator.validateInput(schema, params);
    if (!res.valid) {
      throw new MaiaValidationError(res.errors.join(' '));
    }
  }

  /**
   * EXECUÇÃO AVANÇADA DA FERRAMENTA (PROMPT 04)
   * Segue rigorosamente o fluxo:
   * Tool Request -> Schema Validation -> Policy Engine -> Authorization -> Tool Executor -> Tool Result
   */
  public async execute<TInput = any, TOutput = any>(
    context: MaiaToolExecutionContext,
    toolIdOrName: string,
    params: TInput
  ): Promise<MaiaToolResult<TOutput>> {
    const startTime = Date.now();
    const toolRequestId = context.toolRequestId || randomUUID();
    const correlationId = context.correlationId || randomUUID();

    const tool = this.get(toolIdOrName);

    // 1. DISCOVERY & EXISTÊNCIA
    if (!tool || !tool.enabled) {
      const latencyMs = Date.now() - startTime;
      toolAuditLogger.log({
        toolId: toolIdOrName,
        toolVersion: 'unknown',
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'DENIED',
        riskLevel: 'LOW',
        reason: 'Ferramenta não registrada ou desabilitada no Tool Registry.',
        latencyMs
      });

      return {
        success: false,
        errorCode: 'NOT_FOUND',
        error: `A ferramenta '${toolIdOrName}' não está disponível ou foi desabilitada.`,
        metadata: {
          toolId: toolIdOrName,
          toolVersion: 'unknown',
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString()
        }
      };
    }

    const payload = (params || {}) as any;

    // 2. ISOLAMENTO RIGOROSO DE TENANT & USER (Seção 34, 35, 36)
    // Se o modelo ou usuário injetou "tenantId" diferente do autenticado, bloqueia sumariamente
    if (payload.tenantId && payload.tenantId !== context.tenantId) {
      const latencyMs = Date.now() - startTime;
      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'DENIED',
        riskLevel: tool.riskLevel,
        reason: `Tentativa de cruzar tenant não autorizada: contexto '${context.tenantId}' tentou acessar '${payload.tenantId}'.`,
        latencyMs
      });

      return {
        success: false,
        errorCode: 'FORBIDDEN',
        error: 'Acesso negado: operação entre estabelecimentos diferentes não é autorizada.',
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString()
        }
      };
    }

    // 3. VALIDAÇÃO DE ESQUEMA DE ENTRADA (Seção 7, 37)
    const schemaValidation = ToolSchemaValidator.validateInput(tool.inputSchema, payload);
    if (!schemaValidation.valid) {
      const latencyMs = Date.now() - startTime;
      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'FAILED',
        riskLevel: tool.riskLevel,
        reason: `Falha de validação de esquema: ${schemaValidation.errors.join('; ')}`,
        latencyMs,
        inputSummary: payload
      });

      return {
        success: false,
        errorCode: 'INVALID_INPUT',
        error: `Parâmetros inválidos para '${tool.name}': ${schemaValidation.errors.join('; ')}`,
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString()
        }
      };
    }

    // 4. AUTORIZAÇÃO PELO POLICY ENGINE (Seção 12, 13)
    const legacyMaiaTool: MaiaTool = {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      allowedRoles: tool.allowedRoles,
      requiredPermissions: tool.permissions,
      parameters: {
        type: 'object',
        properties: (tool.inputSchema.properties as any) || {}
      },
      execute: async () => {}
    };

    const coreContext: MaiaContext = {
      correlationId,
      timestamp: new Date().toISOString(),
      tenant: { id: context.tenantId },
      session: { id: context.sessionId, status: 'ACTIVE' },
      actor: {
        id: context.actorId,
        role: context.actorRole,
        displayName: context.actorDisplayName,
        permissions: [...context.permissions],
        authenticated: context.actorRole !== 'ANONYMOUS'
      },
      environment: { channel: (context.channel as any) || 'web' },
      domain: {},
      history: []
    };

    const policyDecision = await maiaPolicyEngine.evaluate(coreContext, legacyMaiaTool, payload);
    if (!policyDecision.allowed) {
      const latencyMs = Date.now() - startTime;
      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'DENIED',
        riskLevel: tool.riskLevel,
        reason: policyDecision.reason || 'Acesso negado pelas políticas do sistema.',
        latencyMs,
        inputSummary: payload
      });

      return {
        success: false,
        errorCode: 'FORBIDDEN',
        error: policyDecision.reason || `Acesso negado: seu papel ('${context.actorRole}') não tem autorização para '${tool.name}'.`,
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString()
        }
      };
    }

    // 5. CONFIRMAÇÃO HUMANA OBRIGATÓRIA (Seção 15, 42)
    if (tool.requiresConfirmation && !context.isConfirmed) {
      const latencyMs = Date.now() - startTime;
      const confirmationId = randomUUID();

      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'AWAITING_CONFIRMATION',
        riskLevel: tool.riskLevel,
        reason: 'Aguardando confirmação explícita do operador humano.',
        latencyMs,
        inputSummary: payload
      });

      return {
        success: false,
        errorCode: 'AWAITING_CONFIRMATION',
        error: tool.confirmationPrompt || `A ferramenta '${tool.name}' altera estado crítico e requer sua confirmação prévia.`,
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString(),
          requiresConfirmation: true,
          confirmationId
        }
      };
    }

    // 6. PROTEÇÃO CONTRA DUPLICIDADE VIA IDEMPOTÊNCIA (Seção 16, 52)
    if (context.idempotencyKey && tool.isIdempotent) {
      const cachedResult = toolIdempotencyStore.get(context.tenantId, tool.id, context.idempotencyKey);
      if (cachedResult !== undefined) {
        const latencyMs = Date.now() - startTime;
        return {
          success: true,
          data: cachedResult,
          metadata: {
            toolId: tool.id,
            toolVersion: tool.version,
            toolRequestId,
            correlationId,
            latencyMs,
            timestamp: new Date().toISOString(),
            cached: true
          }
        };
      }
    }

    // 7. EXECUÇÃO SANDBOXED COM TIMEOUT E RETRY (Seção 19, 20)
    const timeoutDuration = tool.timeoutMs || 5000;
    try {
      const result = await Promise.race([
        tool.execute(context, payload),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutDuration)
        )
      ]);

      const latencyMs = Date.now() - startTime;

      // Grava no cache de idempotência caso tenha chave informada
      if (context.idempotencyKey && tool.isIdempotent) {
        toolIdempotencyStore.set(context.tenantId, tool.id, context.idempotencyKey, result);
      }

      // Registro de Auditoria de Sucesso
      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: 'SUCCESS',
        riskLevel: tool.riskLevel,
        latencyMs,
        inputSummary: payload
      });

      return {
        success: true,
        data: result,
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString(),
          cached: false
        }
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err?.message === 'TIMEOUT_EXCEEDED';

      // Tratamento seguro de erro: NUNCA expor senhas, IPs de Postgres ou stack traces
      let safeErrorMessage = isTimeout
        ? `A operação '${tool.name}' excedeu o tempo limite máximo de ${timeoutDuration}ms.`
        : `Erro operacional ao processar a ferramenta '${tool.name}'.`;

      const errorCode: ToolErrorCode = isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR';

      toolAuditLogger.log({
        toolId: tool.id,
        toolVersion: tool.version,
        toolRequestId,
        correlationId,
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorRole: context.actorRole,
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        riskLevel: tool.riskLevel,
        reason: isTimeout ? 'Timeout atingido' : err?.message || 'Falha de execução',
        latencyMs,
        inputSummary: payload
      });

      return {
        success: false,
        errorCode,
        error: safeErrorMessage,
        metadata: {
          toolId: tool.id,
          toolVersion: tool.version,
          toolRequestId,
          correlationId,
          latencyMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Método de compatibilidade da Fase 2 (executeTool)
   */
  public async executeTool(params: {
    context: MaiaContext;
    toolName: string;
    params?: any;
    policyEngine?: MaiaPolicyEngine;
  }): Promise<MaiaToolExecutionResult> {
    const executionCtx: MaiaToolExecutionContext = {
      toolRequestId: randomUUID(),
      correlationId: params.context.correlationId,
      tenantId: params.context.tenant.id,
      sessionId: params.context.session.id,
      actorId: params.context.actor.id,
      actorRole: params.context.actor.role,
      actorDisplayName: params.context.actor.displayName || 'Usuário',
      permissions: params.context.actor.permissions || []
    };

    const tool = this.get(params.toolName);
    if (!tool) {
      throw new MaiaNotFoundError(`Ferramenta '${params.toolName}' não encontrada no Tool Registry.`, {
        correlationId: params.context.correlationId
      });
    }

    // Validação de parâmetros
    this.validateParameters(tool, params.params || {});

    // Interceptação pelo Policy Engine
    const policy = params.policyEngine || maiaPolicyEngine;
    const legacyMaiaTool: MaiaTool = {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      allowedRoles: tool.allowedRoles,
      parameters: {
        type: 'object',
        properties: (tool.inputSchema.properties as any) || {}
      },
      execute: async () => {}
    };
    await policy.assertAllowed(params.context, legacyMaiaTool, params.params || {});

    const res = await this.execute(executionCtx, params.toolName, params.params || {});
    if (!res.success) {
      throw new Error(res.error || 'Erro na execução');
    }

    return {
      toolName: tool.name,
      category: tool.category,
      success: true,
      result: res.data,
      latencyMs: res.metadata.latencyMs,
      correlationId: params.context.correlationId,
      timestamp: res.metadata.timestamp
    };
  }
}

export const maiaToolRegistry = new MaiaToolRegistry();
