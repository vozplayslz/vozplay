/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Utilitários de Identidade Visual, Sanitização e Acessibilidade (WCAG 2.1)
 * Seções 4, 5, 6, 7, 8, 20, 23 da Diretriz de Branding
 */

import { EstablishmentBranding } from '../src/types.js';

export const DEFAULT_BRANDING: Omit<EstablishmentBranding, 'id' | 'establishmentId' | 'updatedAt'> = {
  businessName: 'VozPlay Lounge São Luís',
  slogan: 'Aqui você é a estrela!',
  logoUrl: '',
  primaryColor: '#7C3AED',     // Roxo Vibrante
  secondaryColor: '#EC4899',   // Rosa Choque
  accentColor: '#F59E0B',      // Âmbar / Dourado
  backgroundColor: '#060811',  // Azul Profundo Noite
  surfaceColor: '#0E1322',      // Superfície Elevada
  textColor: '#F8FAFC',         // Branco Gelo de Alto Contraste
  themeMode: 'DARK',
  tvTheme: 'DARK',
  participantTheme: 'DARK',
  controllerTheme: 'DARK'
};

/**
 * Sanitiza texto removendo qualquer tag HTML, script ou caracteres perigosos
 */
export function sanitizeText(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, (char) => {
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        case '&': return '&amp;';
        default: return char;
      }
    })
    .trim()
    .slice(0, maxLength);
}

/**
 * Valida formato de cor hexadecimal #RGB ou #RRGGBB
 */
export function isValidHexColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color.trim());
}

/**
 * Normaliza cor hexadecimal para 6 dígitos maiúsculos
 */
export function normalizeHexColor(color: string, fallback: string): string {
  if (!isValidHexColor(color)) return fallback;
  let hex = color.trim().toUpperCase();
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

/**
 * Converte hex para RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHexColor(hex, '#000000');
  const r = parseInt(norm.substring(1, 3), 16);
  const g = parseInt(norm.substring(3, 5), 16);
  const b = parseInt(norm.substring(5, 7), 16);
  return { r, g, b };
}

/**
 * Calcula a luminância relativa conforme WCAG 2.1
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calcula a razão de contraste WCAG entre duas cores (entre 1.0 e 21.0)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

/**
 * Sugere ajuste automático de cor de texto para garantir contraste WCAG AA (>= 4.5:1)
 */
export function suggestSafeTextColor(bgHex: string): string {
  const lum = getRelativeLuminance(bgHex);
  // Se o fundo for escuro, sugere branco puro ou cinza claro; se claro, quase preto
  return lum < 0.2 ? '#F8FAFC' : '#090D18';
}

/**
 * Validação rigorosa de acessibilidade das cores (Seção 8 do Requisito)
 */
export interface AccessibilityReport {
  compliant: boolean;
  textOnBackgroundContrast: number;
  textOnSurfaceContrast: number;
  primaryOnBackgroundContrast: number;
  issues: string[];
  suggestions: {
    textColor?: string;
    surfaceColor?: string;
  };
}

export function evaluateBrandingAccessibility(
  backgroundColor: string,
  surfaceColor: string,
  textColor: string,
  primaryColor: string
): AccessibilityReport {
  const textBgRatio = getContrastRatio(backgroundColor, textColor);
  const textSurfaceRatio = getContrastRatio(surfaceColor, textColor);
  const primaryBgRatio = getContrastRatio(backgroundColor, primaryColor);

  const issues: string[] = [];
  const suggestions: { textColor?: string; surfaceColor?: string } = {};

  // WCAG AA para texto padrão exige pelo menos 4.5:1
  if (textBgRatio < 4.5) {
    issues.push(
      `Contraste do Texto no Fundo (${textBgRatio}:1) é insuficiente. O padrão WCAG AA exige pelo menos 4.5:1 para garantir legibilidade.`
    );
    suggestions.textColor = suggestSafeTextColor(backgroundColor);
  }

  // Contraste no painel de superfície
  if (textSurfaceRatio < 4.0) {
    issues.push(
      `Contraste do Texto sobre Superfície (${textSurfaceRatio}:1) pode dificultar a leitura de cards e painéis.`
    );
    if (!suggestions.textColor) {
      suggestions.textColor = suggestSafeTextColor(surfaceColor);
    }
  }

  // Destaque visual do botão primário no fundo
  if (primaryBgRatio < 2.5) {
    issues.push(
      `A Cor Principal tem baixo contraste em relação ao fundo (${primaryBgRatio}:1), dificultando a percepção de botões.`
    );
  }

  return {
    compliant: issues.length === 0,
    textOnBackgroundContrast: textBgRatio,
    textOnSurfaceContrast: textSurfaceRatio,
    primaryOnBackgroundContrast: primaryBgRatio,
    issues,
    suggestions
  };
}

/**
 * Valida e sanitiza SVG contra ataques XSS (Seção 4 do Requisito)
 */
export function sanitizeSvgContent(rawSvg: string): { safe: boolean; sanitizedSvg?: string; error?: string } {
  // SVG não pode conter tags script, iframe, embed, object, tags de evento ou urls javascript:
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /\bon\w+\s*=/gi, // onerror=, onload=, onclick=, etc.
    /javascript\s*:/gi,
    /data\s*:\s*text\/html/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<foreignObject/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(rawSvg)) {
      return { safe: false, error: 'O arquivo SVG contém elementos potencialmente inseguros (scripts ou eventos).' };
    }
  }

  // Verifica se possui tag svg válida
  if (!/<svg[\s\S]*<\/svg>/i.test(rawSvg)) {
    return { safe: false, error: 'Formato SVG inválido: tag <svg> não encontrada.' };
  }

  return {
    safe: true,
    sanitizedSvg: rawSvg.trim()
  };
}
