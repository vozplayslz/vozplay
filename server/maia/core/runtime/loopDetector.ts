/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA AGENT LOOP DETECTOR (Seções 5, 35 e 36)
 * Mecanismo de controle e detecção ativa de loops infinitos, ciclos viciosos,
 * repetições A-B-A-B e estouro de limites orçamentários/temporais.
 */

import { AgentTask, AgentExecutionRecord } from './types.js';
import crypto from 'crypto';

export type LoopDetectionCode = 
  | 'LOOP_REPEATED_ACTION'
  | 'LOOP_OSCILLATING_PATTERN'
  | 'LIMIT_MAX_STEPS'
  | 'LIMIT_MAX_TOOL_CALLS'
  | 'LIMIT_MAX_DURATION'
  | 'LIMIT_MAX_COST'
  | 'LIMIT_CONSECUTIVE_FAILURES';

export interface LoopDetectionResult {
  hasLoop: boolean;
  code?: LoopDetectionCode;
  reason?: string;
}

export class MaiaLoopDetector {
  /**
   * Gera um hash determinístico para identificar uma ação (ferramenta + argumentos)
   */
  public hashAction(toolName: string, args: unknown): string {
    const canonicalJson = this.canonicalStringify(args || {});
    return crypto.createHash('sha256').update(`${toolName}:${canonicalJson}`).digest('hex');
  }

  /**
   * Serialização canônica de JSON com chaves ordenadas alfabeticamente
   */
  public canonicalStringify(obj: any): string {
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
   * Avalia a tarefa contra limites rígidos e histórico de execução
   */
  public check(task: AgentTask): LoopDetectionResult {
    task.metrics.loopChecksCount++;

    const now = Date.now();
    const elapsedMs = now - task.startTime;

    // 1. Limite de Duração (maxDurationMs)
    if (elapsedMs > task.limits.maxDurationMs) {
      return {
        hasLoop: true,
        code: 'LIMIT_MAX_DURATION',
        reason: `Tempo limite de execução atingido (${elapsedMs}ms > ${task.limits.maxDurationMs}ms).`
      };
    }

    // 2. Limite de Passos Executados (maxSteps)
    if (task.metrics.totalStepsExecuted >= task.limits.maxSteps) {
      return {
        hasLoop: true,
        code: 'LIMIT_MAX_STEPS',
        reason: `Número máximo de passos executados atingido (${task.metrics.totalStepsExecuted}/${task.limits.maxSteps}).`
      };
    }

    // 3. Limite de Chamadas de Ferramentas (maxToolCalls)
    if (task.metrics.totalToolCalls >= task.limits.maxToolCalls) {
      return {
        hasLoop: true,
        code: 'LIMIT_MAX_TOOL_CALLS',
        reason: `Limite de chamadas de ferramentas atingido (${task.metrics.totalToolCalls}/${task.limits.maxToolCalls}).`
      };
    }

    // 4. Limite de Custo Estimado (maxCostUsd)
    if (task.metrics.totalEstimatedCostUsd >= task.limits.maxCostUsd) {
      return {
        hasLoop: true,
        code: 'LIMIT_MAX_COST',
        reason: `Orçamento máximo da tarefa excedido ($${task.metrics.totalEstimatedCostUsd.toFixed(4)} >= $${task.limits.maxCostUsd.toFixed(4)}).`
      };
    }

    // 5. Limite de Falhas Consecutivas
    const history = task.executionHistory;
    if (history.length >= task.limits.maxConsecutiveFailures) {
      const recent = history.slice(-task.limits.maxConsecutiveFailures);
      if (recent.every(rec => !rec.success)) {
        return {
          hasLoop: true,
          code: 'LIMIT_CONSECUTIVE_FAILURES',
          reason: `Detectadas ${task.limits.maxConsecutiveFailures} falhas consecutivas de execução.`
        };
      }
    }

    // 6. Detecção de Repetição Idêntica (Mesma ferramenta + mesmos args repetidos)
    if (history.length >= 2) {
      const last = history[history.length - 1];
      const prev = history[history.length - 2];

      if (last.toolName && prev.toolName && last.toolName === prev.toolName) {
        const hashLast = this.hashAction(last.toolName, last.arguments);
        const hashPrev = this.hashAction(prev.toolName, prev.arguments);

        if (hashLast === hashPrev) {
          // Se gerou o mesmo resultado ou erro por duas vezes consecutivas, é um ciclo vicioso
          const resLast = this.canonicalStringify(last.result ?? last.error);
          const resPrev = this.canonicalStringify(prev.result ?? prev.error);

          if (resLast === resPrev) {
            return {
              hasLoop: true,
              code: 'LOOP_REPEATED_ACTION',
              reason: `Ciclo vicioso detectado: ferramenta '${last.toolName}' executada consecutivamente com os mesmos argumentos e resultado.`
            };
          }
        }
      }
    }

    // 7. Detecção de Padrão Oscilatório A -> B -> A -> B (Seção 36)
    if (history.length >= 4) {
      const h = history.slice(-4);
      const action0 = this.hashAction(h[0].toolName || '', h[0].arguments);
      const action1 = this.hashAction(h[1].toolName || '', h[1].arguments);
      const action2 = this.hashAction(h[2].toolName || '', h[2].arguments);
      const action3 = this.hashAction(h[3].toolName || '', h[3].arguments);

      if (action0 === action2 && action1 === action3 && action0 !== action1) {
        return {
          hasLoop: true,
          code: 'LOOP_OSCILLATING_PATTERN',
          reason: `Padrão oscilatório repetitivo detectado (A -> B -> A -> B) entre '${h[0].toolName}' e '${h[1].toolName}'.`
        };
      }
    }

    return { hasLoop: false };
  }
}

export const maiaLoopDetector = new MaiaLoopDetector();
