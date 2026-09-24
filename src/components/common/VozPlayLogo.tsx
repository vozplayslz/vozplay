/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Logotipo Oficial & Mascote Polvo Cantor 3D
 * Representação vetorial de altíssima fidelidade do mascote oficial:
 * Polvo cantor 3D com microfone vintage, ondas sonoras e tipografia VozPlay adaptável.
 * 
 * Suporta:
 * - Adaptação dinâmica para qualquer cor de tema (HEX, CSS vars ou presets)
 * - Modo Claro (Light), Escuro (Dark) e Automático
 * - Modos de coloração: 'adaptive' (polvo no tom da casa), 'official' (azul clássico VozPlay) e 'monochrome'
 * - Uso como Favicon de alta fidelidade
 * - Múltiplas variantes ('full', 'compact', 'mascot-only', 'text-only', 'badge', 'vertical', 'favicon')
 * - IDs isolados por instância via React.useId() para evitar conflitos de gradiente no DOM
 */

import React, { useId, useMemo } from 'react';

export type LogoVariant = 'full' | 'compact' | 'mascot-only' | 'text-only' | 'badge' | 'vertical' | 'favicon';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type LogoThemeMode = 'dark' | 'light' | 'auto';
export type LogoColorMode = 'adaptive' | 'official' | 'monochrome';

export interface VozPlayLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  animated?: boolean;
  themeColor?: string;
  themeMode?: LogoThemeMode;
  colorMode?: LogoColorMode;
  textColor?: 'default' | 'light' | 'dark' | 'contrast';
  showBadge?: boolean;
  badgeText?: string;
  sublabel?: string;
  onClick?: () => void;
}

export interface VozPlayMascotIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
  themeColor?: string;
  themeMode?: LogoThemeMode;
  colorMode?: LogoColorMode;
  showWaves?: boolean;
  showShadow?: boolean;
  variant?: 'standard' | 'favicon' | 'badge';
}

// Mapeamento de dimensões para cada tamanho
const SIZE_MAP: Record<LogoSize, { mascot: number; text: string; subtext: string; gap: string; fullHeight: string }> = {
  xs: { mascot: 28, text: 'text-base', subtext: 'text-[9px]', gap: 'gap-2', fullHeight: 'h-7' },
  sm: { mascot: 36, text: 'text-xl', subtext: 'text-[10px]', gap: 'gap-2.5', fullHeight: 'h-9' },
  md: { mascot: 48, text: 'text-2xl', subtext: 'text-xs', gap: 'gap-3', fullHeight: 'h-12' },
  lg: { mascot: 64, text: 'text-3xl', subtext: 'text-sm', gap: 'gap-3.5', fullHeight: 'h-16' },
  xl: { mascot: 88, text: 'text-4xl', subtext: 'text-base', gap: 'gap-4', fullHeight: 'h-22' },
  hero: { mascot: 120, text: 'text-6xl', subtext: 'text-lg', gap: 'gap-5', fullHeight: 'h-32' }
};

// Paletas pré-configuradas de temas
export const THEME_COLOR_PRESETS: Record<string, string> = {
  blue: '#2563EB',    // Azul Royal Oficial VozPlay
  purple: '#7C3AED',  // Roxo Neon Lounge
  pink: '#EC4899',    // Rosa Sunset
  emerald: '#10B981', // Verde Esmeralda Fresh
  amber: '#F59E0B',   // Dourado Gold Karaokê
  cyan: '#06B6D4',    // Ciano Elétrico Cyber
  rose: '#E11D48',    // Carmim Show
  indigo: '#4F46E5',  // Índigo Profundo
  slate: '#475569'    // Monocromático elegante
};

export interface MascotPalette {
  bodyHighlight: string;
  bodyLight: string;
  bodyPrimary: string;
  bodyDark: string;
  bodyDeep: string;
  backTentacles: string;
  suckerLight: string;
  suckerMid: string;
  suckerDark: string;
  waveLight: string;
  waveDark: string;
  glowAura: string;
  eyebrows: string;
  textVoz: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

/**
 * Converte HEX para HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length !== 6) {
    // Default blue
    return { h: 221, s: 83, l: 53 };
  }

  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Converte HSL para HEX
 */
function hslToHex(h: number, s: number, l: number): string {
  const normL = Math.max(0, Math.min(100, l)) / 100;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normH = ((h % 360) + 360) % 360;

  const a = normS * Math.min(normL, 1 - normL);
  const f = (n: number) => {
    const k = (n + normH / 30) % 12;
    const color = normL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Calcula a paleta vetorial 3D completa com base na cor de tema informada
 */
export function computeMascotPalette(themeColor?: string, colorMode: LogoColorMode = 'adaptive'): MascotPalette {
  // Paleta oficial VozPlay clássica (Azul Royal)
  const OFFICIAL_BLUE: MascotPalette = {
    bodyHighlight: '#93C5FD',
    bodyLight: '#60A5FA',
    bodyPrimary: '#2563EB',
    bodyDark: '#1D4ED8',
    bodyDeep: '#1E3A8A',
    backTentacles: '#1E40AF',
    suckerLight: '#A5F3FC',
    suckerMid: '#38BDF8',
    suckerDark: '#0284C7',
    waveLight: '#38BDF8',
    waveDark: '#60A5FA',
    glowAura: 'rgba(37, 99, 235, 0.45)',
    eyebrows: '#1E3A8A',
    textVoz: '#2563EB',
    badgeBg: 'rgba(37, 99, 235, 0.2)',
    badgeBorder: 'rgba(96, 165, 250, 0.3)',
    badgeText: '#93C5FD'
  };

  if (colorMode === 'official') {
    return OFFICIAL_BLUE;
  }

  if (colorMode === 'monochrome') {
    return {
      bodyHighlight: '#E2E8F0',
      bodyLight: '#94A3B8',
      bodyPrimary: '#64748B',
      bodyDark: '#475569',
      bodyDeep: '#1E293B',
      backTentacles: '#334155',
      suckerLight: '#F8FAFC',
      suckerMid: '#CBD5E1',
      suckerDark: '#94A3B8',
      waveLight: '#94A3B8',
      waveDark: '#64748B',
      glowAura: 'rgba(100, 116, 139, 0.35)',
      eyebrows: '#0F172A',
      textVoz: '#475569',
      badgeBg: 'rgba(100, 116, 139, 0.2)',
      badgeBorder: 'rgba(148, 163, 184, 0.3)',
      badgeText: '#CBD5E1'
    };
  }

  // Normaliza o valor de cor (HEX ou preset ou fallback)
  let resolvedColor = themeColor;
  if (!resolvedColor || resolvedColor === 'brand' || resolvedColor === 'auto') {
    // Tenta pegar da CSS variable global se estiver no navegador
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const computed = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim();
      if (computed && computed.startsWith('#')) {
        resolvedColor = computed;
      }
    }
  }

  if (!resolvedColor) {
    resolvedColor = '#2563EB';
  } else if (THEME_COLOR_PRESETS[resolvedColor.toLowerCase()]) {
    resolvedColor = THEME_COLOR_PRESETS[resolvedColor.toLowerCase()];
  }

  const { h, s, l } = hexToHsl(resolvedColor);

  // Calcula par de saturação e luminância para realismo 3D
  const sat = Math.max(70, Math.min(95, s));
  const baseL = Math.max(35, Math.min(65, l));

  // Ventosas luminosas: tom harmônico complementar sutil (shift de matiz)
  const suckerHue = (h + 30) % 360;
  const waveHue = (h - 20 + 360) % 360;

  return {
    bodyHighlight: hslToHex(h, sat, Math.min(88, baseL + 30)),
    bodyLight: hslToHex(h, sat, Math.min(75, baseL + 16)),
    bodyPrimary: resolvedColor,
    bodyDark: hslToHex(h, sat, Math.max(26, baseL - 14)),
    bodyDeep: hslToHex(h, sat, Math.max(14, baseL - 26)),
    backTentacles: hslToHex(h, sat, Math.max(18, baseL - 20)),
    suckerLight: hslToHex(suckerHue, 90, 85),
    suckerMid: hslToHex(suckerHue, 88, 60),
    suckerDark: hslToHex(suckerHue, 85, 40),
    waveLight: hslToHex(waveHue, 90, 70),
    waveDark: hslToHex(h, sat, 60),
    glowAura: `hsla(${h}, ${sat}%, ${baseL}%, 0.45)`,
    eyebrows: hslToHex(h, sat, Math.max(12, baseL - 32)),
    textVoz: resolvedColor,
    badgeBg: `hsla(${h}, ${sat}%, ${baseL}%, 0.2)`,
    badgeBorder: `hsla(${h}, ${sat}%, ${Math.min(75, baseL + 15)}%, 0.35)`,
    badgeText: hslToHex(h, 85, 80)
  };
}

/**
 * Mascote Oficial do VozPlay:
 * Polvo 3D estilizado segurando microfone de karaokê vintage com ondas sonoras.
 * Totalmente personalizável por cor de tema e modo de iluminação.
 */
export const VozPlayMascotIcon: React.FC<VozPlayMascotIconProps> = ({
  size = 48,
  className = '',
  animated = false,
  themeColor,
  themeMode = 'dark',
  colorMode = 'adaptive',
  showWaves = true,
  showShadow = true,
  variant = 'standard'
}) => {
  const rawId = useId();
  // Sanitiza o ID gerado pelo React para evitar caracteres inválidos em seletores SVG
  const uid = useMemo(() => `vp-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawId]);

  // Calcula as cores do tema
  const palette = useMemo(() => {
    return computeMascotPalette(themeColor, colorMode);
  }, [themeColor, colorMode]);

  // Ajustes de contraste para tema claro
  const isLight = themeMode === 'light';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animated ? 'animate-bounce-subtle' : ''} ${className} flex-shrink-0 select-none`}
      style={{ overflow: 'visible' }}
      aria-label="Mascote VozPlay - Polvo Cantor 3D"
      role="img"
    >
      <defs>
        {/* Gradiente do Corpo do Polvo (3D Glossy) */}
        <radialGradient id={`${uid}-octoBody`} cx="40%" cy="30%" r="70%" fx="35%" fy="25%">
          <stop offset="0%" stopColor={palette.bodyLight} />
          <stop offset="25%" stopColor={palette.bodyPrimary} />
          <stop offset="70%" stopColor={palette.bodyDark} />
          <stop offset="100%" stopColor={palette.bodyDeep} />
        </radialGradient>

        {/* Brilho Especular Superior da Cabeça */}
        <linearGradient id={`${uid}-headGloss`} x1="0%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={isLight ? 0.9 : 0.8} />
          <stop offset="40%" stopColor={palette.bodyHighlight} stopOpacity={0.4} />
          <stop offset="100%" stopColor={palette.bodyPrimary} stopOpacity="0" />
        </linearGradient>

        {/* Gradiente das Ventosas */}
        <radialGradient id={`${uid}-suckerGlow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.suckerLight} />
          <stop offset="60%" stopColor={palette.suckerMid} />
          <stop offset="100%" stopColor={palette.suckerDark} />
        </radialGradient>

        {/* Gradiente Metálico do Microfone Vintage Chrome */}
        <linearGradient id={`${uid}-micMetal`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="25%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="75%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Suporte do Microfone */}
        <linearGradient id={`${uid}-micBody`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Gradiente das Ondas Sonoras */}
        <linearGradient id={`${uid}-waveGrad`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.waveLight} />
          <stop offset="100%" stopColor={palette.waveDark} />
        </linearGradient>

        {/* Sombra Suave inferior ajustada ao tema */}
        {showShadow && (
          <filter id={`${uid}-softShadow`} x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow
              dx="0"
              dy={isLight ? '5' : '6'}
              stdDeviation={isLight ? '4' : '6'}
              floodColor={isLight ? '#0F172A' : '#000000'}
              floodOpacity={isLight ? 0.3 : 0.45}
            />
          </filter>
        )}
      </defs>

      <g filter={showShadow ? `url(#${uid}-softShadow)` : undefined}>
        {/* ONDAS SONORAS (Saída cantada no canto superior direito) */}
        {showWaves && (
          <g className={animated ? 'animate-pulse' : ''}>
            {/* Onda Menor */}
            <path
              d="M 125 35 C 135 25 148 23 158 31"
              stroke={`url(#${uid}-waveGrad)`}
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
            />
            {/* Onda Maior */}
            <path
              d="M 135 18 C 152 7 172 10 184 24"
              stroke={`url(#${uid}-waveGrad)`}
              strokeWidth="7"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {/* TENTÁCULOS POSTERIORES (Profundidade & Camadas) */}
        <path
          d="M 46 115 C 30 110 15 125 22 140 C 28 152 48 145 56 132"
          fill={palette.backTentacles}
        />
        <path
          d="M 140 120 C 155 120 168 132 162 148 C 156 158 138 152 132 138"
          fill={palette.backTentacles}
        />

        {/* TENTÁCULOS ANTERIORES */}
        {/* Tentáculo 1 - Extremo Esquerdo */}
        <path
          d="M 60 118 C 40 115 20 128 25 148 C 29 164 54 162 65 142 C 68 135 70 126 65 120 Z"
          fill={`url(#${uid}-octoBody)`}
        />
        <circle cx="32" cy="142" r="4.5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="44" cy="153" r="5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="56" cy="148" r="4.5" fill={`url(#${uid}-suckerGlow)`} />

        {/* Tentáculo 2 - Inferior Esquerdo */}
        <path
          d="M 70 128 C 55 142 45 160 62 172 C 78 178 95 162 88 142 Z"
          fill={`url(#${uid}-octoBody)`}
        />
        <circle cx="58" cy="162" r="5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="70" cy="168" r="5.5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="83" cy="162" r="5" fill={`url(#${uid}-suckerGlow)`} />

        {/* Tentáculo 3 - Inferior Direito */}
        <path
          d="M 112 128 C 127 142 137 160 120 172 C 104 178 88 162 94 142 Z"
          fill={`url(#${uid}-octoBody)`}
        />
        <circle cx="124" cy="162" r="5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="112" cy="168" r="5.5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="99" cy="162" r="5" fill={`url(#${uid}-suckerGlow)`} />

        {/* Tentáculo 4 - Direito (Apoio ao Microfone) */}
        <path
          d="M 125 118 C 138 116 150 125 152 138 C 153 148 144 154 135 150 C 126 145 124 132 122 122 Z"
          fill={`url(#${uid}-octoBody)`}
        />
        <circle cx="145" cy="132" r="4.5" fill={`url(#${uid}-suckerGlow)`} />
        <circle cx="146" cy="144" r="4" fill={`url(#${uid}-suckerGlow)`} />

        {/* CABEÇA PRINCIPAL DO POLVO */}
        <ellipse cx="96" cy="85" rx="58" ry="56" fill={`url(#${uid}-octoBody)`} />

        {/* Brilho 3D Superior Esquerdo */}
        <ellipse cx="78" cy="54" rx="34" ry="24" fill={`url(#${uid}-headGloss)`} transform="rotate(-15 78 54)" />
        <circle cx="68" cy="46" r="8" fill="#FFFFFF" opacity={isLight ? 0.75 : 0.6} />

        {/* OLHOS GRANDES EXPRESSIVOS 3D */}
        {/* Olho Esquerdo */}
        <ellipse cx="76" cy="88" rx="15" ry="19" fill="#0A0F1D" />
        <circle cx="72" cy="82" r="6.5" fill="#FFFFFF" />
        <circle cx="81" cy="94" r="2.5" fill="#FFFFFF" />
        <ellipse cx="76" cy="88" rx="14" ry="18" fill="none" stroke={palette.bodyLight} strokeWidth="1.5" opacity="0.45" />

        {/* Olho Direito */}
        <ellipse cx="116" cy="88" rx="15" ry="19" fill="#0A0F1D" />
        <circle cx="112" cy="82" r="6.5" fill="#FFFFFF" />
        <circle cx="121" cy="94" r="2.5" fill="#FFFFFF" />
        <ellipse cx="116" cy="88" rx="14" ry="18" fill="none" stroke={palette.bodyLight} strokeWidth="1.5" opacity="0.45" />

        {/* Sobrancelhas */}
        <path d="M 68 66 C 72 62 82 63 85 66" stroke={palette.eyebrows} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M 108 66 C 111 62 121 63 124 66" stroke={palette.eyebrows} strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* BOCA CANTORA FELIZ */}
        <path
          d="M 88 108 C 88 108 96 117 104 108 C 105 116 97 122 96 122 C 95 122 87 116 88 108 Z"
          fill="#831843"
        />
        {/* Língua */}
        <path
          d="M 91 116 C 94 113 98 113 101 116 C 99 120 93 120 91 116 Z"
          fill="#F472B6"
        />

        {/* Mãozinha Frontal Segurando a Haste do Microfone */}
        <g transform="translate(136, 92)">
          <path
            d="M -10 18 C 0 10 16 15 16 28 C 16 38 -2 38 -8 24 Z"
            fill={`url(#${uid}-octoBody)`}
          />
          <circle cx="10" cy="24" r="4.5" fill={`url(#${uid}-suckerGlow)`} />
        </g>

        {/* MICROFONE VINTAGE 3D (Cápsula Chrome Prateada Estilo Anos 50) */}
        <g transform="translate(142, 60)">
          {/* Suporte em U escuro metálico */}
          <path
            d="M -5 32 C -8 44 26 44 23 32"
            fill="none"
            stroke={`url(#${uid}-micBody)`}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line x1="9" y1="40" x2="9" y2="52" stroke={`url(#${uid}-micBody)`} strokeWidth="4.5" strokeLinecap="round" />

          {/* Cabeça do Microfone */}
          <rect x="-2" y="2" width="22" height="34" rx="11" fill={`url(#${uid}-micMetal)`} stroke="#334155" strokeWidth="1.5" />

          {/* Grades Horizontais do Microfone */}
          <line x1="0" y1="8" x2="18" y2="8" stroke="#1E293B" strokeWidth="1.8" />
          <line x1="-1" y1="13" x2="19" y2="13" stroke="#1E293B" strokeWidth="1.8" />
          <line x1="-2" y1="18" x2="20" y2="18" stroke="#1E293B" strokeWidth="2.2" />
          <line x1="-1" y1="23" x2="19" y2="23" stroke="#1E293B" strokeWidth="1.8" />
          <line x1="0" y1="28" x2="18" y2="28" stroke="#1E293B" strokeWidth="1.8" />

          {/* Faixa divisória central */}
          <line x1="9" y1="4" x2="9" y2="34" stroke="#0F172A" strokeWidth="1.5" />

          {/* Brilho no Microfone */}
          <rect x="2" y="5" width="4" height="26" rx="2" fill="#FFFFFF" opacity="0.65" />
        </g>
      </g>
    </svg>
  );
};

/**
 * Logotipo Completo VozPlay:
 * Combina o mascote cantor 3D com a tipografia oficial 'VozPlay' e opções de customização.
 */
export const VozPlayLogo: React.FC<VozPlayLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  animated = false,
  themeColor,
  themeMode = 'dark',
  colorMode = 'adaptive',
  textColor = 'default',
  showBadge = true,
  badgeText = 'PRO',
  sublabel = 'vozplay.ai.slz.br',
  onClick
}) => {
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const palette = useMemo(() => computeMascotPalette(themeColor, colorMode), [themeColor, colorMode]);
  const isLight = themeMode === 'light';

  // Cor do texto "Play"
  const playColorClass = useMemo(() => {
    if (textColor === 'light') return 'text-white';
    if (textColor === 'dark') return 'text-slate-900';
    if (textColor === 'contrast') return isLight ? 'text-slate-950 font-black' : 'text-white';
    return isLight ? 'text-slate-900' : 'text-slate-100';
  }, [textColor, isLight]);

  // VARIANTE: Apenas o Mascote
  if (variant === 'mascot-only') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''} ${className}`}
      >
        <VozPlayMascotIcon
          size={sizeConfig.mascot}
          animated={animated}
          themeColor={themeColor}
          themeMode={themeMode}
          colorMode={colorMode}
        />
      </div>
    );
  }

  // VARIANTE: Favicon / Ícone de App
  if (variant === 'favicon') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center p-2 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0B1120] to-[#060811] border border-white/10 shadow-xl relative group overflow-hidden ${className}`}
        style={{ width: sizeConfig.mascot + 16, height: sizeConfig.mascot + 16 }}
      >
        {/* Glow dinâmico de fundo */}
        <div
          className="absolute inset-0 rounded-2xl blur-md opacity-40 group-hover:opacity-70 transition duration-300 pointer-events-none"
          style={{ backgroundColor: palette.glowAura }}
        />
        <div className="relative">
          <VozPlayMascotIcon
            size={sizeConfig.mascot}
            animated={animated}
            themeColor={themeColor}
            themeMode={themeMode}
            colorMode={colorMode}
          />
        </div>
      </div>
    );
  }

  // VARIANTE: Apenas Texto
  if (variant === 'text-only') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center select-none font-display font-black tracking-tight ${sizeConfig.text} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <span
          style={{ color: palette.textVoz }}
          className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-colors"
        >
          Voz
        </span>
        <span className={`${playColorClass} transition-colors`}>
          Play
        </span>
      </div>
    );
  }

  // VARIANTE: Badge / Chip
  if (variant === 'badge') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl ${
          isLight
            ? 'bg-slate-900/[0.04] border border-slate-900/10 shadow-sm'
            : 'bg-white/[0.06] backdrop-blur-md border border-white/15 shadow-xl'
        } select-none ${onClick ? 'cursor-pointer transition hover:bg-white/[0.1]' : ''} ${className}`}
      >
        <VozPlayMascotIcon
          size={Math.round(sizeConfig.mascot * 0.75)}
          animated={animated}
          themeColor={themeColor}
          themeMode={themeMode}
          colorMode={colorMode}
        />
        <div className="flex items-center font-display font-black tracking-tight leading-none">
          <span style={{ color: palette.textVoz }}>Voz</span>
          <span className={playColorClass}>Play</span>
        </div>
      </div>
    );
  }

  // VARIANTE: Vertical (Ideal para telas de boas-vindas, login, telão de descanso)
  if (variant === 'vertical') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex flex-col items-center text-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="relative group mb-3">
          <div
            className="absolute -inset-2 rounded-full blur-xl opacity-60 group-hover:opacity-90 transition duration-300 pointer-events-none"
            style={{ backgroundColor: palette.glowAura }}
          />
          <div className="relative">
            <VozPlayMascotIcon
              size={sizeConfig.mascot * 1.25}
              animated={animated}
              themeColor={themeColor}
              themeMode={themeMode}
              colorMode={colorMode}
            />
          </div>
        </div>

        <div className="flex items-center justify-center font-display font-black tracking-tight">
          <span
            style={{ color: palette.textVoz }}
            className={`${sizeConfig.text} drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-colors`}
          >
            Voz
          </span>
          <span className={`${sizeConfig.text} ${playColorClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors`}>
            Play
          </span>
          {showBadge && (
            <span
              className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
              style={{
                backgroundColor: palette.badgeBg,
                borderColor: palette.badgeBorder,
                color: palette.badgeText,
                borderWidth: 1
              }}
            >
              {badgeText}
            </span>
          )}
        </div>

        {sublabel && (
          <span
            className={`font-mono tracking-wider mt-1 truncate ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            } ${sizeConfig.subtext}`}
          >
            {sublabel}
          </span>
        )}
      </div>
    );
  }

  // VARIANTE: Compacta (Mascote + Tipografia sem sublabel longo)
  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center ${sizeConfig.gap} select-none ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.02]' : ''} ${className}`}
      >
        <div className="relative flex-shrink-0 group">
          <div
            className="absolute -inset-1 rounded-full blur-md opacity-60 group-hover:opacity-90 transition duration-300 pointer-events-none"
            style={{ backgroundColor: palette.glowAura }}
          />
          <div className="relative">
            <VozPlayMascotIcon
              size={sizeConfig.mascot}
              animated={animated}
              themeColor={themeColor}
              themeMode={themeMode}
              colorMode={colorMode}
            />
          </div>
        </div>

        <div className="flex items-baseline font-display font-black tracking-tight leading-none">
          <span
            style={{ color: palette.textVoz }}
            className={`${sizeConfig.text} drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-colors`}
          >
            Voz
          </span>
          <span className={`${sizeConfig.text} ${playColorClass} transition-colors`}>
            Play
          </span>
          {showBadge && (
            <span
              className="ml-1.5 px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
              style={{
                backgroundColor: palette.badgeBg,
                borderColor: palette.badgeBorder,
                color: palette.badgeText,
                borderWidth: 1
              }}
            >
              {badgeText}
            </span>
          )}
        </div>
      </div>
    );
  }

  // VARIANTE: 'full' (Padrão Completo)
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${sizeConfig.gap} select-none ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.02]' : ''} ${className}`}
    >
      {/* Mascote com Efeito Glow Dinâmico de Fundo */}
      <div className="relative flex-shrink-0 group">
        <div
          className="absolute -inset-1.5 rounded-full blur-lg opacity-70 group-hover:opacity-100 transition duration-300 pointer-events-none"
          style={{ backgroundColor: palette.glowAura }}
        />
        <div className="relative">
          <VozPlayMascotIcon
            size={sizeConfig.mascot}
            animated={animated}
            themeColor={themeColor}
            themeMode={themeMode}
            colorMode={colorMode}
          />
        </div>
      </div>

      {/* Tipografia 3D VozPlay */}
      <div className="flex flex-col justify-center leading-none min-w-0">
        <div className="flex items-baseline font-display font-black tracking-tight">
          <span
            style={{ color: palette.textVoz }}
            className={`${sizeConfig.text} drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-colors`}
          >
            Voz
          </span>
          <span
            className={`${sizeConfig.text} ${playColorClass} drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors`}
          >
            Play
          </span>
          {showBadge && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: palette.badgeBg,
                borderColor: palette.badgeBorder,
                color: palette.badgeText,
                borderWidth: 1
              }}
            >
              {badgeText}
            </span>
          )}
        </div>
        {sublabel && (
          <span
            className={`${sizeConfig.subtext} font-mono tracking-wider truncate mt-0.5 transition-colors ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};
