/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Design Tokens & Variáveis CSS de Branding por Estabelecimento
 * Seções 7, 8, 9 e 19 da Diretriz
 */

import { EstablishmentBrandingDTO } from '../types.js';

export const DEFAULT_BRANDING_DTO: EstablishmentBrandingDTO = {
  establishmentId: 'est-slz-lounge',
  businessName: 'VozPlay Lounge São Luís',
  slogan: 'Aqui você é a estrela!',
  logoUrl: '',
  primaryColor: '#7C3AED',
  secondaryColor: '#EC4899',
  accentColor: '#F59E0B',
  backgroundColor: '#060811',
  surfaceColor: '#0E1322',
  textColor: '#F8FAFC',
  themeMode: 'DARK',
  tvTheme: 'DARK',
  participantTheme: 'DARK',
  controllerTheme: 'DARK',
  updatedAt: new Date().toISOString()
};

/**
 * Converte um objeto de branding em CSS Properties para aplicação em containers ou previews
 */
export function getBrandingCssVariables(branding?: Partial<EstablishmentBrandingDTO>): Record<string, string> {
  const b = { ...DEFAULT_BRANDING_DTO, ...(branding || {}) };

  return {
    '--brand-primary': b.primaryColor || '#7C3AED',
    '--brand-secondary': b.secondaryColor || '#EC4899',
    '--brand-accent': b.accentColor || '#F59E0B',
    '--brand-background': b.backgroundColor || '#060811',
    '--brand-surface': b.surfaceColor || '#0E1322',
    '--brand-text': b.textColor || '#F8FAFC'
  };
}

/**
 * Aplica as variáveis CSS globalmente no documento (ou no container da aplicação)
 */
export function applyGlobalBrandingTokens(branding?: Partial<EstablishmentBrandingDTO>): void {
  if (typeof document === 'undefined') return;

  const vars = getBrandingCssVariables(branding);
  const root = document.documentElement;

  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

/**
 * Calcula luminância relativa no client para preview de acessibilidade
 */
export function clientGetRelativeLuminance(hex: string): number {
  let clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) return 0.5;

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(val => (val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)));
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function clientGetContrastRatio(hex1: string, hex2: string): number {
  const lum1 = clientGetRelativeLuminance(hex1);
  const lum2 = clientGetRelativeLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}
