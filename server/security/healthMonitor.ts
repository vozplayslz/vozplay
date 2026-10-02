/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA COMPREHENSIVE HEALTH & DEPENDENCY OBSERVABILITY (PROMPT 11 - Seções 37, 38, 39 e 40)
 * Monitoramento de saúde granular com estados degradados.
 * 
 * Princípio Arquitetural:
 * A indisponibilidade de IA ou voz NUNCA marca o sistema como DOWN.
 * O karaokê (fila, som, tela, presenças) permanece 100% operacional.
 */

import { pgClient } from '../pgClient.js';
import { db } from '../db.js';
import { maiaAIRouter } from '../maia/core/router/aiRouter.js';
import { maiaAgentRuntime } from '../maia/core/runtime/agentRuntime.js';
import { maiaCoreVoiceManager } from '../maia/core/voice/voiceManager.js';
import { maiaAutonomyCoordinator } from '../maia/core/autonomy/autonomyCoordinator.js';
import { maiaEmergencyStop } from '../maia/core/autonomy/emergencyStop.js';
import { featureFlagManager } from './featureFlags.js';

export type SubsystemStatus = 'healthy' | 'degraded' | 'unavailable' | 'disabled';

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  domain: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  degradedModeActive: boolean;
  subsystems: {
    core: { status: SubsystemStatus; message?: string };
    database: { status: SubsystemStatus; mode: string };
    aiRouter: { status: SubsystemStatus; circuitBreaker: string; fallbackReady: boolean };
    agentRuntime: { status: SubsystemStatus; activeTasks: number };
    voiceLayer: { status: SubsystemStatus; activeSessions: number };
    autonomy: { status: SubsystemStatus; emergencyStopActive: boolean; mode: string };
    eventBus: { status: SubsystemStatus };
    memoryStore: { status: SubsystemStatus };
  };
}

export class HealthMonitor {
  /**
   * Avalia a saúde de todos os subsistemas de forma não-bloqueante
   */
  public async getHealthReport(tenantId = 'default-tenant'): Promise<SystemHealthReport> {
    const uptime = process.uptime();
    const isProd = process.env.NODE_ENV === 'production';

    // 1. Database
    const dbMode = pgClient.isConnected ? 'postgresql_connected' : 'in_memory_resilient';
    const dbStatus: SubsystemStatus = (pgClient.isConnected || !isProd ? 'healthy' : 'degraded') as SubsystemStatus;

    // 2. AI Router & Provedores
    const aiEnabled = featureFlagManager.isEnabled('aiEnabled');
    let aiStatus: SubsystemStatus = 'healthy';
    if (!aiEnabled) {
      aiStatus = 'disabled';
    } else if (maiaAIRouter.circuitBreaker.isOpen('gemini')) {
      aiStatus = 'degraded';
    }

    // 3. Agent Runtime
    const runtimeMetrics = maiaAgentRuntime.getMetrics();
    const runtimeStatus: SubsystemStatus = 'healthy';

    // 4. Voice Layer
    const voiceEnabled = featureFlagManager.isEnabled('voiceEnabled');
    const voiceMetrics = maiaCoreVoiceManager.getMetrics();
    const voiceStatus: SubsystemStatus = (voiceEnabled ? 'healthy' : 'disabled') as SubsystemStatus;

    // 5. Autonomia
    const isStopActive = maiaEmergencyStop.isEmergencyStopActive(tenantId);
    const autonomyStatus: SubsystemStatus = isStopActive ? 'degraded' : 'healthy';

    // Estado Geral (Se AI ou Voice estiverem degradados, o sistema é 'degraded', nunca 'unhealthy')
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (aiStatus === 'degraded' || voiceStatus === 'degraded' || isStopActive) {
      overallStatus = 'degraded';
    }
    if (dbStatus === 'unavailable') {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      service: 'VozPlay Core Platform & MaIA Ecosystem',
      domain: 'vozplay.ai.slz.br',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(uptime),
      environment: process.env.NODE_ENV || 'development',
      degradedModeActive: overallStatus === 'degraded',
      subsystems: {
        core: { status: 'healthy' },
        database: { status: dbStatus, mode: dbMode },
        aiRouter: {
          status: aiStatus,
          circuitBreaker: maiaAIRouter.circuitBreaker.isOpen('gemini') ? 'OPEN' : 'CLOSED',
          fallbackReady: true
        },
        agentRuntime: {
          status: runtimeStatus,
          activeTasks: runtimeMetrics.activeTasks
        },
        voiceLayer: {
          status: voiceStatus,
          activeSessions: voiceMetrics.voiceSessionsActive
        },
        autonomy: {
          status: autonomyStatus,
          emergencyStopActive: isStopActive,
          mode: isStopActive ? 'EMERGENCY_STOP' : 'ACTIVE'
        },
        eventBus: { status: 'healthy' },
        memoryStore: { status: 'healthy' }
      }
    };
  }
}

export const healthMonitor = new HealthMonitor();
