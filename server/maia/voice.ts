/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA VOICE IDENTITY MANAGER
 * Centraliza toda a identidade vocal da MaIA (voz feminina, brasileira, acolhedora).
 * Proibido espalhar Voice IDs hardcoded pelo código da aplicação.
 */

import { VoiceConfig } from './types.js';
import { maiaConfigManager, DEFAULT_MAIA_VOICE } from './config.js';

class MaiaVoiceManager {
  /**
   * Obtém a configuração de voz do estabelecimento
   */
  public getVoiceConfig(establishmentId = 'est-slz-lounge'): VoiceConfig {
    const config = maiaConfigManager.getConfig(establishmentId);
    return config.voice || DEFAULT_MAIA_VOICE;
  }

  /**
   * Obtém o Voice ID ativo para o provedor (padrão 'Aoede' para Gemini TTS)
   */
  public getActiveVoiceId(establishmentId = 'est-slz-lounge'): string {
    const voiceConfig = this.getVoiceConfig(establishmentId);
    return voiceConfig.voice_id || 'Aoede';
  }

  /**
   * Obtém o idioma configurado (pt-BR)
   */
  public getLanguage(establishmentId = 'est-slz-lounge'): string {
    const voiceConfig = this.getVoiceConfig(establishmentId);
    return voiceConfig.language || 'pt-BR';
  }

  /**
   * Obtém o nome da persona
   */
  public getPersona(establishmentId = 'est-slz-lounge'): string {
    const voiceConfig = this.getVoiceConfig(establishmentId);
    return voiceConfig.persona || DEFAULT_MAIA_VOICE.persona;
  }
}

export const maiaVoiceManager = new MaiaVoiceManager();
