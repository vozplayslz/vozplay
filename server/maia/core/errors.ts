/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CORE ERRORS — ROBUST ERROR HIERARCHY
 * Hierarquia formal de erros do MaIA Core com rastreabilidade, status HTTP e correlation ID.
 */

export abstract class MaiaCoreError extends Error {
  public abstract readonly code: string;
  public abstract readonly statusCode: number;
  public readonly timestamp: string;
  public readonly correlationId?: string;
  public readonly details?: unknown;

  constructor(message: string, options?: { correlationId?: string; details?: unknown; cause?: unknown }) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.correlationId = options?.correlationId;
    this.details = options?.details;
    if (options?.cause) {
      this.cause = options.cause;
    }
    Error.captureStackTrace?.(this, this.constructor);
  }

  public toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
      details: this.details
    };
  }
}

/**
 * Erro de autorização, violação de RBAC ou acesso indevido
 */
export class MaiaSecurityError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_SECURITY';
  public readonly statusCode = 403;
}

/**
 * Violação de política de execução de ferramentas ou governança
 */
export class MaiaPolicyViolationError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_POLICY_VIOLATION';
  public readonly statusCode = 403;
}

/**
 * Falha de autenticação ou ausência de credenciais válidas
 */
export class MaiaAuthenticationError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_UNAUTHENTICATED';
  public readonly statusCode = 401;
}

/**
 * Parâmetro inválido ou violação de esquema de entrada
 */
export class MaiaValidationError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_VALIDATION';
  public readonly statusCode = 400;
}

/**
 * Recurso, ferramenta ou modelo não encontrado
 */
export class MaiaNotFoundError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_NOT_FOUND';
  public readonly statusCode = 404;
}

/**
 * Erro durante execução interna de uma ferramenta
 */
export class MaiaToolExecutionError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_TOOL_EXECUTION';
  public readonly statusCode = 500;
}

/**
 * Erro ou indisponibilidade de provedor de inteligência artificial
 */
export class MaiaProviderError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_PROVIDER_ERROR';
  public readonly statusCode = 502;
}

/**
 * Limite de requisições ou quotas excedido
 */
export class MaiaRateLimitError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_RATE_LIMIT';
  public readonly statusCode = 429;
}

/**
 * Falha de integridade ou dados insuficientes no contexto
 */
export class MaiaContextError extends MaiaCoreError {
  public readonly code = 'ERR_MAIA_CONTEXT_ERROR';
  public readonly statusCode = 400;
}
