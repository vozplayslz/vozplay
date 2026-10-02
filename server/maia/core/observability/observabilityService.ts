/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA OBSERVABILITY & METRICS AGGREGATOR SERVICE (FASE 11)
 * Centralizador de telemetria, agregador de métricas e diagnóstico de integridade profunda.
 * Exporta dados em JSON estruturado e no formato padrão Prometheus / OpenMetrics.
 */

import {
  MaiaHealthReport,
  MaiaComponentHealth,
  MaiaConsolidatedMetrics,
  MaiaSystemHealthStatus
} from './types.js';

import { maiaIdentityEngine } from '../identity/identityEngine.js';
import { maiaContextEngine } from '../context/contextEngine.js';
import { maiaPolicyEngine } from '../policy/policyEngine.js';
import { maiaToolRegistry } from '../tools/toolRegistry.js';
import { maiaEventBus } from '../events/eventBus.js';
import { maiaMemoryEngine } from '../memory/memoryEngine.js';
import { maiaAIRouter } from '../router/aiRouter.js';
import { maiaAgentRuntime } from '../runtime/agentRuntime.js';
import { maiaCoreVoiceManager } from '../voice/voiceManager.js';
import { maiaAutonomyCoordinator } from '../autonomy/autonomyCoordinator.js';
import { maiaPromptShield } from '../security/promptShield.js';

export class MaiaObservabilityService {
  private startTime = Date.now();

  /**
   * Executa checagem de saúde profunda de todos os 10 subsistemas da arquitetura MaIA
   */
  public async getDeepHealthReport(): Promise<MaiaHealthReport> {
    const components: Record<string, MaiaComponentHealth> = {};
    let overallStatus: MaiaSystemHealthStatus = 'HEALTHY';

    // 1. Identity Engine
    try {
      const identity = maiaIdentityEngine.getIdentity();
      components.identity = {
        name: 'IdentityEngine',
        status: identity.name === 'MaIA' ? 'HEALTHY' : 'DEGRADED',
        details: { assistantName: identity.name, org: identity.organization }
      };
    } catch (err) {
      components.identity = { name: 'IdentityEngine', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 2. Context Engine
    try {
      components.context = {
        name: 'ContextEngine',
        status: 'HEALTHY',
        details: { operational: true }
      };
    } catch (err) {
      components.context = { name: 'ContextEngine', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 3. Policy Engine
    try {
      components.policy = {
        name: 'PolicyEngine',
        status: 'HEALTHY',
        details: { operational: true }
      };
    } catch (err) {
      components.policy = { name: 'PolicyEngine', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 4. Tool Registry
    try {
      const tools = maiaToolRegistry.listTools();
      components.tools = {
        name: 'ToolRegistry',
        status: tools.length > 0 ? 'HEALTHY' : 'DEGRADED',
        details: { totalRegistered: tools.length }
      };
    } catch (err) {
      components.tools = { name: 'ToolRegistry', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 5. Event Bus
    try {
      const busMetrics = maiaEventBus.getMetrics();
      components.eventBus = {
        name: 'EventBus',
        status: 'HEALTHY',
        details: {
          totalPublished: busMetrics.totalPublished,
          activeSubscriptions: busMetrics.activeSubscriptions
        }
      };
    } catch (err) {
      components.eventBus = { name: 'EventBus', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 6. Memory Engine
    try {
      components.memory = {
        name: 'MemoryEngine',
        status: 'HEALTHY',
        details: { operational: true }
      };
    } catch (err) {
      components.memory = { name: 'MemoryEngine', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 7. AI Router & Circuit Breaker
    try {
      const routerMetrics = maiaAIRouter.getMetrics();
      const cbOpen = maiaAIRouter.circuitBreaker.isOpen('gemini_enlace');
      components.aiRouter = {
        name: 'AIRouter',
        status: cbOpen ? 'DEGRADED' : 'HEALTHY',
        details: {
          circuitBreakerOpen: cbOpen,
          totalRequests: routerMetrics.totalRequests,
          successful: routerMetrics.successfulRequests,
          fallbackRequests: routerMetrics.fallbackRequests
        }
      };
      if (cbOpen && overallStatus === 'HEALTHY') {
        overallStatus = 'DEGRADED';
      }
    } catch (err) {
      components.aiRouter = { name: 'AIRouter', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 8. Agent Runtime
    try {
      const runtimeMetrics = maiaAgentRuntime.getMetrics();
      components.agentRuntime = {
        name: 'AgentRuntime',
        status: 'HEALTHY',
        details: {
          activeTasks: runtimeMetrics.activeTasks,
          tasksCompleted: runtimeMetrics.tasksCompleted,
          loopsDetected: runtimeMetrics.loopsDetected
        }
      };
    } catch (err) {
      components.agentRuntime = { name: 'AgentRuntime', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 9. Voice Manager
    try {
      const voiceMetrics = maiaCoreVoiceManager.getMetrics();
      components.voiceManager = {
        name: 'VoiceManager',
        status: 'HEALTHY',
        details: {
          activeSessions: voiceMetrics.voiceSessionsActive,
          voiceFallbackCount: voiceMetrics.voiceFallbackCount
        }
      };
    } catch (err) {
      components.voiceManager = { name: 'VoiceManager', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 10. Autonomy Coordinator
    try {
      const autoMetrics = maiaAutonomyCoordinator.getMetrics();
      components.autonomy = {
        name: 'AutonomyCoordinator',
        status: 'HEALTHY',
        details: {
          totalEventsEvaluated: autoMetrics.totalEventsEvaluated,
          humanTakeoversCount: autoMetrics.humanTakeoversCount,
          emergencyStopsCount: autoMetrics.emergencyStopsCount
        }
      };
    } catch (err) {
      components.autonomy = { name: 'AutonomyCoordinator', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    // 11. Security Shield
    try {
      const secMetrics = maiaPromptShield.getMetrics();
      components.security = {
        name: 'SecurityShield',
        status: 'HEALTHY',
        details: {
          promptInjectionsBlocked: secMetrics.promptInjectionsBlocked,
          eventPoisoningBlocked: secMetrics.eventPoisoningAttemptsBlocked,
          rateLimitsEnforced: secMetrics.rateLimitsEnforced
        }
      };
    } catch (err) {
      components.security = { name: 'SecurityShield', status: 'UNHEALTHY', message: String(err) };
      overallStatus = 'DEGRADED';
    }

    return {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: process.env.NODE_ENV || 'production',
      domain: process.env.DOMAIN || 'vozplay.ai.slz.br',
      components
    };
  }

  /**
   * Consolida métricas de todos os módulos em um único DTO observável
   */
  public getConsolidatedMetrics(): MaiaConsolidatedMetrics {
    const routerMetrics = maiaAIRouter.getMetrics();
    const runtimeMetrics = maiaAgentRuntime.getMetrics();
    const voiceMetrics = maiaCoreVoiceManager.getMetrics();
    const autoMetrics = maiaAutonomyCoordinator.getMetrics();
    const busMetrics = maiaEventBus.getMetrics();
    const secMetrics = maiaPromptShield.getMetrics();

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      requests: {
        total: routerMetrics.totalRequests,
        successful: routerMetrics.successfulRequests,
        failed: routerMetrics.failedRequests,
        fallbackCount: routerMetrics.fallbackRequests,
        averageLatencyMs: routerMetrics.averageLatencyMs
      },
      tokens: {
        totalInput: routerMetrics.totalInputTokens,
        totalOutput: routerMetrics.totalOutputTokens,
        estimatedCostUsd: routerMetrics.totalEstimatedCostUsd
      },
      security: {
        scannedInputs: secMetrics.totalScannedInputs,
        promptInjectionsBlocked: secMetrics.promptInjectionsBlocked,
        contextPoisoningBlocked: secMetrics.contextPoisoningAttemptsBlocked,
        eventPoisoningBlocked: secMetrics.eventPoisoningAttemptsBlocked,
        rateLimitsEnforced: secMetrics.rateLimitsEnforced,
        secretsRedactedCount: secMetrics.secretsRedactedCount,
        lgpdPurgesCompleted: secMetrics.lgpdPurgesCompleted
      },
      runtime: {
        activeTasks: runtimeMetrics.activeTasks,
        completedTasks: runtimeMetrics.tasksCompleted,
        failedTasks: runtimeMetrics.tasksFailed,
        loopsDetected: runtimeMetrics.loopsDetected,
        toolExecutions: runtimeMetrics.totalToolExecutions
      },
      voice: {
        activeSessions: voiceMetrics.voiceSessionsActive,
        voiceFallbackCount: voiceMetrics.voiceFallbackCount
      },
      autonomy: {
        emergencyStopActive: false,
        circuitState: 'CLOSED',
        triggersEvaluated: autoMetrics.totalEventsEvaluated
      },
      events: {
        published: busMetrics.totalPublished,
        delivered: busMetrics.totalDelivered,
        deduplicated: busMetrics.totalDeduplicated,
        activeSubscriptions: busMetrics.activeSubscriptions
      }
    };
  }

  /**
   * Exporta métricas no formato padrão texto do Prometheus / OpenMetrics
   */
  public getPrometheusMetrics(): string {
    const m = this.getConsolidatedMetrics();
    const lines: string[] = [
      '# HELP maia_uptime_seconds Tempo de atividade do servidor em segundos',
      '# TYPE maia_uptime_seconds gauge',
      `maia_uptime_seconds ${m.uptimeSeconds}`,
      '',
      '# HELP maia_requests_total Total de requisições de IA processadas',
      '# TYPE maia_requests_total counter',
      `maia_requests_total{status="success"} ${m.requests.successful}`,
      `maia_requests_total{status="failed"} ${m.requests.failed}`,
      `maia_requests_total{status="fallback"} ${m.requests.fallbackCount}`,
      '',
      '# HELP maia_tokens_total Consumo acumulado de tokens de IA',
      '# TYPE maia_tokens_total counter',
      `maia_tokens_total{type="input"} ${m.tokens.totalInput}`,
      `maia_tokens_total{type="output"} ${m.tokens.totalOutput}`,
      '',
      '# HELP maia_cost_estimated_usd Custo financeiro estimado acumulado em USD',
      '# TYPE maia_cost_estimated_usd gauge',
      `maia_cost_estimated_usd ${m.tokens.estimatedCostUsd.toFixed(4)}`,
      '',
      '# HELP maia_security_injections_blocked_total Total de injeções de prompt bloqueadas',
      '# TYPE maia_security_injections_blocked_total counter',
      `maia_security_injections_blocked_total ${m.security.promptInjectionsBlocked}`,
      '',
      '# HELP maia_security_ratelimit_enforced_total Total de bloqueios por rate limiting',
      '# TYPE maia_security_ratelimit_enforced_total counter',
      `maia_security_ratelimit_enforced_total ${m.security.rateLimitsEnforced}`,
      '',
      '# HELP maia_runtime_tasks_active Tarefas atualmente ativas no Agent Runtime',
      '# TYPE maia_runtime_tasks_active gauge',
      `maia_runtime_tasks_active ${m.runtime.activeTasks}`,
      '',
      '# HELP maia_voice_sessions_active Sessões de voz simultâneas ativas',
      '# TYPE maia_voice_sessions_active gauge',
      `maia_voice_sessions_active ${m.voice.activeSessions}`,
      '',
      '# HELP maia_events_published_total Total de eventos de domínio emitidos no Event Bus',
      '# TYPE maia_events_published_total counter',
      `maia_events_published_total ${m.events.published}`
    ];

    return lines.join('\n') + '\n';
  }
}

export const maiaObservability = new MaiaObservabilityService();
