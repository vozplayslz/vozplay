/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY ERRORS
 * Classes de erro tipadas para a camada de memória da MaIA.
 * Evita vazamento de stack traces e informações confidenciais para clientes.
 */

export class MemoryError extends Error {
  public readonly code: string;
  public readonly tenantId?: string;

  constructor(message: string, code: string = 'MEMORY_ERROR', tenantId?: string) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    this.tenantId = tenantId;
  }
}

export class MemorySecretRejectedError extends MemoryError {
  public readonly detectedPattern: string;

  constructor(reason: string, detectedPattern: string = 'CONFIDENTIAL_DATA', tenantId?: string) {
    super(`Gravação de memória rejeitada por política de privacidade: ${reason}`, 'MEMORY_SECRET_REJECTED', tenantId);
    this.name = 'MemorySecretRejectedError';
    this.detectedPattern = detectedPattern;
  }
}

export class MemoryPoisoningError extends MemoryError {
  public readonly suspiciousPattern: string;

  constructor(reason: string, suspiciousPattern: string = 'UNTRUSTED_INSTRUCTION', tenantId?: string) {
    super(`Gravação de memória rejeitada por proteção contra Memory Poisoning: ${reason}`, 'MEMORY_POISONING_DETECTED', tenantId);
    this.name = 'MemoryPoisoningError';
    this.suspiciousPattern = suspiciousPattern;
  }
}

export class MemoryNotFoundError extends MemoryError {
  public readonly memoryId: string;

  constructor(memoryId: string, tenantId?: string) {
    super(`Item de memória '${memoryId}' não encontrado para o escopo fornecido.`, 'MEMORY_NOT_FOUND', tenantId);
    this.name = 'MemoryNotFoundError';
    this.memoryId = memoryId;
  }
}

export class MemoryAccessDeniedError extends MemoryError {
  constructor(reason: string, tenantId?: string) {
    super(`Acesso negado à memória: ${reason}`, 'MEMORY_ACCESS_DENIED', tenantId);
    this.name = 'MemoryAccessDeniedError';
  }
}

export class MemoryUnavailableError extends MemoryError {
  constructor(reason: string = 'Serviço de memória temporariamente indisponível.') {
    super(reason, 'MEMORY_UNAVAILABLE');
    this.name = 'MemoryUnavailableError';
  }
}
