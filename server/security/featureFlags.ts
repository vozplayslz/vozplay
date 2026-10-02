/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA HARDENING & EMERGENCY FEATURE FLAGS (PROMPT 11 - Seções 67 e 68)
 * Centralização absoluta de Feature Flags de Emergência com Padrões Seguros (Safe Defaults).
 * 
 * Princípio Arquitetural:
 * Permite desligar capacidades específicas da IA ou voz sem derrubar a operação
 * essencial de karaokê (fila, som, letras, sessões e presença).
 */

export interface SystemFeatureFlags {
  maiaEnabled: boolean;
  aiEnabled: boolean;
  voiceEnabled: boolean;
  autonomyEnabled: boolean;
  toolsEnabled: boolean;
  externalAiEnabled: boolean;
  byokEnabled: boolean;
  strictTenantIsolation: boolean;
  rateLimitingEnabled: boolean;
  auditLoggingEnabled: boolean;
}

class FeatureFlagManager {
  private flags: SystemFeatureFlags;

  constructor() {
    this.flags = this.loadFlagsFromEnv();
  }

  /**
   * Carrega flags do ambiente com Safe Defaults (Seção 68)
   */
  private loadFlagsFromEnv(): SystemFeatureFlags {
    return {
      // Se MAIA_ENABLED não for 'false', MaIA está ativa como camada de inteligência
      maiaEnabled: process.env.MAIA_ENABLED !== 'false',

      // Se AI_ENABLED for 'false', modo contingência total
      aiEnabled: process.env.AI_ENABLED !== 'false',

      // Voz/Gemini Live (ativo por padrão, desativável isoladamente)
      voiceEnabled: process.env.VOICE_ENABLED !== 'false',

      // Autonomia proativa: Safe Default desligada se não configurada explicitamente
      autonomyEnabled: process.env.MAIA_AUTONOMY_ENABLED === 'true' || process.env.AUTONOMY_ENABLED === 'true',

      // Tool Registry habilitado por padrão
      toolsEnabled: process.env.TOOLS_ENABLED !== 'false',

      // Provedores externos de IA habilitados se não explicitamente desligados
      externalAiEnabled: process.env.EXTERNAL_AI_ENABLED !== 'false',

      // BYOK habilitado por padrão caso configurado
      byokEnabled: process.env.BYOK_ENABLED !== 'false',

      // Isolamento multi-tenant sempre estrito (imutável em produção)
      strictTenantIsolation: true,

      // Rate limiting ativo por padrão
      rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false',

      // Auditoria ativa por padrão
      auditLoggingEnabled: process.env.AUDIT_LOGGING_ENABLED !== 'false'
    };
  }

  public getFlags(): SystemFeatureFlags {
    return { ...this.flags };
  }

  public isEnabled(flag: keyof SystemFeatureFlags): boolean {
    return this.flags[flag];
  }

  /**
   * Permite alternar flags em tempo de execução para testes ou resposta a incidentes
   */
  public setFlag(flag: keyof SystemFeatureFlags, value: boolean): void {
    // strictTenantIsolation é imutável por segurança absoluta
    if (flag === 'strictTenantIsolation' && !value) {
      throw new Error('[Segurança] O isolamento estrito de tenant não pode ser desativado.');
    }
    this.flags[flag] = value;
  }

  public resetToDefaults(): void {
    this.flags = this.loadFlagsFromEnv();
  }
}

export const featureFlagManager = new FeatureFlagManager();
