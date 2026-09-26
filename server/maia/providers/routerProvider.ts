/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 9ROUTER / GATEWAY PROVIDER FOR MAIA
 * Provedor compatível com 9router e gateways corporativos de IA.
 * Funciona de forma autônoma com fallback para Gemini nativo se o gateway não estiver configurado.
 */

import {
  AIProvider,
  TTSRequest,
  TTSResponse,
  MaIATaskType,
  ValidationResult,
  ValidationCheck
} from '../types.js';
import { GeminiProvider } from './gemini.js';
import { logger } from '../../logger.js';

export class RouterProvider implements AIProvider {
  public name = '9router';
  public capabilities: MaIATaskType[] = [
    'CHAT',
    'REASONING',
    'MUSIC_ASSISTANCE',
    'TTS'
  ];
  private fallbackProvider: GeminiProvider;
  private gatewayUrl: string | null = null;
  private apiKey: string | null = null;

  constructor(gatewayUrl?: string, apiKey?: string) {
    this.fallbackProvider = new GeminiProvider();
    this.gatewayUrl = gatewayUrl || process.env.ROUTER_GATEWAY_URL || null;
    this.apiKey = apiKey || process.env.ROUTER_API_KEY || null;
  }

  public isAvailable(): boolean {
    return Boolean(this.gatewayUrl && this.apiKey) || this.fallbackProvider.isAvailable();
  }

  /**
   * Validação de conexão do 9router Gateway
   */
  public async testConnection(options?: {
    gatewayUrl?: string;
    apiKey?: string;
    projectId?: string;
  }): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    const url = options?.gatewayUrl || this.gatewayUrl || '';
    const key = options?.apiKey || this.apiKey || '';

    // 1. Checagem de Endpoint
    const hasUrl = Boolean(url && url.startsWith('http'));
    checks.push({
      name: 'Endpoint do Gateway',
      passed: hasUrl,
      message: hasUrl ? `Endpoint válido: ${url}` : 'URL do gateway inválida ou não informada.'
    });

    // 2. Token de Autenticação
    const hasKey = Boolean(key && key.length >= 6);
    checks.push({
      name: 'Token de Autenticação',
      passed: hasKey,
      message: hasKey ? 'Token de autenticação configurado.' : 'Token de autenticação ausente.'
    });

    if (!hasUrl || !hasKey) {
      return {
        valid: false,
        provider: '9router',
        projectId: options?.projectId || '9router-gateway',
        checks,
        error: 'Configuração incompleta do gateway 9router.'
      };
    }

    // 3. Probe de Conectividade
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'gemini-3.8-flash',
          messages: [{ role: 'user', content: 'OK' }],
          max_tokens: 5
        })
      });

      const success = res.ok;
      checks.push({
        name: 'Conexão com o Gateway',
        passed: success,
        message: success ? `Gateway respondeu HTTP ${res.status}` : `Gateway retornou erro HTTP ${res.status}`
      });

      return {
        valid: success,
        provider: '9router',
        projectId: options?.projectId || '9router-gateway',
        checks,
        error: success ? undefined : `Erro HTTP ${res.status} ao conectar ao gateway.`
      };
    } catch (err: any) {
      checks.push({
        name: 'Conexão com o Gateway',
        passed: false,
        message: `Falha na conexão de rede: ${err?.message || err}`
      });

      return {
        valid: false,
        provider: '9router',
        projectId: options?.projectId || '9router-gateway',
        checks,
        error: err?.message || 'Falha de rede com o gateway.'
      };
    }
  }

  public async generateText(
    prompt: string,
    options?: { systemInstruction?: string; model?: string; maxTokens?: number }
  ): Promise<string> {
    if (!this.gatewayUrl || !this.apiKey) {
      // 9router não configurado; delega para Gemini Enlace nativo
      return this.fallbackProvider.generateText(prompt, options);
    }

    try {
      const res = await fetch(`${this.gatewayUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options?.model || 'gemini-3.8-flash',
          messages: [
            ...(options?.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
            { role: 'user', content: prompt }
          ],
          max_tokens: options?.maxTokens || 600
        })
      });

      if (!res.ok) {
        throw new Error(`Gateway HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || 'Resposta recebida via gateway.';
    } catch (err: any) {
      logger.warn('[RouterProvider] Falha no 9router gateway, acionando fallback Gemini direto:', {
        error: err?.message || String(err)
      });
      return this.fallbackProvider.generateText(prompt, options);
    }
  }

  public async generateSpeech(
    request: TTSRequest,
    options?: { model?: string }
  ): Promise<TTSResponse> {
    return this.fallbackProvider.generateSpeech(request, options);
  }

  public async generateLiveConfig(options?: any): Promise<any> {
    return this.fallbackProvider.generateLiveConfig(options);
  }
}
