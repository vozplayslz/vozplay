/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE POLICY ENGINE
 * Avaliação de políticas de segurança, RBAC, segregação de risco e governança de ferramentas.
 */

import { MaiaContext, MaiaTool, PolicyDecision, MaiaPolicyRule } from '../types.js';
import { MaiaPolicyViolationError, MaiaSecurityError } from '../errors.js';

export class MaiaPolicyEngine {
  private customRules: MaiaPolicyRule[] = [];

  /**
   * Registra uma regra customizada de governança (prioridade menor executa antes)
   */
  public registerRule(rule: MaiaPolicyRule): void {
    this.customRules.push(rule);
    this.customRules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Avalia todas as regras de governança para uma ferramenta e parâmetros em um contexto
   */
  public async evaluate(
    context: MaiaContext,
    tool: MaiaTool,
    params: any
  ): Promise<PolicyDecision> {
    // 1. ISOLAMENTO MULTI-TENANT ESTRITO
    if (!context.tenant?.id) {
      return {
        allowed: false,
        reason: 'Contexto sem identificação de tenant válida.',
        riskLevel: tool.category,
        code: 'ERR_MISSING_TENANT'
      };
    }

    // 2. VERIFICAÇÃO DE PAPÉIS PERMITIDOS (RBAC BÁSICO)
    const actorRole = context.actor.role;
    const isAllowedRole = tool.allowedRoles.includes(actorRole) || tool.allowedRoles.includes('*');
    if (!isAllowedRole) {
      return {
        allowed: false,
        reason: `Papel '${actorRole}' não tem permissão para a ferramenta '${tool.name}' (requer: ${tool.allowedRoles.join(', ')}).`,
        riskLevel: tool.category,
        code: 'ERR_ROLE_UNAUTHORIZED'
      };
    }

    // 3. DIRETRIZES POR CATEGORIA DE RISCO
    switch (tool.category) {
      case 'READ':
        // Operações de leitura são seguras por padrão, exceto se regra customizada barrar
        break;

      case 'ACTION':
        // Ações operacionais exigem autenticação do ator
        if (!context.actor.authenticated && actorRole !== 'PARTICIPANT') {
          return {
            allowed: false,
            reason: `Ação operacional '${tool.name}' requer que o operador esteja autenticado com credenciais válidas.`,
            riskLevel: tool.category,
            code: 'ERR_ACTION_REQUIRES_AUTH'
          };
        }
        break;

      case 'HIGH_RISK':
        // Ações de alto risco bloqueiam participantes e anônimos terminantemente
        if (actorRole === 'PARTICIPANT' || actorRole === 'ANONYMOUS') {
          return {
            allowed: false,
            reason: `Ação de alto risco '${tool.name}' não é autorizada para participantes ou anônimos.`,
            riskLevel: tool.category,
            code: 'ERR_HIGH_RISK_FORBIDDEN'
          };
        }
        break;

      case 'CRITICAL':
        // Ações críticas (takeover, desligamento, alteração de credenciais) exigem papéis de supervisão
        const isSupervisorOrAdmin = ['SUPERVISOR', 'SYSTEM_ADMIN'].includes(actorRole);
        if (!isSupervisorOrAdmin) {
          return {
            allowed: false,
            reason: `Ação crítica '${tool.name}' é de acesso exclusivo de supervisores e administradores do sistema.`,
            riskLevel: tool.category,
            code: 'ERR_CRITICAL_SUPERVISOR_ONLY'
          };
        }
        break;
    }

    // 4. AVALIAÇÃO DE REGRAS CUSTOMIZADAS / REGRAS DE DOMÍNIO
    for (const rule of this.customRules) {
      const decision = await rule.evaluate(context, tool, params);
      if (decision !== null && !decision.allowed) {
        return decision;
      }
    }

    // Aprovado
    return {
      allowed: true,
      riskLevel: tool.category
    };
  }

  /**
   * Avalia a política e lança exceção tipada se rejeitada
   */
  public async assertAllowed(
    context: MaiaContext,
    tool: MaiaTool,
    params: any
  ): Promise<void> {
    const decision = await this.evaluate(context, tool, params);
    if (!decision.allowed) {
      if (decision.code === 'ERR_ROLE_UNAUTHORIZED' || decision.code === 'ERR_CRITICAL_SUPERVISOR_ONLY') {
        throw new MaiaSecurityError(decision.reason || 'Acesso negado pelas políticas do MaIA Core.', {
          correlationId: context.correlationId,
          details: { toolName: tool.name, actorRole: context.actor.role, code: decision.code }
        });
      }
      throw new MaiaPolicyViolationError(decision.reason || 'Operação barrada pelas políticas de segurança do MaIA Core.', {
        correlationId: context.correlationId,
        details: { toolName: tool.name, actorRole: context.actor.role, code: decision.code }
      });
    }
  }
}

export const maiaPolicyEngine = new MaiaPolicyEngine();
