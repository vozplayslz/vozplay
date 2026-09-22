/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Multi-Client Interface Switcher & Global Header
 */

import React from 'react';
import { Smartphone, Sliders, Shield, Tv, Wifi, WifiOff, Globe, Disc3 } from 'lucide-react';
import { PWAInstallButton } from './common/PWAInstallButton.js';
import { Session } from '../types.js';

export type ActiveTab = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV' | 'TRACKER';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  session: Session | null;
  wsConnected: boolean;
  tvConnected: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  session,
  wsConnected,
  tvConnected
}) => {
  const tabs = [
    {
      id: 'PARTICIPANT' as ActiveTab,
      label: 'Participante',
      sublabel: 'PWA Mobile',
      icon: Smartphone,
      accent: 'indigo'
    },
    {
      id: 'CONTROLLER' as ActiveTab,
      label: 'Controlador',
      sublabel: 'Operação Musical',
      icon: Sliders,
      accent: 'purple'
    },
    {
      id: 'SUPERVISOR' as ActiveTab,
      label: 'Supervisor / Caixa',
      sublabel: 'Autoridade Geral',
      icon: Shield,
      accent: 'amber'
    },
    {
      id: 'TV' as ActiveTab,
      label: 'TV Telão',
      sublabel: 'Telão 4K / Lounge',
      icon: Tv,
      accent: 'rose'
    },
    {
      id: 'TRACKER' as ActiveTab,
      label: 'Minha Vez',
      sublabel: 'Link Ao Vivo',
      icon: Globe,
      accent: 'emerald'
    }
  ];

  return (
    <header className="border-b border-white/[0.08] bg-[#080B15]/95 backdrop-blur-2xl sticky top-0 z-40 transition-all shadow-2xl shadow-black/60">
      {/* Top Banner with brand, domain, and status */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setActiveTab('PARTICIPANT')}>
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 rounded-2xl blur-md opacity-70 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative w-10 h-10 rounded-xl bg-[#0d1222] border border-white/20 flex items-center justify-center shadow-xl">
              <Disc3 className="w-5 h-5 text-pink-400 group-hover:rotate-180 transition-transform duration-700" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-white text-xl tracking-tight leading-none">
                VOZ<span className="bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-400 bg-clip-text text-transparent">PLAY</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider bg-gradient-to-r from-pink-500/15 to-purple-500/15 text-pink-300 border border-pink-500/30 uppercase">
                PRO LOUNGE
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              <span className="font-mono text-[11px] text-slate-300/80">vozplay.ai.slz.br</span>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-2.5 text-xs">
          {session && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#11172a] border border-white/10 text-slate-300 shadow-inner">
              <span className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">Sessão:</span>
              <span className="font-mono font-black text-purple-300 tracking-wider text-xs">{session.code}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse" />
            </div>
          )}

          {/* TV status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
            tvConnected
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/50'
              : 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
          }`}>
            <Tv className="w-3.5 h-3.5" />
            <span>{tvConnected ? 'TV Conectada' : 'TV Aguardando'}</span>
          </div>

          {/* WS sync with equalizer animation */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            {wsConnected ? (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25" title="Sincronização em tempo real ativa">
                <div className="flex items-end gap-0.5 h-3.5">
                  <span className="w-0.5 bg-indigo-400 rounded-full eq-bar-1" />
                  <span className="w-0.5 bg-purple-400 rounded-full eq-bar-2" />
                  <span className="w-0.5 bg-pink-400 rounded-full eq-bar-3" />
                  <span className="w-0.5 bg-indigo-400 rounded-full eq-bar-4" />
                </div>
                <span className="hidden md:inline font-bold text-[11px] tracking-wide">Sync Live</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25" title="Reconectando ao servidor...">
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden md:inline font-medium">Conectando</span>
              </span>
            )}
          </div>

          {/* PWA Install Action */}
          <PWAInstallButton />
        </div>
      </div>

      {/* Interface Selector Tabs */}
      <div className="bg-[#0b0e1b]/95 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 flex items-center justify-start sm:justify-center overflow-x-auto py-2 gap-1.5 sm:gap-2.5 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id.toLowerCase()}`}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-xl shadow-purple-600/35 ring-1 ring-white/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <div className="text-left leading-tight">
                  <div className="font-bold tracking-tight">{tab.label}</div>
                  <div className={`text-[10px] font-normal ${isActive ? 'text-purple-100' : 'text-slate-500'}`}>
                    {tab.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
