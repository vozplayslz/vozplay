/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PROVIDERS REGISTRY
 * Registro e fábrica de instâncias dos provedores com resolução segura de credenciais.
 */

import { AIProvider, MaIAProviderType } from '../types.js';
import { GeminiProvider } from './gemini.js';
import { RouterProvider } from './routerProvider.js';
import { aiCredentialManager } from '../credentials/credentialManager.js';
import { maiaConfigManager } from '../config.js';

export function getAIProvider(name: string = 'gemini', establishmentId: string = 'est-slz-lounge'): AIProvider {
  const normalized = (name || 'gemini').toLowerCase();

  if (normalized === '9router' || normalized === 'custom_gateway') {
    const config = maiaConfigManager.getConfig(establishmentId);
    const secret = aiCredentialManager.getDecryptedSecret(establishmentId, '9router');
    return new RouterProvider(config.gateway_url, secret);
  }

  if (normalized === 'gemini_customer') {
    const secret = aiCredentialManager.getDecryptedSecret(establishmentId, 'gemini_customer');
    return new GeminiProvider(secret, 'gemini_customer');
  }

  // Padrão: Gemini Enlace
  const enlaceSecret = aiCredentialManager.getDecryptedSecret(establishmentId, 'gemini_enlace') || process.env.GEMINI_API_KEY;
  return new GeminiProvider(enlaceSecret, 'gemini_enlace');
}
