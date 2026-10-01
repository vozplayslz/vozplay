/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA MEMORY PROVIDER CONTRACT
 * Abstração de armazenamento para desacoplar a API de memória do storage físico
 * (PostgreSQL, InMemory, futuro Redis, futuro Vector Store).
 */

import { MemoryItem, MemoryQuery, MemoryScope } from '../types.js';

export interface IMemoryProvider {
  /** Nome identificador do provedor */
  readonly name: string;

  /** Verifica se o armazenamento está operacional */
  isAvailable(): Promise<boolean>;

  /** Armazena um item novo */
  store(item: MemoryItem): Promise<void>;

  /** Recupera um item pelo ID dentro do tenant */
  getById(tenantId: string, id: string): Promise<MemoryItem | null>;

  /** Executa busca estruturada de itens */
  query(query: MemoryQuery): Promise<MemoryItem[]>;

  /** Atualiza um item existente */
  update(item: MemoryItem): Promise<void>;

  /** Remove um item específico */
  delete(tenantId: string, id: string): Promise<boolean>;

  /** Remove memórias por escopo (ex: forget de sessão ou de usuário) */
  deleteByScope(tenantId: string, scope: MemoryScope, identifier?: string): Promise<number>;

  /** Remove registros expirados (TTL) */
  pruneExpired(tenantId?: string): Promise<number>;

  /** Limpa registros (utilizado em testes e resets) */
  clear(tenantId?: string): Promise<void>;
}
