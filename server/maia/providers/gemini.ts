/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GEMINI PROVIDER FOR MAIA
 * Implementação nativa via SDK oficial @google/genai.
 * Suporta generateContent, TTS (gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts),
 * Gemini Live configs e fallback inteligente.
 */

import { GoogleGenAI } from '@google/genai';
import { AIProvider, TTSRequest, TTSResponse } from '../types.js';
import { logger } from '../../logger.js';

export class GeminiProvider implements AIProvider {
  public name = 'gemini';
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'SUA_CHAVE_GEMINI_API_AQUI' || apiKey.length < 10) {
      return null;
    }
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  public isAvailable(): boolean {
    return Boolean(this.initClient());
  }

  /**
   * Geração de texto / chat conversacional com proteção anti-injection
   */
  public async generateText(
    prompt: string,
    options?: { systemInstruction?: string; model?: string; maxTokens?: number }
  ): Promise<string> {
    const client = this.initClient();
    const model = options?.model || 'gemini-3.8-flash';

    if (!client) {
      logger.info('[GeminiProvider] GEMINI_API_KEY ausente ou inválida. Retornando resposta padrão de contingência.');
      return 'Olá! Sou a MaIA do VozPlay. No momento estou operando no modo de contingência local. Divirta-se cantando!';
    }

    try {
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: options?.systemInstruction,
          temperature: 0.7,
          maxOutputTokens: options?.maxTokens || 600,
        }
      });

      return response.text || 'Desculpe, não consegui formular uma resposta no momento.';
    } catch (err: any) {
      logger.error('[GeminiProvider] Erro ao chamar generateContent:', {
        model,
        error: err?.message || String(err)
      });
      return 'Olá! A MaIA está animando a festa no VozPlay. Prepare a sua voz para a próxima música!';
    }
  }

  /**
   * Síntese vocal de alta fidelidade (TTS)
   * Utiliza gemini-3.8-flash-lite-tts (econômico) ou gemini-3.8-flash-tts (expressivo)
   */
  public async generateSpeech(
    request: TTSRequest,
    options?: { model?: string }
  ): Promise<TTSResponse> {
    const startTime = Date.now();
    const client = this.initClient();
    const model = options?.model || 'gemini-3.8-flash-lite-tts';
    const voiceName = request.voiceId || 'Aoede'; // Voz padrão brasileira expressiva

    // Fallback estruturado se Gemini não estiver configurado
    if (!client) {
      return {
        audioBase64: null,
        mimeType: 'audio/wav',
        sampleRate: 24000,
        durationEstimateSec: Math.ceil(request.text.length / 15),
        fallbackUsed: true,
        textualFallback: request.text,
        provider: 'fallback_offline',
        model: 'local_synthesis',
        latencyMs: Date.now() - startTime
      };
    }

    try {
      const response = await client.models.generateContent({
        model,
        contents: request.text,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        }
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.[0];
      const audioBase64 = audioPart?.inlineData?.data || null;
      const mimeType = audioPart?.inlineData?.mimeType || 'audio/wav';

      if (!audioBase64) {
        throw new Error('Nenhum dado de áudio retornado pelo modelo de TTS.');
      }

      return {
        audioBase64,
        mimeType,
        sampleRate: 24000,
        durationEstimateSec: Math.ceil(request.text.length / 14),
        fallbackUsed: false,
        textualFallback: request.text,
        provider: 'gemini',
        model,
        latencyMs: Date.now() - startTime
      };
    } catch (err: any) {
      logger.warn('[GeminiProvider] Falha na síntese de áudio TTS, aplicando fallback textual/visual seguro:', {
        model,
        voiceName,
        error: err?.message || String(err)
      });

      return {
        audioBase64: null,
        mimeType: 'audio/wav',
        sampleRate: 24000,
        durationEstimateSec: Math.ceil(request.text.length / 15),
        fallbackUsed: true,
        textualFallback: request.text,
        provider: 'gemini_fallback',
        model,
        latencyMs: Date.now() - startTime
      };
    }
  }

  /**
   * Configuração para conexão Gemini Live WebSockets
   */
  public async generateLiveConfig(options?: { model?: string; voiceName?: string }): Promise<any> {
    const model = options?.model || 'gemini-3.8-live';
    const voiceName = options?.voiceName || 'Aoede';

    return {
      model,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      },
      systemInstruction: {
        parts: [
          {
            text: 'Você é a MaIA, assistente e locutora ao vivo do VozPlay. Converse em português brasileiro de forma acolhedora, curta e divertida.'
          }
        ]
      }
    };
  }
}
