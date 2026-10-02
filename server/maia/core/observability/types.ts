/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA OBSERVABILITY & TELEMETRY TYPES (FASE 11)
 * Interfaces para métricas consolidadas, health checks profundos,
 * logs estruturados e auditoria multi-tenant.
 */

export type MaiaSystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface MaiaComponentHealth {
  name: string;
  status: MaiaSystemHealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface MaiaHealthReport {
  overall: MaiaSystemHealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  domain: string;
  components: Record<string, MaiaComponentHealth>;
}

export interface MaiaConsolidatedMetrics {
  timestamp: string;
  uptimeSeconds: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    fallbackCount: number;
    averageLatencyMs: number;
  };
  tokens: {
    totalInput: number;
    totalOutput: number;
    estimatedCostUsd: number;
  };
  security: {
    scannedInputs: number;
    promptInjectionsBlocked: number;
    contextPoisoningBlocked: number;
    eventPoisoningBlocked: number;
    rateLimitsEnforced: number;
    secretsRedactedCount: number;
    lgpdPurgesCompleted: number;
  };
  runtime: {
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    loopsDetected: number;
    toolExecutions: number;
  };
  voice: {
    activeSessions: number;
    voiceFallbackCount: number;
  };
  autonomy: {
    emergencyStopActive: boolean;
    circuitState: string;
    triggersEvaluated: number;
  };
  events: {
    published: number;
    delivered: number;
    deduplicated: number;
    activeSubscriptions: number;
  };
}

export interface AuditQueryOptions {
  tenantId?: string;
  actorId?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
  startTime?: string;
  endTime?: string;
}

export interface ConsolidatedAuditEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  source: string;
  category: 'SECURITY' | 'TOOL' | 'AUTONOMY' | 'AI_PROVIDER' | 'PRIVACY';
  action: string;
  actor: {
    id?: string;
    role?: string;
    name?: string;
  };
  status: 'SUCCESS' | 'DENIED' | 'FLAGGED' | 'ERROR';
  details?: Record<string, unknown>;
}
