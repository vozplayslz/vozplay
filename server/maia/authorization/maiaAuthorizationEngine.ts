/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTHORIZATION ENGINE — VOZPLAY NATIVE
 * Camada centralizada de controle de acesso, autorização e políticas de execução de ferramentas.
 * 
 * Fluxo de Validação:
 * actor -> establishment -> session -> role -> permission -> tool -> parameters -> policy -> execute
 */

import { MaIAToolContext, MaIAToolDefinition, MaIAActorRole, MaIAToolCategory } from '../types.js';
import { maiaPolicyEngine } from '../core/policy/policyEngine.js';
import { aiAudit } from '../audit/aiAudit.js';
import { db } from '../../db.js';
import { logger } from '../../logger.js';

export interface AuthorizationPolicyResult {
  allowed: boolean;
  reason?: string;
  category: MaIAToolCategory;
}

export class MaiaAuthorizationEngine {
  /**
   * Avalia as políticas de segurança e permissão antes da execução de qualquer ferramenta
   */
  public evaluatePolicy(
    context: MaIAToolContext,
    tool: MaIAToolDefinition,
    params: any
  ): AuthorizationPolicyResult {
    // 1. Isolamento Estrito de Estabelecimento (Multi-Tenant Isolation)
    if (!context.establishmentId || typeof context.establishmentId !== 'string' || !context.establishmentId.trim()) {
      return {
        allowed: false,
        reason: 'Violação de isolamento multi-tenant: identificador de estabelecimento ausente ou inválido.',
        category: tool.category
      };
    }

    if (!db.isEstablishmentValid(context.establishmentId)) {
      return {
        allowed: false,
        reason: `Violação de isolamento multi-tenant: estabelecimento '${context.establishmentId}' não reconhecido ou inativo.`,
        category: tool.category
      };
    }

    // 2. Isolamento de Sessão (Validação segura sem acoplamento a singleton global mutável)
    if (!context.sessionId || typeof context.sessionId !== 'string' || !context.sessionId.trim()) {
      return {
        allowed: false,
        reason: 'Violação de isolamento de sessão: identificador de sessão ausente ou inválido.',
        category: tool.category
      };
    }

    if (!db.isSessionValidForEstablishment(context.sessionId, context.establishmentId)) {
      return {
        allowed: false,
        reason: `Sessão informada '${context.sessionId}' não pertence ou não está ativa para o estabelecimento '${context.establishmentId}'.`,
        category: tool.category
      };
    }

    // 3. Verificação de Papeis Permitidos para a Ferramenta
    if (!tool.allowedRoles.includes(context.actorRole)) {
      return {
        allowed: false,
        reason: `Papel '${context.actorRole}' não tem permissão para a ferramenta '${tool.name}' (requer: ${tool.allowedRoles.join(', ')}).`,
        category: tool.category
      };
    }

    // 4. Políticas por Categoria de Ferramenta
    switch (tool.category) {
      case 'READ':
        // Verificação específica para consulta de vez do participante
        if (tool.name === 'getParticipantTurn') {
          if (context.actorRole === 'PARTICIPANT') {
            if (!params?.participantId || (context.actorId && context.actorId !== params.participantId)) {
              return {
                allowed: false,
                reason: 'Violação de privacidade: participantes só podem consultar o status da sua própria vaga.',
                category: tool.category
              };
            }
          }
        }
        break;

      case 'ACTION':
        // Ações operacionais exigem CONTROLLER, SUPERVISOR ou SYSTEM_ADMIN
        if (!['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(context.actorRole)) {
          return {
            allowed: false,
            reason: `Ações operacionais da categoria '${tool.category}' exigem perfil de operador ou supervisor.`,
            category: tool.category
          };
        }
        break;

      case 'HIGH_RISK':
        // Operações de alto risco (ex: exclusão de itens de fila)
        if (!['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(context.actorRole)) {
          return {
            allowed: false,
            reason: `Ação de alto risco '${tool.name}' negada para o perfil '${context.actorRole}'.`,
            category: tool.category
          };
        }
        break;

      case 'CRITICAL':
        // Operações críticas (ex: takeover de controle) exigem SUPERVISOR ou SYSTEM_ADMIN
        if (!['SUPERVISOR', 'SYSTEM_ADMIN'].includes(context.actorRole)) {
          return {
            allowed: false,
            reason: `Ação crítica '${tool.name}' restrita exclusivamente a supervisores ou administradores.`,
            category: tool.category
          };
        }
        // Confirmação obrigatória exigida para ferramentas críticas (Lote 1B / Requisito 7)
        if (!params?.confirmed && !context.confirmed) {
          return {
            allowed: false,
            reason: `Ação crítica '${tool.name}' exige confirmação explícita do supervisor (confirmed: true).`,
            category: tool.category
          };
        }
        break;
    }

    return {
      allowed: true,
      category: tool.category
    };
  }

  /**
   * Executa a ferramenta sob custódia de autorização e auditoria em tempo real
   */
  public async executeAuthorizedTool(
    context: MaIAToolContext,
    tool: MaIAToolDefinition,
    params: any
  ): Promise<any> {
    const policyResult = this.evaluatePolicy(context, tool, params);

    // Registro na auditoria de IA
    if (!policyResult.allowed) {
      logger.security(`[MaiaAuthorizationEngine] Acesso negado à ferramenta '${tool.name}':`, {
        actor: context.actorName,
        role: context.actorRole,
        reason: policyResult.reason
      });

      aiAudit.record({
        actor: context.actorName || 'Unknown',
        establishment_id: context.establishmentId,
        event_type: 'AI_PROVIDER_ACTIVATED', // Fallback type se evento de tool não estiver em AIAuditEventType
        provider: 'MaIA_Authorization',
        reason: `BLOQUEIO_TOOL: ${tool.name} por ${context.actorRole} - ${policyResult.reason}`,
        details: {
          tool: tool.name,
          category: tool.category,
          params: this.sanitizeParamsForAudit(params)
        }
      });

      throw new Error(`[Acesso Negado MaIA] ${policyResult.reason}`);
    }

    try {
      const result = await tool.execute(context, params);

      // Auditoria para ações com impacto (ACTION, HIGH_RISK, CRITICAL)
      if (tool.category !== 'READ') {
        aiAudit.record({
          actor: context.actorName,
          establishment_id: context.establishmentId,
          event_type: 'AI_PROVIDER_ACTIVATED',
          provider: 'MaIA_ToolExecution',
          reason: `EXECUCAO_TOOL_${tool.category}: ${tool.name} executada com sucesso por ${context.actorRole}`,
          details: {
            tool: tool.name,
            category: tool.category,
            params: this.sanitizeParamsForAudit(params)
          }
        });
      }

      return result;
    } catch (err: any) {
      logger.error(`[MaiaAuthorizationEngine] Erro durante execução da ferramenta '${tool.name}':`, err);
      aiAudit.record({
        actor: context.actorName || 'Unknown',
        establishment_id: context.establishmentId,
        event_type: 'AI_PROVIDER_ACTIVATED',
        provider: 'MaIA_ToolExecution',
        reason: `FALHA_EXECUCAO_TOOL: ${tool.name} falhou durante execução por ${context.actorRole} - ${err?.message || String(err)}`,
        details: {
          tool: tool.name,
          category: tool.category,
          error: err?.message || String(err),
          params: this.sanitizeParamsForAudit(params)
        }
      });
      throw err;
    }
  }

  /**
   * Remove segredos e dados sensíveis dos parâmetros antes do registro no log de auditoria
   */
  private sanitizeParamsForAudit(params: any): any {
    if (!params || typeof params !== 'object') return params;
    const clean = { ...params };
    delete clean.password;
    delete clean.token;
    delete clean.apiKey;
    delete clean.whatsapp;
    delete clean.phone;
    delete clean.authToken;
    delete clean.secret;
    delete clean.authorization;
    delete clean.cookie;
    return clean;
  }
}

export const maiaAuthorizationEngine = new MaiaAuthorizationEngine();
