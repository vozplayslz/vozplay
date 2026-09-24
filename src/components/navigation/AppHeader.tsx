/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Clean Application Header
 */

import React from 'react';
import {
  Menu,
  Tv,
  HelpCircle,
  WifiOff,
  Disc3,
  Smartphone,
  Sliders,
  Shield,
  Globe,
  Sparkles
} from 'lucide-react';
import { ActiveTab, Session } from '../../types.js';
import { PWAInstallButton } from '../common/PWAInstallButton.js';
import { VozPlayMascotIcon } from '../common/VozPlayLogo.js';

interface AppHeaderProps {
  activeTab: ActiveTab;
  session: Session | null;
  wsConnected: boolean;
  tvConnected: boolean;
  onOpenMobileMenu: () => void;
  onOpenHelp: () => void;
}

const TAB_INFO: Record<ActiveTab, { label: string; sublabel: string; icon: React.ComponentType<{ className?: string }> }> = {
  PARTICIPANT: { label: 'Participante', sublabel: 'PWA Mobile • Catálogo & Tom', icon: Smartphone },
  CONTROLLER: { label: 'Controlador', sublabel: 'Mesa de Som • Áudio & Fila', icon: Sliders },
  SUPERVISOR: { label: 'Supervisor / Caixa', sublabel: 'Autoridade Máxima • Gestão', icon: Shield },
  TV: { label: 'TV Telão', sublabel: 'Lounge Display 10-foot 4K', icon: Tv },
  TRACKER: { label: 'Acompanhar Minha Vez', sublabel: 'Link Ao Vivo Sem Login', icon: Globe }
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  session,
  wsConnected,
  tvConnected,
  onOpenMobileMenu,
  onOpenHelp
}) => {
  const current = TAB_INFO[activeTab];
  const CurrentIcon = current.icon;

  return (
    <header className="sticky top-0 z-30 bg-[#080B15]/90 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-md">
      {/* Left: Mobile Drawer Trigger + Active View Context */}
      <div className="flex items-center gap-3">
        <button
          id="btn-open-sidebar-drawer"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 transition active:scale-95"
          aria-label="Abrir menu de navegação lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Mascot Brand Icon */}
        <div className="lg:hidden flex items-center flex-shrink-0">
          <VozPlayMascotIcon
            size={30}
            animated
            themeColor={session?.branding?.primaryColor}
            themeMode={session?.branding?.themeMode === 'LIGHT' ? 'light' : 'dark'}
          />
        </div>

        {/* Current Active Section Breadcrumb */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600/20 to-pink-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-sm">
            <CurrentIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-display font-black text-white leading-tight">
                {current.label}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.05] text-purple-300 border border-purple-500/20">
                {current.sublabel}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 leading-none sm:hidden mt-0.5">
              {current.sublabel}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Real-time Indicators & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
        {/* Session Code Chip */}
        {session && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#11172a] border border-white/10 text-slate-300 shadow-inner">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Sessão</span>
            <span className="font-mono font-black text-purple-300 text-xs tracking-wider">{session.code}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/80" />
          </div>
        )}

        {/* TV status */}
        <div
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
            tvConnected
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/50'
              : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
          }`}
          title={tvConnected ? 'Telão da TV online e conectado' : 'Aguardando abertura do telão'}
        >
          <Tv className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tvConnected ? 'TV Conectada' : 'TV Aguardando'}</span>
        </div>

        {/* WS Sync Live badge */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          {wsConnected ? (
            <span
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
              title="Sincronização em tempo real ativa (WebSockets)"
            >
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-indigo-400 rounded-full eq-bar-1" />
                <span className="w-0.5 bg-purple-400 rounded-full eq-bar-2" />
                <span className="w-0.5 bg-pink-400 rounded-full eq-bar-3" />
              </div>
              <span className="hidden md:inline font-bold text-[10px] tracking-wide">Sync Live</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25"
              title="Reconectando ao servidor..."
            >
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden md:inline font-medium text-[10px]">Reconectando</span>
            </span>
          )}
        </div>

        {/* PWA Install */}
        <PWAInstallButton />

        {/* Help button */}
        <button
          id="btn-header-help"
          onClick={onOpenHelp}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-bold bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 transition active:scale-95 shadow-sm"
          title="Abrir Central de Ajuda e Guias Operacionais"
        >
          <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden md:inline">Ajuda</span>
        </button>
      </div>
    </header>
  );
};
