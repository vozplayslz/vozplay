/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AI PROVIDER INTERFACE (PROMPT 07)
 * Abstração pura de provedor de Inteligência Artificial.
 * Desacopla SDKs concretos, transportes e provedores do núcleo da MaIA.
 */

import {
  AIRequest,
  AIResponse,
  AIChunk,
  ProviderCapabilities,
  ProviderHealth
} from '../types.js';

export interface IAIProvider {
  /** Identificador único do provedor (ex: 'gemini', '9router', 'contingency') */
  readonly id: string;

  /** Nome amigável de exibição */
  readonly name: string;

  /** Consulta as capacidades e modelos suportados pelo provedor */
  capabilities(): Promise<ProviderCapabilities>;

  /** Executa a geração de resposta normalizada (não-streaming) */
  generate(request: AIRequest, modelId: string, apiKey?: string): Promise<AIResponse>;

  /** Executa a geração em streaming de chunks normalizados (opcional) */
  stream?(request: AIRequest, modelId: string, apiKey?: string): AsyncIterable<AIChunk>;

  /** Verifica a saúde operacional do provedor */
  checkHealth(): Promise<ProviderHealth>;
}
