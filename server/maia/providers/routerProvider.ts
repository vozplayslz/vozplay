/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 9ROUTER / GATEWAY PROVIDER FOR MAIA
 * Provedor compatível com 9router e gateways corporativos de IA.
 * Funciona de forma totalmente autônoma com fallback para Gemini nativo se o gateway não estiver configurado.
 */

import { AIProvider, TTSRequest, TTSResponse } from '../types.js';
import { GeminiProvider } from './gemini.js';
import { logger } from '../../logger.js';

export class RouterProvider implements AIProvider {
  public name = '9router';
  private fallbackProvider: GeminiProvider;
  private gatewayUrl: string | null = null;
  private apiKey: string | null = null;

  constructor() {
    this.fallbackProvider = new GeminiProvider();
    this.gatewayUrl = process.env.ROUTER_GATEWAY_URL || null;
    this.apiKey = process.env.ROUTER_API_KEY || null;
  }

  public isAvailable(): boolean {
    return Boolean(this.gatewayUrl && this.apiKey) || this.fallbackProvider.isAvailable();
  }

  public async generateText(
    prompt: string,
    options?: { systemInstruction?: string; model?: string; maxTokens?: number }
  ): Promise<string> {
    if (!this.gatewayUrl || !this.apiKey) {
      // 9router não configurado explicitamente; delega de forma transparente para o provedor Gemini nativo
      return this.fallbackProvider.generateText(prompt, options);
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
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
      logger.warn('[RouterProvider] Falha na rota do 9router gateway, acionando fallback Gemini direto:', {
        error: err?.message || String(err)
      });
      return this.fallbackProvider.generateText(prompt, options);
    }
  }

  public async generateSpeech(
    request: TTSRequest,
    options?: { model?: string }
  ): Promise<TTSResponse> {
    // Para TTS e geração de voz, utiliza a síntese otimizada do GeminiProvider
    return this.fallbackProvider.generateSpeech(request, options);
  }

  public async generateLiveConfig(options?: any): Promise<any> {
    return this.fallbackProvider.generateLiveConfig(options);
  }
}
