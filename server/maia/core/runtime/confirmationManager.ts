/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA HUMAN CONFIRMATION MANAGER (Seções 14, 15, 16 e 17)
 * Gestão de confirmações humanas com Argument Binding criptográfico, TTL,
 * mensagens explicativas contextuais e autorização RBAC rigorosa.
 */

import { randomUUID, createHash } from 'crypto';
import {
  HumanConfirmationRequest,
  PlanStep,
  AgentTask,
  TaskRiskLevel,
  AutonomyLevel
} from './types.js';
import {
  MaiaAgentConfirmationExpiredError,
  MaiaAgentArgumentMismatchError,
  MaiaSecurityError,
  MaiaNotFoundError
} from './errors.js';

export interface ResolveConfirmationParams {
  confirmationId: string;
  decision: 'approved' | 'rejected';
  resolver: {
    userId: string;
    role: string;
    displayName?: string;
  };
  providedArguments?: Record<string, unknown>;
  rejectionReason?: string;
}

export class MaiaConfirmationManager {
  private requests = new Map<string, HumanConfirmationRequest>();
  private usedConfirmations = new Set<string>();

  /**
   * Calcula hash canônico SHA-256 dos argumentos para Argument Binding estrito (Seção 17)
   */
  public computeArgumentsHash(args: Record<string, unknown> | undefined): string {
    const canonical = this.canonicalStringify(args || {});
    return createHash('sha256').update(canonical).digest('hex');
  }

  private canonicalStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(k => `${JSON.stringify(k)}:${this.canonicalStringify(obj[k])}`);
    return '{' + pairs.join(',') + '}';
  }

  /**
   * Constrói explicação clara, não-genérica e em português brasileiro (Seção 15)
   */
  public generateHumanExplanation(toolName: string, args: Record<string, unknown>, risk: TaskRiskLevel): string {
    const params = args || {};

    switch (toolName) {
      case 'removeQueueItem':
      case 'karaoke.queue.removeSong':
      case 'ejectParticipantFromQueue':
      case 'karaoke.queue.ejectParticipant': {
        const target = params.participantDisplayName || params.participantId || params.queueItemId || 'o participante selecionado';
        return `Vou remover ${target} da fila de karaokê na sessão atual. Deseja confirmar esta ação?`;
      }

      case 'extendSessionTime':
      case 'karaoke.session.extend': {
        const minutes = params.minutes || 15;
        return `Vou prorrogar a sessão ativa de karaokê em +${minutes} minutos. Deseja confirmar?`;
      }

      case 'pauseKaraokeSession':
      case 'karaoke.session.pause': {
        return `Vou pausar a sessão de karaokê ativa imediatamente. Deseja confirmar a pausa operacional?`;
      }

      case 'takeoverController':
      case 'karaoke.session.takeover':
      case 'emergencyTakeover':
      case 'karaoke.admin.emergencyTakeover': {
        return `ALERTA DE SEGURANÇA: Vou acionar a Assunção Emergencial da mesa de som pelo Supervisor, revogando o operador anterior. Deseja confirmar?`;
      }

      case 'resetSessionCredentials':
      case 'karaoke.admin.resetCredentials': {
        return `ATENÇÃO: Vou renovar imediatamente todas as credenciais e códigos de presença da sessão. Deseja confirmar?`;
      }

      case 'skipSong':
      case 'karaoke.queue.skip':
      case 'skipCurrentSinger':
      case 'karaoke.queue.skipSinger': {
        return `Vou pular a música atualmente em reprodução no karaokê. Deseja confirmar?`;
      }

      case 'callNextInQueue':
      case 'karaoke.queue.callNext': {
        return `Vou chamar o próximo participante da fila para o palco. Deseja confirmar a chamada?`;
      }

      default: {
        const argsSummary = Object.entries(params)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');
        return `Ação de risco ${risk} solicitada: '${toolName}' (${argsSummary || 'sem parâmetros'}). Deseja confirmar a execução?`;
      }
    }
  }

  /**
   * Cria uma solicitação formal de confirmação humana com TTL e Argument Binding
   */
  public createRequest(
    task: AgentTask,
    step: PlanStep,
    customExplanation?: string
  ): HumanConfirmationRequest {
    const confirmationId = `conf-${randomUUID()}`;
    const args = (step.arguments || {}) as Record<string, unknown>;
    const argumentsHash = this.computeArgumentsHash(args);
    const ttlMs = task.limits.confirmationTtlMs || 60000;
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    const explanation = customExplanation || this.generateHumanExplanation(
      step.tool || 'acao_desconhecida',
      args,
      step.risk
    );

    const request: HumanConfirmationRequest = {
      id: confirmationId,
      taskId: task.id,
      stepId: step.id,
      toolName: step.tool || 'unspecified_tool',
      arguments: { ...args },
      argumentsHash,
      explanation,
      riskLevel: step.risk,
      autonomyLevel: step.autonomyLevel,
      tenantId: task.tenantId,
      sessionId: task.sessionId,
      requestedAt,
      expiresAt,
      status: 'pending'
    };

    this.requests.set(confirmationId, request);
    return request;
  }

  /**
   * Obtém uma solicitação pelo ID
   */
  public getRequest(confirmationId: string): HumanConfirmationRequest | undefined {
    const req = this.requests.get(confirmationId);
    if (!req) return undefined;

    // Checa expiração passiva por TTL
    if (req.status === 'pending' && Date.now() > new Date(req.expiresAt).getTime()) {
      req.status = 'expired';
    }

    return req;
  }

  /**
   * Lista confirmações pendentes de um tenant
   */
  public listPending(tenantId: string): HumanConfirmationRequest[] {
    const now = Date.now();
    const result: HumanConfirmationRequest[] = [];

    for (const req of this.requests.values()) {
      if (req.tenantId === tenantId) {
        if (req.status === 'pending' && now > new Date(req.expiresAt).getTime()) {
          req.status = 'expired';
        }
        if (req.status === 'pending') {
          result.push(req);
        }
      }
    }

    return result;
  }

  /**
   * Resolve uma confirmação (aprovação ou rejeição) com validação RBAC e Argument Binding
   */
  public resolve(params: ResolveConfirmationParams): HumanConfirmationRequest {
    const req = this.requests.get(params.confirmationId);
    if (!req) {
      throw new MaiaNotFoundError(`Solicitação de confirmação '${params.confirmationId}' não encontrada.`);
    }

    // 1. Verificação de status
    if (req.status !== 'pending') {
      throw new MaiaSecurityError(`Solicitação já resolvida com status '${req.status}'.`);
    }

    // 2. Verificação de TTL / Expiração (Seção 16)
    if (Date.now() > new Date(req.expiresAt).getTime()) {
      req.status = 'expired';
      throw new MaiaAgentConfirmationExpiredError(
        `A confirmação expirou pelo tempo limite (TTL) e não é mais válida. Nova solicitação deve ser gerada.`
      );
    }

    // 3. Validação RBAC estrita de quem está autorizando (Seção 14)
    const role = params.resolver.role;
    if (req.riskLevel === 'CRITICAL' && !['SUPERVISOR', 'SYSTEM_ADMIN'].includes(role)) {
      throw new MaiaSecurityError(
        `Apenas Supervisores ou Administradores podem aprovar ações de nível CRITICAL.`
      );
    }

    if (req.riskLevel === 'HIGH' && !['CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'].includes(role)) {
      throw new MaiaSecurityError(
        `Apenas Operadores ou Supervisores podem aprovar ações de nível HIGH.`
      );
    }

    if (role === 'PARTICIPANT' || role === 'ANONYMOUS') {
      throw new MaiaSecurityError(`Participantes não possuem autoridade para aprovar ações do sistema.`);
    }

    // 4. Argument Binding estrito (Seção 17): se argumentos forem repassados na aprovação, verificar integridade
    if (params.providedArguments) {
      const providedHash = this.computeArgumentsHash(params.providedArguments);
      if (providedHash !== req.argumentsHash) {
        throw new MaiaAgentArgumentMismatchError(
          `Falha de Argument Binding: os argumentos fornecidos para autorização diferem dos argumentos originais da etapa planejada.`
        );
      }
    }

    // 5. Atualização da resolução
    req.status = params.decision;
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = {
      userId: params.resolver.userId,
      role: params.resolver.role,
      displayName: params.resolver.displayName
    };
    if (params.decision === 'rejected') {
      req.rejectionReason = params.rejectionReason || 'Rejeitado pelo operador responsável.';
    }

    return req;
  }

  /**
   * Marca uma confirmação como utilizada (Single-use enforcement)
   */
  public markAsUsed(confirmationId: string): void {
    this.usedConfirmations.add(confirmationId);
  }

  /**
   * Verifica se a confirmação já foi consumida
   */
  public isUsed(confirmationId: string): boolean {
    return this.usedConfirmations.has(confirmationId);
  }

  /**
   * Remove solicitações antigas já resolvidas ou expiradas há mais de 1 hora
   */
  public pruneOld(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, req] of this.requests.entries()) {
      if (req.status !== 'pending' && now - new Date(req.requestedAt).getTime() > maxAgeMs) {
        this.requests.delete(id);
        this.usedConfirmations.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const maiaConfirmationManager = new MaiaConfirmationManager();
