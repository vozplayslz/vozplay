/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA BYOK (BRING YOUR OWN KEY) MANAGER (PROMPT 07)
 * Gestão de credenciais próprias de locatários com isolamento lógico absoluto,
 * mascaramento criptográfico, rotação e governança de estados.
 * 
 * Princípios de Segurança:
 * - A chave do cliente NUNCA aparece no frontend.
 * - A chave do cliente NUNCA aparece em logs nem é enviada no prompt do LLM.
 * - O Tenant A JAMAIS acessa ou utiliza a chave do Tenant B.
 * - Estados controlados: 'managed' | 'byok' | 'gateway' | 'disabled'.
 */

import { BYOKConfig, BYOKState } from './types.js';
import { AIAuthError, AIPolicyDeniedError } from './errors.js';

export class BYOKManager {
  private configs = new Map<string, BYOKConfig>();
  // Armazenamento em memória seguro das chaves puras (apenas acessível internamente por tenant)
  private secureKeyVault = new Map<string, string>();

  /**
   * Mascara uma chave de API para exibição segura em interfaces administrativas
   */
  public static maskApiKey(key: string): string {
    if (!key || key.length < 8) return '••••••••';
    const prefix = key.substring(0, 6);
    const suffix = key.substring(key.length - 4);
    return `${prefix}••••••••${suffix}`;
  }

  /**
   * Configura o modo gerenciado padrão da Enlace para um tenant
   */
  public setManaged(tenantId: string): BYOKConfig {
    this.secureKeyVault.delete(tenantId);
    const config: BYOKConfig = {
      tenantId,
      state: 'managed',
      updatedAt: new Date().toISOString()
    };
    this.configs.set(tenantId, config);
    return config;
  }

  /**
   * Registra uma chave própria de API do cliente (BYOK) para o tenant com validação de formato
   */
  public registerBYOK(
    tenantId: string,
    apiKey: string,
    allowedModels?: string[],
    customEndpointUrl?: string
  ): BYOKConfig {
    if (!tenantId || tenantId.trim() === '') {
      throw new AIPolicyDeniedError('tenantId é obrigatório para registrar chave BYOK.');
    }

    if (!apiKey || apiKey.trim().length < 15) {
      throw new AIAuthError('A chave de API fornecida possui formato inválido ou é muito curta.', { tenantId });
    }

    // Armazenamento protegido no cofre seguro indexado por tenantId
    this.secureKeyVault.set(tenantId, apiKey.trim());

    const config: BYOKConfig = {
      tenantId,
      state: 'byok',
      maskedApiKey: BYOKManager.maskApiKey(apiKey.trim()),
      allowedModels,
      customEndpointUrl,
      lastRotatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.configs.set(tenantId, config);
    return config;
  }

  /**
   * Configura o uso via 9router Gateway para o tenant
   */
  public setGateway(tenantId: string, gatewayUrl?: string): BYOKConfig {
    const config: BYOKConfig = {
      tenantId,
      state: 'gateway',
      customEndpointUrl: gatewayUrl,
      updatedAt: new Date().toISOString()
    };
    this.configs.set(tenantId, config);
    return config;
  }

  /**
   * Desativa o uso de IA para o tenant
   */
  public setDisabled(tenantId: string): BYOKConfig {
    const config: BYOKConfig = {
      tenantId,
      state: 'disabled',
      updatedAt: new Date().toISOString()
    };
    this.configs.set(tenantId, config);
    return config;
  }

  /**
   * Obtém a configuração pública e mascarada para o tenant (seguro para UI)
   */
  public getConfig(tenantId: string): BYOKConfig {
    const existing = this.configs.get(tenantId);
    if (!existing) {
      return {
        tenantId,
        state: 'managed',
        updatedAt: new Date().toISOString()
      };
    }
    return { ...existing };
  }

  /**
   * Recupera a chave real de execução para o tenant requisitante
   * NUNCA pode ser chamada de fora do servidor seguro
   */
  public getEffectiveApiKey(tenantId: string): { apiKey: string | undefined; state: BYOKState } {
    const config = this.getConfig(tenantId);

    if (config.state === 'disabled') {
      throw new AIPolicyDeniedError('IA desativada para este locatário.', { tenantId });
    }

    if (config.state === 'byok') {
      const clientKey = this.secureKeyVault.get(tenantId);
      if (!clientKey) {
        throw new AIAuthError('Chave BYOK configurada mas não encontrada no cofre do tenant.', { tenantId });
      }
      return { apiKey: clientKey, state: 'byok' };
    }

    // Estado 'managed' ou 'gateway': utiliza a chave padrão do ambiente Enlace
    const managedKey = process.env.GEMINI_API_KEY;
    return { apiKey: managedKey, state: config.state };
  }

  /**
   * Revoga a chave BYOK do tenant e retorna para o modo gerenciado
   */
  public revokeBYOK(tenantId: string): BYOKConfig {
    this.secureKeyVault.delete(tenantId);
    return this.setManaged(tenantId);
  }
}
