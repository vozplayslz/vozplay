/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA CONFIG & COST MANAGEMENT
 * Configurações padrão, perfis de custo-benefício e isolamento por estabelecimento.
 */

import { MaIAConfig, MaIACostTier, MaIAModelMapping, MaIAUsageMetrics, VoiceConfig } from './types.js';
import { pgClient } from '../pgClient.js';
import { logger } from '../logger.js';

// Mapeamentos de modelos por perfil de custo-benefício
export const COST_TIER_MODELS: Record<MaIACostTier, MaIAModelMapping> = {
  ECONOMICO: {
    CHAT: 'gemini-3.8-flash',
    LIVE_VOICE: 'gemini-3.8-live',
    REASONING: 'gemini-3.8-flash',
    TTS: 'gemini-3.8-flash-lite-tts',
    TRANSCRIPTION: 'gemini-3.5-transcribe',
    MUSIC_ASSISTANCE: 'gemini-3.8-flash',
  },
  BALANCEADO: {
    CHAT: 'gemini-3.8-flash',
    LIVE_VOICE: 'gemini-3.8-live',
    REASONING: 'gemini-3.1-pro-preview',
    TTS: 'gemini-3.8-flash-tts',
    TRANSCRIPTION: 'gemini-3.5-transcribe',
    MUSIC_ASSISTANCE: 'gemini-3.8-flash',
  },
  ALTA_CAPACIDADE: {
    CHAT: 'gemini-3.1-pro-preview',
    LIVE_VOICE: 'gemini-3.8-live-extended-thinking',
    REASONING: 'gemini-3.1-pro-preview',
    TTS: 'gemini-3.8-flash-tts',
    TRANSCRIPTION: 'gemini-3.5-transcribe-live',
    MUSIC_ASSISTANCE: 'gemini-3.1-pro-preview',
  },
  VOZ: {
    CHAT: 'gemini-3.8-flash',
    LIVE_VOICE: 'gemini-3.8-live',
    REASONING: 'gemini-3.8-flash',
    TTS: 'gemini-3.8-flash-tts',
    TRANSCRIPTION: 'gemini-3.5-transcribe',
    MUSIC_ASSISTANCE: 'gemini-3.8-flash',
  },
  PERSONALIZADO: {
    CHAT: 'gemini-3.8-flash',
    LIVE_VOICE: 'gemini-3.8-live',
    REASONING: 'gemini-3.1-pro-preview',
    TTS: 'gemini-3.8-flash-lite-tts',
    TRANSCRIPTION: 'gemini-3.5-transcribe',
    MUSIC_ASSISTANCE: 'gemini-3.8-flash',
  }
};

// Identidade padrão da voz da MaIA (Feminina, humanizada, brasileira, descontraída)
export const DEFAULT_MAIA_VOICE: VoiceConfig = {
  voice_provider: 'gemini',
  voice_id: 'Aoede', // Voz feminina expressiva, acolhedora e calorosa
  language: 'pt-BR',
  persona: 'MaIA — Mestre de Cerimônias do VozPlay',
  speed: 1.0,
  style: 'animada',
  fallback_voice: 'pt-BR-Standard-A'
};

export const DEFAULT_MAIA_CONFIG: MaIAConfig = {
  establishment_id: 'est-slz-lounge',
  enabled: process.env.MAIA_ENABLED !== 'false',
  active_provider: 'gemini',
  cost_tier: 'BALANCEADO',
  models: { ...COST_TIER_MODELS.BALANCEADO },
  voice: { ...DEFAULT_MAIA_VOICE },
  limits: {
    daily_limit_usd: 15.0,
    monthly_limit_usd: 150.0,
    max_live_session_duration_minutes: 30,
    max_tts_requests_per_day: 500,
    max_requests_per_minute: 60
  },
  announce_queue_calls: true,
  announce_absences: true,
  announce_duets: true,
  tv_audio_enabled: true
};

class MaIAConfigManager {
  private configs: Map<string, MaIAConfig> = new Map();
  private metrics: Map<string, MaIAUsageMetrics> = new Map();

  constructor() {
    this.configs.set(DEFAULT_MAIA_CONFIG.establishment_id, { ...DEFAULT_MAIA_CONFIG });
  }

  public getConfig(establishmentId = 'est-slz-lounge'): MaIAConfig {
    const existing = this.configs.get(establishmentId);
    if (existing) {
      return { ...existing };
    }
    const newConfig: MaIAConfig = {
      ...DEFAULT_MAIA_CONFIG,
      establishment_id: establishmentId
    };
    this.configs.set(establishmentId, newConfig);
    return { ...newConfig };
  }

  public updateConfig(establishmentId: string, updates: Partial<MaIAConfig>): MaIAConfig {
    const current = this.getConfig(establishmentId);
    let updatedModels = { ...current.models };

    // Se o perfil de custo mudou e não é PERSONALIZADO, atualiza os modelos para o perfil selecionado
    if (updates.cost_tier && updates.cost_tier !== 'PERSONALIZADO') {
      updatedModels = { ...COST_TIER_MODELS[updates.cost_tier] };
    } else if (updates.models) {
      updatedModels = { ...updatedModels, ...updates.models };
    }

    const updated: MaIAConfig = {
      ...current,
      ...updates,
      models: updatedModels,
      voice: { ...current.voice, ...(updates.voice || {}) },
      limits: { ...current.limits, ...(updates.limits || {}) },
      establishment_id: establishmentId
    };

    this.configs.set(establishmentId, updated);

    // Persiste no PostgreSQL como fonte oficial de verdade (Prompt 14.2 - Seção 10)
    if (pgClient.isConnected) {
      pgClient.query(
        `INSERT INTO maia_config (id, establishment_id, enabled, active_provider, cost_tier, models, voice, limits, announce_queue_calls, announce_absences, announce_duets, tv_audio_enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (establishment_id) DO UPDATE SET
           enabled = $3, active_provider = $4, cost_tier = $5, models = $6, voice = $7, limits = $8,
           announce_queue_calls = $9, announce_absences = $10, announce_duets = $11, tv_audio_enabled = $12, updated_at = NOW()`,
        [
          `cfg-${establishmentId}`,
          establishmentId,
          updated.enabled,
          updated.active_provider,
          updated.cost_tier,
          JSON.stringify(updated.models),
          JSON.stringify(updated.voice),
          JSON.stringify(updated.limits),
          updated.announce_queue_calls,
          updated.announce_absences,
          updated.announce_duets,
          updated.tv_audio_enabled
        ]
      ).catch((err) => {
        logger.warn('[MaIAConfigManager] Erro ao sincronizar configuração com PostgreSQL:', { error: String(err) });
      });
    }

    return { ...updated };
  }

  /**
   * Hidrata configurações a partir do PostgreSQL (Sobrevive a restarts e redeploys)
   */
  public async hydrateFromPostgres(establishmentId = 'est-slz-lounge'): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      const res = await pgClient.query('SELECT * FROM maia_config WHERE establishment_id = $1', [establishmentId]);
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const loaded: MaIAConfig = {
          establishment_id: row.establishment_id,
          enabled: row.enabled,
          active_provider: row.active_provider,
          cost_tier: row.cost_tier,
          models: typeof row.models === 'string' ? JSON.parse(row.models) : row.models,
          voice: typeof row.voice === 'string' ? JSON.parse(row.voice) : row.voice,
          limits: typeof row.limits === 'string' ? JSON.parse(row.limits) : row.limits,
          announce_queue_calls: row.announce_queue_calls,
          announce_absences: row.announce_absences,
          announce_duets: row.announce_duets,
          tv_audio_enabled: row.tv_audio_enabled
        };
        this.configs.set(establishmentId, loaded);
        logger.info(`[MaIAConfigManager] Configuração da MaIA hidratada do PostgreSQL para '${establishmentId}'.`);
      }
    } catch (err) {
      logger.warn('[MaIAConfigManager] Erro ao hidratar configuração do PostgreSQL:', { error: String(err) });
    }
  }

  public getMetrics(establishmentId = 'est-slz-lounge'): MaIAUsageMetrics {
    let m = this.metrics.get(establishmentId);
    if (!m) {
      m = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        fallbackCalls: 0,
        totalLatencyMs: 0,
        averageLatencyMs: 0,
        ttsCalls: 0,
        ttsLatencyMs: 0,
        liveSessionsCount: 0,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        isCostEstimated: true,
        tokensInput: 0,
        tokensOutput: 0,
        lastUsedAt: new Date().toISOString(),
        byModel: {},
        byTask: {}
      };
      this.metrics.set(establishmentId, m);
    }
    return { ...m };
  }

  public recordUsage(
    establishmentId: string,
    task: string,
    model: string,
    latencyMs: number,
    success: boolean,
    fallback: boolean,
    tokensIn = 0,
    tokensOut = 0
  ) {
    const m = this.getMetrics(establishmentId);
    m.totalCalls++;
    if (success) m.successfulCalls++;
    else m.failedCalls++;
    if (fallback) m.fallbackCalls++;

    m.totalLatencyMs += latencyMs;
    m.averageLatencyMs = Math.round(m.totalLatencyMs / Math.max(1, m.totalCalls));
    m.tokensInput += tokensIn;
    m.tokensOutput += tokensOut;
    m.lastUsedAt = new Date().toISOString();

    // Estimativa de custo simples por chamada/token
    const costIncrement = task === 'TTS' ? 0.00015 : 0.0002;
    m.estimatedCostUsd = Number((m.estimatedCostUsd + costIncrement).toFixed(4));

    if (task === 'TTS') {
      m.ttsCalls++;
      m.ttsLatencyMs = Math.round((m.ttsLatencyMs + latencyMs) / 2);
    } else if (task === 'LIVE_VOICE') {
      m.liveSessionsCount++;
    }

    m.byModel[model] = (m.byModel[model] || 0) + 1;
    m.byTask[task] = (m.byTask[task] || 0) + 1;

    this.metrics.set(establishmentId, m);
  }
}

export const maiaConfigManager = new MaIAConfigManager();
