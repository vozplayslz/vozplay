/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MAIA PROVIDERS REGISTRY
 */

import { AIProvider } from '../types.js';
import { GeminiProvider } from './gemini.js';
import { RouterProvider } from './routerProvider.js';

const providers: Map<string, AIProvider> = new Map();

export function getAIProvider(name = 'gemini'): AIProvider {
  const normalized = name.toLowerCase();
  if (providers.has(normalized)) {
    return providers.get(normalized)!;
  }

  let provider: AIProvider;
  if (normalized === '9router' || normalized === 'custom_gateway') {
    provider = new RouterProvider();
  } else {
    provider = new GeminiProvider();
  }

  providers.set(normalized, provider);
  return provider;
}
