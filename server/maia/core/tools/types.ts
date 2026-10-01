/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA ADVANCED TOOL REGISTRY TYPES (PROMPT 04)
 * Contratos de ferramentas, níveis de risco, schemas de validação,
 * resultados padronizados, idempotência, confirmação humana e auditoria.
 */

import { MaiaContextSnapshot } from '../context/types.js';

// ============================================================================
// 1. CLASSIFICAÇÃO DE RISCO E CATEGORIAS
// ============================================================================

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ToolCategory = 'READ' | 'ACTION' | 'HIGH_RISK' | 'CRITICAL';

export type ToolLifecycleState = 
  | 'registered'
  | 'enabled'
  | 'available'
  | 'authorized'
  | 'executing'
  | 'completed'
  | 'denied'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export type ToolErrorCode = 
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_ERROR'
  | 'INTERNAL_ERROR'
  | 'AWAITING_CONFIRMATION';

// ============================================================================
// 2. CONTRATO DA FERRAMENTA (MAIA TOOL CONTRACT)
// ============================================================================

export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly string[] | string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: {
    type: string;
  };
  properties?: Record<string, ToolParameterProperty>;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: readonly string[] | string[];
  additionalProperties?: boolean;
}

export interface ToolOutputSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
}

export interface MaiaToolExecutionContext {
  readonly toolRequestId: string;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly actorDisplayName: string;
  readonly permissions: readonly string[];
  readonly channel?: string;
  readonly idempotencyKey?: string;
  readonly isConfirmed?: boolean;
  readonly confirmationId?: string;
  readonly snapshot?: MaiaContextSnapshot;
}

export interface MaiaToolContract<TInput = any, TOutput = any> {
  /** Identificador com namespace (ex: 'karaoke.queue.getStatus') */
  readonly id: string;
  /** Nome amigável */
  readonly name: string;
  /** Descrição clara e objetiva para o modelo de IA */
  readonly description: string;
  /** Versão da ferramenta (ex: 'v1') */
  readonly version: string;
  /** Categoria operacional */
  readonly category: ToolCategory;
  /** Nível de risco de execução */
  readonly riskLevel: ToolRiskLevel;
  /** Esquema JSON estrito de validação dos parâmetros de entrada */
  readonly inputSchema: ToolInputSchema;
  /** Esquema de saída esperado */
  readonly outputSchema?: ToolOutputSchema;
  /** Permissões mínimas requeridas */
  readonly permissions: readonly string[];
  /** Papéis RBAC com permissão para executar */
  readonly allowedRoles: readonly string[];
  /** Se a execução exige confirmação humana prévia */
  readonly requiresConfirmation?: boolean;
  /** Pergunta/Prompt de confirmação amigável */
  readonly confirmationPrompt?: string;
  /** Se suporta proteção contra requisições duplicadas via idempotencyKey */
  readonly isIdempotent?: boolean;
  /** Timeout máximo de execução em milissegundos (padrão: 5000ms) */
  readonly timeoutMs?: number;
  /** Se a ferramenta pode sofrer retry automático seguro em caso de timeout transitório */
  readonly isRetryable?: boolean;
  /** Capacidades declaradas (ex: ['read', 'write', 'notify']) */
  readonly capabilities?: readonly string[];
  /** Status de ativação global da ferramenta */
  enabled: boolean;
  /** Função de execução desacoplada */
  execute: (context: MaiaToolExecutionContext, params: TInput) => Promise<TOutput>;
}

// ============================================================================
// 3. RESULTADO PADRONIZADO DA FERRAMENTA (TOOL RESULT)
// ============================================================================

export interface MaiaToolResultMetadata {
  toolId: string;
  toolVersion: string;
  toolRequestId: string;
  correlationId: string;
  latencyMs: number;
  timestamp: string;
  cached?: boolean;
  requiresConfirmation?: boolean;
  confirmationId?: string;
}

export interface MaiaToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ToolErrorCode;
  metadata: MaiaToolResultMetadata;
}

// ============================================================================
// 4. AUDITORIA E REGISTRO DE EXECUÇÃO
// ============================================================================

export interface MaiaToolAuditRecord {
  id: string;
  timestamp: string;
  toolId: string;
  toolVersion: string;
  toolRequestId: string;
  correlationId: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED' | 'TIMEOUT' | 'AWAITING_CONFIRMATION';
  riskLevel: ToolRiskLevel;
  reason?: string;
  latencyMs: number;
  inputSummary?: Record<string, unknown>;
}

// ============================================================================
// 5. DISCOVERY E FILTROS DE VISIBILIDADE
// ============================================================================

export interface MaiaToolDiscoveryFilter {
  actorRole: string;
  permissions?: readonly string[];
  tenantId?: string;
  channel?: string;
  category?: ToolCategory;
  riskLevel?: ToolRiskLevel;
}
