/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AUTONOMY POLICY MANAGER (PROMPT 10 - Seções 6, 7 e 8)
 * Gerenciador formal de políticas de autonomia por tenant, produto e concessões temporárias.
 * 
 * Princípio Arquitetural:
 * Autonomia responde: "A MaIA pode tomar iniciativa neste contexto?"
 * Policy Engine responde: "Esta ação é permitida?"
 */

import { AutonomyPolicy, AutonomyTier, AutonomyMode, TemporaryAutonomyGrant } from './types.js';
import { MaiaAutonomyLevelNotPermittedError, MaiaAutonomyPolicyDeniedError } from './errors.js';

export class AutonomyPolicyManager {
  private policies = new Map<string, AutonomyPolicy>();
  private defaultProductId: string;

  constructor(defaultProductId = 'maia-karaoke') {
    this.defaultProductId = defaultProductId;
  }

  /**
   * Obtém a política de autonomia padrão de segurança para um tenant
   */
  public getDefaultPolicy(tenantId: string): AutonomyPolicy {
    // Feature flags do ambiente ou padrões de segurança máxima
    const envEnabled = process.env.MAIA_AUTONOMY_ENABLED === 'true';
    const envMode = (process.env.MAIA_AUTONOMY_MODE as AutonomyMode) || 'OBSERVE_ONLY';

    return {
      tenantId,
      productId: this.defaultProductId,
      enabled: envEnabled,
      mode: envMode,
      level: 2, // Nível 2 padrão: Ações de baixo risco (GREEN) apenas
      maxSteps: parseInt(process.env.MAIA_AUTONOMY_MAX_STEPS || '5', 10),
      maxDurationMs: parseInt(process.env.MAIA_AUTONOMY_MAX_DURATION || '20000', 10),
      maxCostUsd: parseFloat(process.env.MAIA_AUTONOMY_MAX_COST || '0.05'),
      maxCascadeDepth: 2,
      allowedTools: [
        'karaoke.queue.getStatus',
        'karaoke.queue.getParticipantTurn',
        'karaoke.session.getStatus',
        'karaoke.catalog.search',
        'karaoke.queue.announceNext'
      ],
      disallowedTools: [
        'executeShell',
        'executeSQL',
        'runPython',
        'dockerExec',
        'arbitraryHttp',
        'db.admin.*',
        'auth.changePassword',
        'supervisor.emergencyTakeover'
      ],
      requiresConfirmationForYellow: true,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Registra ou atualiza a política de autonomia de um tenant
   */
  public setPolicy(tenantId: string, policy: Partial<AutonomyPolicy>): AutonomyPolicy {
    const existing = this.getPolicy(tenantId);
    
    // Nível 5 (Autonomia Administrativa) é terminantemente proibido por padrão
    if (policy.level === 5) {
      throw new MaiaAutonomyLevelNotPermittedError('Nível 5 (Autonomia Administrativa) é terminantemente proibido por segurança.');
    }

    const updated: AutonomyPolicy = {
      ...existing,
      ...policy,
      tenantId,
      updatedAt: new Date().toISOString()
    };

    this.policies.set(tenantId, updated);
    return updated;
  }

  /**
   * Recupera a política de autonomia ativa considerando expiração de concessões temporárias
   */
  public getPolicy(tenantId: string): AutonomyPolicy {
    let policy = this.policies.get(tenantId);
    if (!policy) {
      policy = this.getDefaultPolicy(tenantId);
      this.policies.set(tenantId, policy);
    }

    // Validação de expiração de concessão temporária (Seção 8)
    if (policy.temporaryGrant) {
      const now = Date.now();
      const expiresAtMs = new Date(policy.temporaryGrant.expiresAt).getTime();
      if (now > expiresAtMs) {
        // Concessão expirada: remove e retorna a política base
        policy.temporaryGrant = undefined;
        policy.level = 2; // Retorna para o patamar seguro
        policy.updatedAt = new Date().toISOString();
      }
    }

    return policy;
  }

  /**
   * Concede autonomia temporária para um tenant com TTL estrito (Seção 8)
   */
  public grantTemporaryAutonomy(
    tenantId: string,
    params: {
      durationMinutes: number;
      grantedBy: string;
      reason: string;
      allowedLevel: AutonomyTier;
      allowedTools?: string[];
    }
  ): AutonomyPolicy {
    if (params.allowedLevel === 5) {
      throw new MaiaAutonomyLevelNotPermittedError('Concessão temporária de Nível 5 (Administrativo) é proibida.');
    }

    const now = Date.now();
    const expiresAt = new Date(now + params.durationMinutes * 60 * 1000).toISOString();

    const grant: TemporaryAutonomyGrant = {
      grantedAt: new Date(now).toISOString(),
      expiresAt,
      grantedBy: params.grantedBy,
      reason: params.reason,
      allowedLevel: params.allowedLevel,
      allowedTools: params.allowedTools
    };

    const policy = this.getPolicy(tenantId);
    policy.temporaryGrant = grant;
    policy.enabled = true;
    policy.level = params.allowedLevel;
    policy.updatedAt = new Date().toISOString();

    if (params.allowedTools && params.allowedTools.length > 0) {
      policy.allowedTools = Array.from(new Set([...policy.allowedTools, ...params.allowedTools]));
    }

    this.policies.set(tenantId, policy);
    return policy;
  }

  /**
   * Revoga imediatamente concessões temporárias de autonomia
   */
  public revokeTemporaryGrant(tenantId: string): AutonomyPolicy {
    const policy = this.getPolicy(tenantId);
    policy.temporaryGrant = undefined;
    policy.level = 2;
    policy.updatedAt = new Date().toISOString();
    this.policies.set(tenantId, policy);
    return policy;
  }

  /**
   * Valida se uma ação/ferramenta é permitida pela política de autonomia do contexto
   */
  public assertCanActProactively(tenantId: string, toolName: string, riskLevel: string): void {
    const policy = this.getPolicy(tenantId);

    if (!policy.enabled || policy.mode === 'OFF') {
      throw new MaiaAutonomyPolicyDeniedError(`Autonomia proativa desabilitada para o estabelecimento '${tenantId}'.`);
    }

    // Verifica lista de ferramentas proibidas
    if (policy.disallowedTools.some(pattern => {
      if (pattern.endsWith('*')) {
        return toolName.startsWith(pattern.slice(0, -1));
      }
      return toolName === pattern;
    })) {
      throw new MaiaAutonomyPolicyDeniedError(`Ferramenta '${toolName}' terminantemente bloqueada pela política de autonomia.`);
    }

    // Em modo OBSERVE_ONLY nenhuma execução real é permitida
    if (policy.mode === 'OBSERVE_ONLY') {
      throw new MaiaAutonomyPolicyDeniedError(`Modo OBSERVE_ONLY ativo: execuções de ferramentas reais bloqueadas.`);
    }

    // Se o risco for RED, autonomia autônoma JAMAIS pode executar sem autorização humana explícita
    if (riskLevel === 'RED' || riskLevel === 'CRITICAL') {
      throw new MaiaAutonomyPolicyDeniedError(`Ações de risco RED/CRITICAL exigem autorização humana prévia da mesa/gerência.`);
    }
  }
}

export const autonomyPolicyManager = new AutonomyPolicyManager();
