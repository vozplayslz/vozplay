/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Módulo de Identidade Visual e Personalização por Estabelecimento
 * Painel Administrativo de Customização White-Label com Preview em Tempo Real e WCAG 2.1
 * Seções 1 a 31 do Requisito
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Palette,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Tv,
  Smartphone,
  Sliders,
  Sparkles,
  Music,
  QrCode,
  Eye,
  Trash2,
  RefreshCw,
  Info,
  ShieldCheck,
  Check
} from 'lucide-react';
import { apiFetch as fetch } from '../../utils/apiClient.js';
import { VozPlayMascotIcon, VozPlayLogo, LogoColorMode } from '../common/VozPlayLogo.js';
import { EstablishmentBrandingDTO, Session } from '../../types.js';
import {
  DEFAULT_BRANDING_DTO,
  getBrandingCssVariables,
  clientGetContrastRatio
} from '../../utils/brandingTokens.js';

interface SupervisorBrandingSectionProps {
  session: Session | null;
  onBrandingUpdated?: (branding: EstablishmentBrandingDTO) => void;
}

type PreviewTab = 'TV' | 'PARTICIPANT' | 'CONTROLLER';
type TVPreviewScreen = 'WAITING' | 'CALLING' | 'PLAYING';
type ParticipantPreviewScreen = 'ENTRY' | 'SINGER_MODE';

export const SupervisorBrandingSection: React.FC<SupervisorBrandingSectionProps> = ({
  session,
  onBrandingUpdated
}) => {
  // Estado do formulário de branding
  const [brandingForm, setBrandingForm] = useState<EstablishmentBrandingDTO>(() => {
    return session?.branding || DEFAULT_BRANDING_DTO;
  });

  const [initialBranding, setInitialBranding] = useState<EstablishmentBrandingDTO>(() => {
    return session?.branding || DEFAULT_BRANDING_DTO;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  // Tabs do Preview em Tempo Real
  const [previewTab, setPreviewTab] = useState<PreviewTab>('TV');
  const [tvScreen, setTvScreen] = useState<TVPreviewScreen>('WAITING');
  const [participantScreen, setParticipantScreen] = useState<ParticipantPreviewScreen>('ENTRY');

  // Estados para Preview Interativo da Logo & Favicon
  const [logoColorMode, setLogoColorMode] = useState<LogoColorMode>('adaptive');
  const [logoPreviewTheme, setLogoPreviewTheme] = useState<'dark' | 'light'>('dark');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega configurações do backend na montagem
  useEffect(() => {
    async function loadBranding() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/v1/establishment/branding');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.data) {
          setBrandingForm(data.data);
          setInitialBranding(data.data);
        }
      } catch (err) {
        console.error('Erro ao buscar branding:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBranding();
  }, []);

  // Monitora alterações do session via props/websocket
  useEffect(() => {
    if (session?.branding) {
      setInitialBranding(session.branding);
    }
  }, [session?.branding]);

  // Cálculo de Acessibilidade & Contraste WCAG 2.1 em Tempo Real
  const contrastAnalysis = useMemo(() => {
    const bg = brandingForm.backgroundColor || '#060811';
    const surface = brandingForm.surfaceColor || '#0E1322';
    const text = brandingForm.textColor || '#F8FAFC';
    const primary = brandingForm.primaryColor || '#7C3AED';

    const textOnBg = clientGetContrastRatio(bg, text);
    const textOnSurface = clientGetContrastRatio(surface, text);
    const primaryOnBg = clientGetContrastRatio(bg, primary);

    const issues: string[] = [];
    if (textOnBg < 4.5) {
      issues.push(`Contraste do texto no fundo (${textOnBg}:1) abaixo do mínimo recomendado (4.5:1).`);
    }
    if (textOnSurface < 4.0) {
      issues.push(`Contraste do texto em caixas e superfícies (${textOnSurface}:1) pode comprometer leitura.`);
    }

    return {
      textOnBg,
      textOnSurface,
      primaryOnBg,
      isCompliant: issues.length === 0,
      issues
    };
  }, [
    brandingForm.backgroundColor,
    brandingForm.surfaceColor,
    brandingForm.textColor,
    brandingForm.primaryColor
  ]);

  // Sugestão automática de contraste
  const handleAutoFixContrast = () => {
    // Se o fundo for escuro, coloca texto branco gelo; se claro, quase preto
    const bgLum = brandingForm.backgroundColor;
    const isDark = clientGetContrastRatio(bgLum, '#FFFFFF') > clientGetContrastRatio(bgLum, '#000000');
    const safeText = isDark ? '#F8FAFC' : '#0B0F1A';
    setBrandingForm(prev => ({
      ...prev,
      textColor: safeText
    }));
    setStatusMessage({
      type: 'info',
      text: `Contraste corrigido automaticamente para ${safeText} (Taxa WCAG AA garantida).`
    });
  };

  // Upload seguro de Logo (PNG, JPEG, WebP, SVG)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações client-side
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setStatusMessage({
        type: 'error',
        text: 'Formato inválido. Aceitamos PNG, JPEG, WebP ou SVG sanitizado.'
      });
      return;
    }

    if (file.size > 2.5 * 1024 * 1024) {
      setStatusMessage({
        type: 'error',
        text: 'A imagem deve ter no máximo 2.5MB.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setBrandingForm(prev => ({ ...prev, logoUrl: dataUri }));
      setStatusMessage({
        type: 'info',
        text: 'Logo carregada na pré-visualização! Lembre-se de clicar em "Salvar Identidade Visual".'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setBrandingForm(prev => ({ ...prev, logoUrl: '' }));
    setStatusMessage({
      type: 'info',
      text: 'Logo removida. A marca padrão oficial do VozPlay será exibida.'
    });
  };

  // Salvar no backend
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setStatusMessage(null);

      const res = await fetch('/api/v1/establishment/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandingForm)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setInitialBranding(data.data);
        setStatusMessage({
          type: 'success',
          text: 'Identidade visual do estabelecimento salva e propagada em tempo real para TV, celular e mesa!'
        });
        if (onBrandingUpdated) {
          onBrandingUpdated(data.data);
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || 'Falha ao salvar configurações de identidade visual.'
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Erro de conexão ao salvar identidade visual.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Restaurar padrão
  const handleResetToDefault = async () => {
    try {
      setIsSaving(true);
      setShowResetModal(false);

      const res = await fetch('/api/v1/establishment/branding/reset', {
        method: 'POST'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setBrandingForm(data.data);
        setInitialBranding(data.data);
        setStatusMessage({
          type: 'success',
          text: 'Identidade visual restaurada para os padrões oficiais do VozPlay.'
        });
        if (onBrandingUpdated) {
          onBrandingUpdated(data.data);
        }
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Falha ao restaurar configurações padrão.'
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Erro ao comunicar com o servidor.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // CSS Variables aplicadas exclusivamente ao container de preview
  const previewCssVariables = useMemo(() => {
    return getBrandingCssVariables(brandingForm);
  }, [brandingForm]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Cabeçalho da Seção */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-purple-500/20 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-purple-950/40">
              <Palette className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                  Identidade Visual & White-Label
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Por Estabelecimento
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
                Personalize a marca, cores institucionais, slogan e logotipo do estabelecimento. 
                Todas as sessões ativas herdam este design instantaneamente na TV, no celular dos clientes e na mesa de som.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={() => setShowResetModal(true)}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition-all flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Restaurar Padrão
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Identidade
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {statusMessage && (
          <div
            className={`mt-6 p-4 rounded-xl text-sm flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              ) : (
                <Info className="w-5 h-5 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider ml-4 cursor-pointer font-bold"
            >
              Dispensar
            </button>
          </div>
        )}
      </div>

      {/* Grid Principal: Formulário à Esquerda e Preview em Tempo Real à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================================================ */}
        {/* COLUNA ESQUERDA: CONFIGURAÇÕES VISUAIS (5 Colunas)           */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Marca & Logo */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Marca & Logotipo
            </h3>

            {/* Upload de Logo */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Logotipo da Casa (PNG, JPEG, WebP ou SVG Seguro)
              </label>
              
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {brandingForm.logoUrl ? (
                    <img
                      src={brandingForm.logoUrl}
                      alt="Logo do Estabelecimento"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-1">
                      <VozPlayMascotIcon
                        size={38}
                        animated
                        themeColor={brandingForm.primaryColor}
                        colorMode={logoColorMode}
                        themeMode={brandingForm.themeMode === 'LIGHT' ? 'light' : 'dark'}
                      />
                      <span className="text-[9px] font-bold mt-0.5 text-blue-400">Oficial</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Enviar Logo
                    </button>
                    {brandingForm.logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Dimensão recomendada: 400x120px ou ícone quadrado. Máx. 2.5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* 1.1 Customização da Logo VozPlay & Favicon */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Logo & Favicon da Marca
                </label>
                <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setLogoColorMode('adaptive')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      logoColorMode === 'adaptive'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="O mascote e o texto 'Voz' assumem a cor primária da casa"
                  >
                    Tom da Casa
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoColorMode('official')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                      logoColorMode === 'official'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mascote mantém o Azul Royal clássico oficial"
                  >
                    Azul Oficial
                  </button>
                </div>
              </div>

              {/* Box de Pré-visualização Dinâmica da Logo e Favicon */}
              <div
                className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                  logoPreviewTheme === 'light'
                    ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-inner'
                    : 'bg-[#090D18] border-slate-800 text-white shadow-lg'
                }`}
              >
                {/* Header do box com toggle dark/light de teste */}
                <div className="flex items-center justify-between text-[11px] pb-2 border-b border-white/10">
                  <span className={`font-semibold ${logoPreviewTheme === 'light' ? 'text-slate-700' : 'text-slate-400'}`}>
                    Preview em Tempo Real:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLogoPreviewTheme('dark')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                        logoPreviewTheme === 'dark' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Fundo Escuro
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPreviewTheme('light')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition ${
                        logoPreviewTheme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      Fundo Claro
                    </button>
                  </div>
                </div>

                {/* Linha 1: Logo Principal Completa */}
                <div className="flex items-center justify-between py-1">
                  <VozPlayLogo
                    size="sm"
                    animated
                    themeColor={brandingForm.primaryColor}
                    colorMode={logoColorMode}
                    themeMode={logoPreviewTheme}
                  />
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-slate-400">
                    Logo Oficial
                  </span>
                </div>

                {/* Linha 2: Simulação de Favicon na Aba do Navegador */}
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className={`text-[10px] font-semibold block ${logoPreviewTheme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    Favicon da Aba do Navegador (16px / 32px):
                  </span>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border max-w-xs ${
                    logoPreviewTheme === 'light'
                      ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                      : 'bg-slate-900 border-slate-700 text-slate-200'
                  }`}>
                    {/* Favicon Miniatura */}
                    <div className="relative flex-shrink-0">
                      <VozPlayMascotIcon
                        size={18}
                        themeColor={brandingForm.primaryColor}
                        colorMode={logoColorMode}
                        themeMode={logoPreviewTheme}
                        showShadow={false}
                      />
                    </div>
                    <span className="text-[11px] font-medium truncate flex-1">
                      {brandingForm.businessName || 'VozPlay'} - Karaokê
                    </span>
                    <span className="text-[9px] opacity-40">✕</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Nome Comercial */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Nome do Estabelecimento
                </label>
                <span className="text-[11px] text-slate-500">
                  {brandingForm.businessName.length}/100
                </span>
              </div>
              <input
                type="text"
                value={brandingForm.businessName}
                maxLength={100}
                onChange={e => setBrandingForm(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Ex: Bar do João / Lounge Vip"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Slogan */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Slogan Institucional
                </label>
                <span className="text-[11px] text-slate-500">
                  {(brandingForm.slogan || '').length}/160
                </span>
              </div>
              <input
                type="text"
                value={brandingForm.slogan || ''}
                maxLength={160}
                onChange={e => setBrandingForm(prev => ({ ...prev, slogan: e.target.value }))}
                placeholder="Ex: Aqui você é a estrela do palco!"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Exibido na TV em telas de espera, transições de pontuação e tela inicial do celular.
              </p>
            </div>
          </div>

          {/* 2. Cores Institucionais */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-pink-400" />
              Cores & Design Tokens
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Cor Principal */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor Principal
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.primaryColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.primaryColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Cor Secundária */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor Secundária
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.secondaryColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.secondaryColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Cor de Destaque */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor de Destaque
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.accentColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.accentColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, accentColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Cor de Fundo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor de Fundo
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.backgroundColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.backgroundColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Cor de Superfície */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Superfície / Painéis
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.surfaceColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, surfaceColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.surfaceColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, surfaceColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Cor do Texto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Cor de Texto
                </label>
                <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 rounded-xl p-2">
                  <input
                    type="color"
                    value={brandingForm.textColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={brandingForm.textColor}
                    onChange={e => setBrandingForm(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Painel de Auditoria de Acessibilidade WCAG 2.1 (Seção 8) */}
            <div className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
              contrastAnalysis.isCompliant
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/25 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Auditoria de Contraste WCAG 2.1 (AA)
                </span>
                <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-black/40">
                  Texto/Fundo: {contrastAnalysis.textOnBg}:1
                </span>
              </div>

              {contrastAnalysis.isCompliant ? (
                <p className="text-emerald-400/90 text-[11px] leading-relaxed">
                  Excelente! A combinação de cores possui contraste suficiente (&ge; 4.5:1), garantindo leitura nítida das letras e títulos em todos os ambientes.
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  <p className="text-amber-300 text-[11px] leading-relaxed">
                    Atenção: A cor do texto não possui contraste ideal com o fundo escolhido. Letras de músicas na TV e no celular podem ficar difíceis de ler.
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoFixContrast}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Aplicar Ajuste Automático de Contraste
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. Preferência de Temas */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Preferência de Tema
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(['DARK', 'LIGHT', 'AUTO'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBrandingForm(prev => ({ ...prev, themeMode: mode }))}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    brandingForm.themeMode === mode
                      ? 'bg-purple-600/30 border-purple-500 text-white shadow-sm shadow-purple-950'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {mode === 'DARK' ? 'Escuro' : mode === 'LIGHT' ? 'Claro' : 'Automático'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              * Nota: A interface da TV sempre manterá fundo escuro profundo de alto contraste para visibilidade adequada em ambientes de festa e baixa iluminação.
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUNA DIREITA: PREVIEW EM TEMPO REAL MULTIDISPOSITIVO       */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-4 sticky top-6">
          
          {/* Seletor de Dispositivo para Pré-visualização */}
          <div className="glass-panel rounded-2xl p-3 border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewTab('TV')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  previewTab === 'TV'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                Telão TV
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('PARTICIPANT')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  previewTab === 'PARTICIPANT'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Participante (PWA)
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('CONTROLLER')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  previewTab === 'CONTROLLER'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Controlador (Mesa)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 pr-2">
              <Eye className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="hidden sm:inline">Ao Vivo</span>
            </div>
          </div>

          {/* Container do Mockup com CSS Variables Injetadas */}
          <div
            className="rounded-2xl border border-white/10 p-4 transition-all shadow-2xl overflow-hidden relative"
            style={{
              backgroundColor: brandingForm.backgroundColor || '#060811',
              color: brandingForm.textColor || '#F8FAFC',
              ...(previewCssVariables as any)
            }}
          >
            {/* SUB-TABS INTERNAS DO PREVIEW */}
            {previewTab === 'TV' && (
              <div className="space-y-4">
                {/* Toggles da TV */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold opacity-75">Cenário da TV:</span>
                    <button
                      type="button"
                      onClick={() => setTvScreen('WAITING')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        tvScreen === 'WAITING' ? 'bg-white/20 text-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Em Espera / Fila
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvScreen('CALLING')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        tvScreen === 'CALLING' ? 'bg-white/20 text-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      É a Sua Vez! (Chamada)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTvScreen('PLAYING')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        tvScreen === 'PLAYING' ? 'bg-white/20 text-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Karaokê & Letras
                    </button>
                  </div>

                  <span className="text-[10px] uppercase tracking-widest font-mono opacity-50">
                    Projetor 16:9
                  </span>
                </div>

                {/* VISUALIZAÇÃO TV: 1. ESPERA */}
                {tvScreen === 'WAITING' && (
                  <div className="aspect-video w-full rounded-xl p-6 flex flex-col justify-between border border-white/10 relative overflow-hidden"
                    style={{ backgroundColor: brandingForm.surfaceColor || '#0E1322' }}>
                    
                    {/* Header da TV */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {brandingForm.logoUrl ? (
                          <img src={brandingForm.logoUrl} alt="Logo" className="h-9 max-w-[130px] object-contain" />
                        ) : (
                          <div className="flex items-center gap-2 font-display font-bold text-lg">
                            <span style={{ color: brandingForm.primaryColor }}>VOZ</span>
                            <span style={{ color: brandingForm.secondaryColor }}>PLAY</span>
                          </div>
                        )}
                        <span className="text-xs opacity-75 border-l border-white/20 pl-3 font-semibold">
                          {brandingForm.businessName}
                        </span>
                      </div>

                      <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10 border border-white/15">
                        SESSÃO: {session?.code || 'SLZ-704'}
                      </div>
                    </div>

                    {/* Centro: Destaque & Slogan */}
                    <div className="text-center space-y-3 my-auto">
                      <h4 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display">
                        PALCO ABERTO
                      </h4>
                      {brandingForm.slogan && (
                        <p className="text-sm sm:text-base font-medium opacity-90 max-w-md mx-auto"
                           style={{ color: brandingForm.accentColor }}>
                          "{brandingForm.slogan}"
                        </p>
                      )}
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-lg"
                        style={{ backgroundColor: brandingForm.primaryColor, color: '#FFFFFF' }}>
                        <Music className="w-4 h-4" />
                        Próximo Cantor: João Silva (Evidências)
                      </div>
                    </div>

                    {/* Rodapé da TV */}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="flex items-center gap-2 text-[11px] opacity-75">
                        <QrCode className="w-4 h-4" />
                        <span>Aponte a câmera e peça sua música pelo celular</span>
                      </div>
                      <div className="text-[11px] font-bold" style={{ color: brandingForm.secondaryColor }}>
                        {brandingForm.businessName}
                      </div>
                    </div>
                  </div>
                )}

                {/* VISUALIZAÇÃO TV: 2. CHAMADA (É A SUA VEZ!) */}
                {tvScreen === 'CALLING' && (
                  <div className="aspect-video w-full rounded-xl p-6 flex flex-col justify-between border border-white/10 relative overflow-hidden text-center"
                    style={{ backgroundColor: brandingForm.surfaceColor || '#0E1322' }}>
                    
                    {/* Topo Discreto */}
                    <div className="flex items-center justify-center gap-2 opacity-80 text-xs">
                      {brandingForm.logoUrl ? (
                        <img src={brandingForm.logoUrl} alt="Logo" className="h-6 max-w-[90px] object-contain" />
                      ) : (
                        <span className="font-bold text-xs" style={{ color: brandingForm.primaryColor }}>{brandingForm.businessName}</span>
                      )}
                    </div>

                    {/* Holofote Central */}
                    <div className="space-y-2 my-auto">
                      <div className="text-xs uppercase tracking-widest font-black" style={{ color: brandingForm.secondaryColor }}>
                        ATENÇÃO AO PALCO
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-black font-display tracking-tight">
                        É A SUA VEZ!
                      </h3>
                      <div className="text-xl sm:text-2xl font-bold py-1" style={{ color: brandingForm.accentColor }}>
                        MARIA FERNANDES
                      </div>
                      <p className="text-xs opacity-80">
                        Cheia de Manias — Raça Negra (Karaokê Oficial)
                      </p>
                      <div className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/10">
                        Tempo de subida: 24s
                      </div>
                    </div>

                    {/* Rodapé com Slogan Discreto */}
                    <div className="text-[11px] opacity-70">
                      {brandingForm.slogan || 'Aqui você é a estrela!'}
                    </div>
                  </div>
                )}

                {/* VISUALIZAÇÃO TV: 3. LETRAS & KARAOKÊ */}
                {tvScreen === 'PLAYING' && (
                  <div className="aspect-video w-full rounded-xl p-6 flex flex-col justify-between border border-white/10 relative overflow-hidden"
                    style={{ backgroundColor: brandingForm.surfaceColor || '#0E1322' }}>
                    
                    {/* Topo da Apresentação */}
                    <div className="flex items-center justify-between text-xs opacity-80">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: brandingForm.accentColor }} />
                        <span className="font-bold">No Palco: Carlos Eduardo</span>
                      </div>
                      <span className="font-medium text-[11px] opacity-75">{brandingForm.businessName}</span>
                    </div>

                    {/* Letras com Máxima Legibilidade (Seção 15 e 17) */}
                    <div className="text-center space-y-2 my-auto">
                      <p className="text-sm opacity-60">E nessa loucura de dizer que não te quero</p>
                      <p className="text-xl sm:text-2xl font-extrabold tracking-wide" style={{ color: brandingForm.accentColor }}>
                        VOU NEGANDO AS APARÊNCIAS, DISFARÇANDO AS EVIDÊNCIAS
                      </p>
                      <p className="text-sm opacity-60">Mas pra que viver fingindo se eu não posso me enganar?</p>
                    </div>

                    {/* Barra de Progresso com Cor Primária */}
                    <div>
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: brandingForm.primaryColor }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PREVIEW DO PARTICIPANTE (SMARTPHONE PWA) */}
            {previewTab === 'PARTICIPANT' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold opacity-75">Tela Mobile:</span>
                    <button
                      type="button"
                      onClick={() => setParticipantScreen('ENTRY')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        participantScreen === 'ENTRY' ? 'bg-white/20 text-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Entrada via QR (Login)
                    </button>
                    <button
                      type="button"
                      onClick={() => setParticipantScreen('SINGER_MODE')}
                      className={`text-[11px] px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                        participantScreen === 'SINGER_MODE' ? 'bg-white/20 text-white' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      Modo Cantor (Letras)
                    </button>
                  </div>
                  <span className="text-[10px] uppercase font-mono opacity-50">Smartphone 390px</span>
                </div>

                {/* Mockup Celular */}
                <div className="max-w-[320px] mx-auto rounded-3xl p-5 border-2 border-white/15 shadow-xl relative"
                  style={{ backgroundColor: brandingForm.surfaceColor || '#0E1322' }}>
                  
                  {participantScreen === 'ENTRY' && (
                    <div className="space-y-4 text-center py-3">
                      {/* Logo ou fallback */}
                      <div className="flex justify-center">
                        {brandingForm.logoUrl ? (
                          <img src={brandingForm.logoUrl} alt="Logo" className="h-10 max-w-[140px] object-contain" />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: brandingForm.primaryColor }}>
                            VP
                          </div>
                        )}
                      </div>

                      <div>
                        <h5 className="font-bold text-base font-display">{brandingForm.businessName}</h5>
                        {brandingForm.slogan && (
                          <p className="text-[11px] opacity-75 mt-0.5" style={{ color: brandingForm.accentColor }}>
                            {brandingForm.slogan}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5 text-left pt-2">
                        <div>
                          <label className="text-[10px] uppercase font-bold opacity-70">Seu Nome</label>
                          <div className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs opacity-75">
                            João Silva
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold opacity-70">Código de Presença</label>
                          <div className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs font-mono font-bold tracking-widest text-center"
                            style={{ color: brandingForm.accentColor }}>
                            7 8 2 1
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full py-2.5 rounded-xl font-bold text-xs shadow-md mt-2"
                          style={{ backgroundColor: brandingForm.primaryColor, color: '#FFFFFF' }}
                        >
                          ENTRAR NO KARAOKÊ
                        </button>
                      </div>
                    </div>
                  )}

                  {participantScreen === 'SINGER_MODE' && (
                    <div className="space-y-3 py-2">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-[10px] font-bold" style={{ color: brandingForm.accentColor }}>
                          MODO CANTOR AO VIVO
                        </span>
                        <span className="text-[10px] opacity-60">{brandingForm.businessName}</span>
                      </div>

                      <div className="text-center py-2 space-y-1">
                        <h6 className="text-xs font-bold">Evidências</h6>
                        <p className="text-[10px] opacity-60">Chitãozinho & Xororó</p>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 text-center space-y-2">
                        <p className="text-[11px] opacity-50">Quando eu digo que deixei de te amar</p>
                        <p className="text-xs font-bold" style={{ color: brandingForm.accentColor }}>
                          É PORQUE EU TE AMO!
                        </p>
                        <p className="text-[11px] opacity-50">Quando eu digo que não quero mais você...</p>
                      </div>

                      <div className="text-[10px] text-center opacity-60">
                        Letra oficial autorizada VozPlay
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PREVIEW DO CONTROLADOR (MESA DE SOM) */}
            {previewTab === 'CONTROLLER' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Mesa de Controle & Soundboard</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-white/10">
                      Operador: Carlos
                    </span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: brandingForm.secondaryColor }}>
                    {brandingForm.businessName}
                  </span>
                </div>

                <div className="p-4 rounded-xl space-y-3 border border-white/10"
                  style={{ backgroundColor: brandingForm.surfaceColor || '#0E1322' }}>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase opacity-60">Música em Execução</span>
                      <h6 className="text-sm font-bold">Evidências — Chitãozinho & Xororó</h6>
                      <p className="text-xs opacity-75">Cantor: João Silva (Mesa 04)</p>
                    </div>

                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: brandingForm.primaryColor, color: '#FFFFFF' }}>
                      TOCANDO
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {['Palmas', 'Vinheta', 'Airhorn', 'Arerê'].map((sound, i) => (
                      <div
                        key={sound}
                        className="p-2 rounded-lg text-center text-[10px] font-bold border border-white/10 bg-black/20"
                      >
                        <span className="opacity-50 font-mono block text-[9px]">[{i + 1}]</span>
                        {sound}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="text-xs text-slate-500 flex items-center justify-between px-2">
            <span>* O preview renderiza em tempo real a cada alteração de campo ou cor.</span>
            <span className="text-purple-400 font-medium">Isolamento Seguro Garantido</span>
          </div>

        </div>

      </div>

      {/* MODAL DE CONFIRMAÇÃO PARA RESTAURAR PADRÃO (Seção 26) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e1322] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Restaurar Identidade Padrão?</h3>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                Essa ação removerá as customizações de cores, slogan e logo do estabelecimento, 
                retornando aos padrões oficiais do VozPlay. As sessões, participantes e fila não serão afetados.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-sm font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer"
              >
                Sim, Restaurar Padrão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
