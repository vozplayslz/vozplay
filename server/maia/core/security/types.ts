/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA SECURITY TYPES & CONTRACTS (FASE 11)
 * Definições tipadas para blindagem de prompt injection, context poisoning,
 * event poisoning, sanitização de dados, rate limiting e LGPD.
 */

export type SecurityViolationType = 
  | 'PROMPT_INJECTION'
  | 'CONTEXT_POISONING'
  | 'EVENT_POISONING'
  | 'MEMORY_POISONING'
  | 'PRIVILEGE_ESCALATION'
  | 'UNAUTHORIZED_TOOL'
  | 'FORBIDDEN_COMMAND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CROSS_TENANT_ACCESS'
  | 'SECRET_LEAK_PREVENTED';

export interface PromptInjectionCheckResult {
  isInjection: boolean;
  riskScore: number; // 0.0 a 1.0
  detectedPatterns: string[];
  sanitizedInput: string;
}

export interface RateLimitRule {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  retryAfterSec?: number;
}

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  violationType: SecurityViolationType;
  tenantId: string;
  actorId?: string;
  actorRole?: string;
  source: string;
  details: Record<string, unknown>;
  actionTaken: 'BLOCKED' | 'SANITIZED' | 'FLAGGED';
}

export interface LGPDPurgeRequest {
  tenantId: string;
  participantId: string;
  requestedBy: string;
  reason?: string;
}

export interface LGPDPurgeResult {
  tenantId: string;
  participantId: string;
  removedMemories: number;
  anonymizedQueueItems: number;
  removedHistoryTurns: number;
  timestamp: string;
  success: boolean;
}

export interface SecurityShieldMetrics {
  totalScannedInputs: number;
  promptInjectionsBlocked: number;
  contextPoisoningAttemptsBlocked: number;
  eventPoisoningAttemptsBlocked: number;
  forbiddenCommandsBlocked: number;
  rateLimitsEnforced: number;
  secretsRedactedCount: number;
  lgpdPurgesCompleted: number;
}
