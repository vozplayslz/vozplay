/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI ROUTER STANDARDIZED ERRORS (PROMPT 07)
 * Classes de erro padronizadas e seguras para a camada de roteamento de IA.
 * Não vazam dados confidenciais (chaves, URLs internas ou tokens) para o usuário final.
 */

export class AIRouterError extends Error {
  public readonly code: string;
  public readonly isRetryable: boolean;
  public readonly tenantId?: string;
  public readonly provider?: string;
  public readonly model?: string;

  constructor(message: string, code = 'AI_UNKNOWN_ERROR', isRetryable = false, details?: {
    tenantId?: string;
    provider?: string;
    model?: string;
  }) {
    super(message);
    this.name = 'AIRouterError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.tenantId = details?.tenantId;
    this.provider = details?.provider;
    this.model = details?.model;
  }
}

export class AIAuthError extends AIRouterError {
  constructor(message: string, details?: { tenantId?: string; provider?: string }) {
    super(`Falha de autenticação no provedor de IA: ${message}`, 'AI_AUTH_ERROR', false, details);
    this.name = 'AIAuthError';
  }
}

export class AIRateLimitError extends AIRouterError {
  public readonly retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number, details?: { tenantId?: string; provider?: string }) {
    super(`Limite de taxa (Rate Limit / RPM) atingido: ${message}`, 'AI_RATE_LIMIT', true, details);
    this.name = 'AIRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AIQuotaExceededError extends AIRouterError {
  constructor(message: string, details?: { tenantId?: string; provider?: string }) {
    super(`Quota ou orçamento de IA esgotado: ${message}`, 'AI_QUOTA_EXCEEDED', false, details);
    this.name = 'AIQuotaExceededError';
  }
}

export class AITimeoutError extends AIRouterError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, details?: { tenantId?: string; provider?: string }) {
    super(`Tempo limite de execução excedido (${timeoutMs}ms)`, 'AI_TIMEOUT', true, details);
    this.name = 'AITimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class AIProviderUnavailableError extends AIRouterError {
  constructor(providerName: string, reason?: string, details?: { tenantId?: string }) {
    super(`Provedor de IA '${providerName}' indisponível: ${reason || 'Sem conectividade'}`, 'AI_PROVIDER_UNAVAILABLE', true, {
      ...details,
      provider: providerName
    });
    this.name = 'AIProviderUnavailableError';
  }
}

export class AIModelUnavailableError extends AIRouterError {
  constructor(modelName: string, reason?: string, details?: { tenantId?: string; provider?: string }) {
    super(`Modelo de IA '${modelName}' não disponível: ${reason || 'Não suportado ou desabilitado'}`, 'AI_MODEL_UNAVAILABLE', false, {
      ...details,
      model: modelName
    });
    this.name = 'AIModelUnavailableError';
  }
}

export class AIPolicyDeniedError extends AIRouterError {
  constructor(reason: string, details?: { tenantId?: string; provider?: string; model?: string }) {
    super(`Requisição de IA bloqueada pela política de governança: ${reason}`, 'AI_POLICY_DENIED', false, details);
    this.name = 'AIPolicyDeniedError';
  }
}

export class AIInvalidRequestError extends AIRouterError {
  constructor(reason: string, details?: { tenantId?: string }) {
    super(`Parâmetros de requisição de IA inválidos: ${reason}`, 'AI_INVALID_REQUEST', false, details);
    this.name = 'AIInvalidRequestError';
  }
}

export class AIContentError extends AIRouterError {
  constructor(reason: string, details?: { tenantId?: string; provider?: string }) {
    super(`Geração de conteúdo bloqueada por filtro ou política de segurança: ${reason}`, 'AI_CONTENT_ERROR', false, details);
    this.name = 'AIContentError';
  }
}
