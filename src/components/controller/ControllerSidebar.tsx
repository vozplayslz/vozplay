/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Modular Sound Operator Sidebar Menu
 */

import React from 'react';
import {
  Sliders,
  ListMusic,
  Volume2,
  Sparkles,
  KeyRound,
  PlusCircle,
  History,
  LayoutGrid,
  Radio,
  Tv,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { PlaybackStatus, Session } from '../../types.js';

export type ControllerSectionFilter =
  | 'ALL'
  | 'PRESENCE'
  | 'PLAYER'
  | 'QUEUE'
  | 'SOUNDBOARD'
  | 'ADD_MANUAL'
  | 'HISTORY';

interface ControllerSidebarProps {
  currentFilter: ControllerSectionFilter;
  onSelectFilter: (filter: ControllerSectionFilter) => void;
  queueLength: number;
  playbackStatus: PlaybackStatus;
  presenceRemainingSeconds: number;
  masterVolume: number;
  session: Session | null;
  tvConnected: boolean;
}

export const ControllerSidebar: React.FC<ControllerSidebarProps> = ({
  currentFilter,
  onSelectFilter,
  queueLength,
  playbackStatus,
  presenceRemainingSeconds,
  masterVolume,
  session,
  tvConnected
}) => {
  const sections = [
    {
      id: 'ALL' as ControllerSectionFilter,
      label: 'Visão Completa',
      description: 'Mesa integrada com todos os módulos',
      icon: LayoutGrid,
      badge: null
    },
    {
      id: 'PRESENCE' as ControllerSectionFilter,
      label: 'Código de Presença',
      description: 'PIN de 4 dígitos (60s)',
      icon: KeyRound,
      badge: `${presenceRemainingSeconds}s`,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      id: 'PLAYER' as ControllerSectionFilter,
      label: 'Player & Mixer',
      description: 'Play, pause, skip & volume',
      icon: Radio,
      badge: playbackStatus === 'PLAYING' ? 'No Ar' : playbackStatus === 'PAUSED' ? 'Pausa' : 'Livre',
      badgeColor: playbackStatus === 'PLAYING'
        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 animate-pulse'
        : 'bg-white/10 text-slate-300 border-white/10'
    },
    {
      id: 'QUEUE' as ControllerSectionFilter,
      label: 'Fila da Sessão',
      description: 'Ordem de apresentações & ausências',
      icon: ListMusic,
      badge: queueLength > 0 ? String(queueLength) : '0',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    {
      id: 'SOUNDBOARD' as ControllerSectionFilter,
      label: 'DJ Soundboard',
      description: 'Efeitos sonoros e vinhetas',
      icon: Sparkles,
      badge: '10 FX'
    },
    {
      id: 'ADD_MANUAL' as ControllerSectionFilter,
      label: 'Inclusão Manual',
      description: 'Adicionar pedido diretamente na mesa',
      icon: PlusCircle,
      badge: null
    },
    {
      id: 'HISTORY' as ControllerSectionFilter,
      label: 'Histórico Cantado',
      description: 'Músicas já executadas',
      icon: History,
      badge: null
    }
  ];

  return (
    <aside className="w-full lg:w-64 flex-shrink-0 space-y-4">
      {/* Operator Status Card */}
      <div className="p-4 rounded-2xl bg-[#0e1322]/95 border border-purple-500/20 shadow-xl space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/40 flex-shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-display font-black text-white leading-tight truncate">
              {session?.branding?.businessName || session?.establishmentName || 'VozPlay Lounge'}
            </h3>
            <span className="text-[10px] text-purple-300 font-semibold block truncate">
              Mesa de Som • {session?.activeControllerName || 'Operador'}
            </span>
          </div>
        </div>

        <div className="pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
          <span className="text-slate-400">TV Telão:</span>
          <span className={`font-bold flex items-center gap-1.5 ${tvConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span className={`w-2 h-2 rounded-full ${tvConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {tvConnected ? 'Sincronizada' : 'Offline'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Volume Master:</span>
          <span className="font-mono font-bold text-white flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-purple-400" />
            {masterVolume}%
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="rounded-2xl bg-[#0a0e1c] border border-white/10 p-2 sm:p-2.5 shadow-xl space-y-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2.5 py-1.5 block">
          Módulos da Mesa
        </span>

        <div className="space-y-1">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = currentFilter === sec.id;

            return (
              <button
                key={sec.id}
                id={`ctrl-nav-${sec.id.toLowerCase()}`}
                onClick={() => onSelectFilter(sec.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition group ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600/30 via-purple-600/15 to-transparent border-l-4 border-purple-400 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-white/[0.04] text-slate-400 group-hover:text-purple-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs block font-bold leading-tight">{sec.label}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{sec.description}</span>
                  </div>
                </div>

                {sec.badge && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ml-2 flex-shrink-0 ${
                      sec.badgeColor || 'bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
