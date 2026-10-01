/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AGENT TASK STORE (Seções 6, 22, 32)
 * Repositório bounded de tarefas do agente com isolamento multi-tenant estrito,
 * auditoria de estados e recuperação de ciclo de execução.
 */

import { AgentTask, AgentTaskStatus } from './types.js';

export class MaiaTaskStore {
  private tasks = new Map<string, AgentTask>();
  private readonly maxTasksPerTenant: number;

  constructor(options?: { maxTasksPerTenant?: number }) {
    this.maxTasksPerTenant = options?.maxTasksPerTenant || 200;
  }

  /**
   * Salva ou atualiza uma tarefa
   */
  public save(task: AgentTask): void {
    task.updatedAt = new Date().toISOString();
    this.tasks.set(task.id, task);
    this.enforceTenantLimit(task.tenantId);
  }

  /**
   * Obtém uma tarefa pelo ID com verificação opcional de tenantId
   */
  public get(taskId: string, tenantId?: string): AgentTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    if (tenantId && task.tenantId !== tenantId) {
      return undefined; // Isolamento estrito de tenant
    }
    return task;
  }

  /**
   * Lista tarefas de um tenant com filtros opcionais
   */
  public list(tenantId: string, filter?: { status?: AgentTaskStatus; limit?: number }): AgentTask[] {
    const limit = filter?.limit || 50;
    const results: AgentTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.tenantId === tenantId) {
        if (!filter?.status || task.status === filter.status) {
          results.push(task);
        }
      }
    }

    // Ordena decrescente por data de criação
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Remove uma tarefa
   */
  public delete(taskId: string, tenantId?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (tenantId && task.tenantId !== tenantId) return false;
    return this.tasks.delete(taskId);
  }

  /**
   * Retorna o total de tarefas armazenadas
   */
  public count(tenantId?: string): number {
    if (!tenantId) return this.tasks.size;
    let c = 0;
    for (const task of this.tasks.values()) {
      if (task.tenantId === tenantId) c++;
    }
    return c;
  }

  /**
   * Limita a quantidade de tarefas por tenant para evitar estouro de memória
   */
  private enforceTenantLimit(tenantId: string): void {
    const tenantTasks: AgentTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.tenantId === tenantId) {
        tenantTasks.push(task);
      }
    }

    if (tenantTasks.length > this.maxTasksPerTenant) {
      // Ordena por data de criação crescente para remover os mais antigos já finalizados
      tenantTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const finishedTasks = tenantTasks.filter(t => 
        ['completed', 'failed', 'cancelled', 'expired', 'loop_detected'].includes(t.status)
      );

      const toRemove = finishedTasks.slice(0, tenantTasks.length - this.maxTasksPerTenant);
      for (const t of toRemove) {
        this.tasks.delete(t.id);
      }
    }
  }

  /**
   * Remove tarefas finalizadas há mais de maxAgeMs (padrão 24h)
   */
  public pruneOld(maxAgeMs: number = 86400000): number {
    const now = Date.now();
    let count = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (['completed', 'failed', 'cancelled', 'expired', 'loop_detected'].includes(task.status)) {
        if (now - new Date(task.updatedAt).getTime() > maxAgeMs) {
          this.tasks.delete(id);
          count++;
        }
      }
    }
    return count;
  }
}

export const maiaTaskStore = new MaiaTaskStore();
