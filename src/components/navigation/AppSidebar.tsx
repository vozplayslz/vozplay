/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Modular Application Sidebar Navigation
 */

import React from 'react';
import {
  Smartphone,
  Sliders,
  Shield,
  Tv,
  Globe,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Wifi,
  WifiOff,
  Sparkles,
  KeyRound,
  Download
} from 'lucide-react';
import { ActiveTab, Session } from '../../types.js';
import { usePWAInstall } from '../../hooks/usePWAInstall.js';
import { VozPlayLogo, VozPlayMascotIcon } from '../common/VozPlayLogo.js';

interface AppSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  session: Session | null;
  wsConnected: boolean;
  tvConnected: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenHelp: () => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  sublabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge?: string | null;
  badgeColor?: string;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  setActiveTab,
  session,
  wsConnected,
  tvConnected,
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
  onOpenHelp
}) => {
  const { isInstallable, install: installApp } = usePWAInstall();

  const navGroups: NavGroup[] = [
    {
      id: 'operation',
      title: 'Operação Principal',
      items: [
        {
          id: 'PARTICIPANT',
          label: 'Participante',
          sublabel: 'PWA Mobile',
          description: 'Catálogo, ajuste de tom & pedidos',
          icon: Smartphone,
          accentColor: 'indigo',
          badge: 'PWA',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
        },
        {
          id: 'CONTROLLER',
          label: 'Controlador',
          sublabel: 'Mesa de Som',
          description: 'Fila, áudio master & DJ soundboard',
          icon: Sliders,
          accentColor: 'purple',
          badge: 'Mesa',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        },
        {
          id: 'SUPERVISOR',
          label: 'Supervisor / Caixa',
          sublabel: 'Autoridade Geral',
          description: 'Horários, alertas & CRM de leads',
          icon: Shield,
          accentColor: 'amber',
          badge: 'Admin',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        }
      ]
    },
    {
      id: 'displays',
      title: 'Monitores & Telas',
      items: [
        {
          id: 'TV',
          label: 'TV Telão',
          sublabel: 'Lounge 10-foot',
          description: 'Letras sincronizadas & reações ao vivo',
          icon: Tv,
          accentColor: 'rose',
          badge: tvConnected ? 'Online' : 'Aguardando',
          badgeColor: tvConnected
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        },
        {
          id: 'TRACKER',
          label: 'Minha Vez',
          sublabel: 'Link Ao Vivo',
          description: 'Acompanhamento de fila sem login',
          icon: Globe,
          accentColor: 'emerald',
          badge: 'Ao Vivo',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        }
      ]
    }
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Header: Brand & Collapse Toggle */}
      <div className="p-3 sm:p-4 border-b border-white/[0.08]">
        <div className="flex items-center justify-between gap-2">
          <div
            onClick={() => handleSelectTab('PARTICIPANT')}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            {isCollapsed ? (
              <div className="relative flex-shrink-0" title="VozPlay - Karaokê">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 rounded-xl blur-sm opacity-70 group-hover:opacity-100 transition duration-300" />
                <div className="relative w-10 h-10 rounded-xl bg-[#0d1222] border border-white/20 flex items-center justify-center shadow-lg overflow-hidden">
                  <VozPlayMascotIcon
                    size={34}
                    animated
                    themeColor={session?.branding?.primaryColor}
                    themeMode={session?.branding?.themeMode === 'LIGHT' ? 'light' : 'dark'}
                    className="group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              </div>
            ) : (
              <VozPlayLogo
                size="sm"
                animated
                themeColor={session?.branding?.primaryColor}
                themeMode={session?.branding?.themeMode === 'LIGHT' ? 'light' : 'dark'}
              />
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="hidden lg:flex p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/10 transition active:scale-95 flex-shrink-0"
            title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Current Active Session Pill (if expanded) */}
        {!isCollapsed && session && (
          <div className="mt-3 p-2 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0 shadow-sm shadow-emerald-400/80" />
              <div className="truncate">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none truncate">
                  {session.branding?.businessName || session.establishmentName || 'Sessão Ativa'}
                </span>
                <span className="font-mono text-xs font-black text-purple-300 tracking-wider">
                  {session.code}
                </span>
              </div>
            </div>
            {session.branding?.logoUrl ? (
              <img
                src={session.branding.logoUrl}
                alt="Logo"
                className="w-6 h-6 object-contain rounded bg-black/40 p-0.5 border border-white/10 shrink-0"
              />
            ) : (
              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/[0.05] text-slate-300 border border-white/10 font-mono">
                SLZ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Middle Navigation Items with Categories */}
      <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-4 no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`sidebar-item-${item.id.toLowerCase()}`}
                    onClick={() => handleSelectTab(item.id)}
                    title={isCollapsed ? `${item.label} - ${item.sublabel}` : undefined}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-pink-600/80 text-white font-bold shadow-lg shadow-purple-900/30 ring-1 ring-white/20'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    {/* Active Accent Bar on left */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-white shadow-sm" />
                    )}

                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.04] text-slate-400 group-hover:text-purple-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {!isCollapsed && (
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold truncate leading-tight tracking-tight">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border leading-none ${
                                isActive
                                  ? 'bg-white/20 text-white border-white/30'
                                  : item.badgeColor || 'bg-white/10 text-slate-300 border-white/10'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] block truncate mt-0.5 ${
                            isActive ? 'text-purple-100/90' : 'text-slate-500'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Section: Shortcuts & Utilities */}
        <div className="pt-2 border-t border-white/[0.06] space-y-1">
          {!isCollapsed && (
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Recursos & Ajuda
            </div>
          )}

          {/* Central de Ajuda Button */}
          <button
            id="sidebar-btn-help"
            onClick={() => {
              onOpenHelp();
              setMobileOpen(false);
            }}
            title={isCollapsed ? 'Central de Ajuda & Tutoriais' : undefined}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all group ${
              isCollapsed ? 'justify-center px-2' : ''
            }`}
          >
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 group-hover:text-amber-400 text-slate-400 transition">
              <HelpCircle className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="text-left min-w-0">
                <span className="text-xs font-bold block leading-tight">Ajuda & Guias</span>
                <span className="text-[10px] text-slate-500 block">Tutoriais dos 5 perfis</span>
              </div>
            )}
          </button>

          {/* PWA Install Button (se disponível) */}
          {isInstallable && (
            <button
              onClick={() => {
                installApp();
                setMobileOpen(false);
              }}
              title={isCollapsed ? 'Instalar VozPlay App' : undefined}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all group ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-300">
                <Download className="w-4 h-4" />
              </div>
              {!isCollapsed && (
                <div className="text-left min-w-0">
                  <span className="text-xs font-bold block leading-tight">Instalar PWA</span>
                  <span className="text-[10px] text-purple-400/80 block">Acesso direto mobile</span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Footer Widget: Connectivity & Version */}
      <div className="p-3 border-t border-white/[0.08] bg-[#090c17]/60">
        {!isCollapsed ? (
          <div className="space-y-2">
            {/* Live Sync Status Pill */}
            <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-black/40 border border-white/[0.06]">
              <div className="flex items-center gap-2">
                {wsConnected ? (
                  <>
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-indigo-400 rounded-full eq-bar-1" />
                      <span className="w-0.5 bg-purple-400 rounded-full eq-bar-2" />
                      <span className="w-0.5 bg-pink-400 rounded-full eq-bar-3" />
                    </div>
                    <span className="text-slate-300 font-bold text-[10px]">Sync Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                    <span className="text-rose-400 font-medium text-[10px]">Reconectando</span>
                  </>
                )}
              </div>

              {/* TV Status Pill */}
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  tvConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {tvConnected ? 'TV OK' : 'TV Off'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
              <span>v1.2.0 Lounge</span>
              <span>SLZ • São Luís</span>
            </div>
          </div>
        ) : (
          /* Collapsed Icon Status */
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                wsConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80 animate-pulse' : 'bg-rose-400'
              }`}
              title={wsConnected ? 'WebSocket Sincronizado' : 'Reconectando'}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 h-screen sticky top-0 bg-[#080B15]/95 backdrop-blur-2xl border-r border-white/[0.08] shadow-2xl z-40 transition-all duration-300 ${
          isCollapsed ? 'w-18' : 'w-64 xl:w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay + Slide-over) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-[#080B15] border-r border-white/10 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
