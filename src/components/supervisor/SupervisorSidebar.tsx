/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Modular Supervisor Sidebar Menu
 */

import React from 'react';
import {
  Shield,
  Activity,
  Clock,
  Music2,
  Users,
  Radio,
  QrCode,
  BarChart3,
  Wifi,
  FileText,
  AlertOctagon,
  X,
  Menu,
  ChevronRight
} from 'lucide-react';
import { Session } from '../../types.js';

export type SupervisorSectionId =
  | 'OVERVIEW'
  | 'ANALYTICS'
  | 'DEVICES'
  | 'TV_ALERT'
  | 'CONTROLLER'
  | 'QRCODE'
  | 'LEADS'
  | 'AUDIT';

export interface SupervisorMenuItem {
  id: SupervisorSectionId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
}

export interface SupervisorMenuSection {
  group: string;
  items: SupervisorMenuItem[];
}

export const SUPERVISOR_ITEMS_MAP: Record<SupervisorSectionId, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  OVERVIEW: { label: 'Sessão & Horários', description: 'Timer, prorrogações e status', icon: Clock },
  CONTROLLER: { label: 'Controladores', description: 'Operadores de som & presença', icon: Users },
  TV_ALERT: { label: 'Avisos no Telão', description: 'Transmissão urgente para a TV', icon: Radio },
  QRCODE: { label: 'QR Code da Mesa', description: 'Acesso instantâneo dos clientes', icon: QrCode },
  ANALYTICS: { label: 'Inteligência & Métricas', description: 'Gêneros, picos e ranking', icon: BarChart3 },
  DEVICES: { label: 'Dispositivos & Rede', description: 'TV, controles e celulares', icon: Wifi },
  LEADS: { label: 'Leads & Clientes', description: 'Base LGPD e exportação CSV', icon: Users },
  AUDIT: { label: 'Trilha de Auditoria', description: 'Log imutável de eventos', icon: FileText }
};

interface SupervisorSidebarProps {
  activeTab: SupervisorSectionId;
  setActiveTab: (tab: SupervisorSectionId) => void;
  session: Session | null;
  devicesCount: number;
  leadsCount: number;
  auditLogsCount: number;
  remainingTimeMinutes: number;
  onExtendSession: (minutes: number) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onOpenTakeover: () => void;
}

export const SupervisorSidebar: React.FC<SupervisorSidebarProps> = ({
  activeTab,
  setActiveTab,
  session,
  devicesCount,
  leadsCount,
  auditLogsCount,
  remainingTimeMinutes,
  onExtendSession,
  mobileOpen,
  setMobileOpen,
  onOpenTakeover
}) => {
  const menuSections: SupervisorMenuSection[] = [
    {
      group: 'OPERAÇÃO DA SALA',
      items: [
        {
          id: 'OVERVIEW',
          label: 'Sessão & Horários',
          description: 'Timer, prorrogações e status',
          icon: Clock,
          badge: null
        },
        {
          id: 'CONTROLLER',
          label: 'Controladores',
          description: 'Operadores de som & presença',
          icon: Users,
          badge: null
        },
        {
          id: 'TV_ALERT',
          label: 'Avisos no Telão',
          description: 'Transmissão urgente para a TV',
          icon: Radio,
          badge: null
        },
        {
          id: 'QRCODE',
          label: 'QR Code da Mesa',
          description: 'Acesso instantâneo dos clientes',
          icon: QrCode,
          badge: null
        }
      ]
    },
    {
      group: 'GESTÃO & INTELIGÊNCIA',
      items: [
        {
          id: 'ANALYTICS',
          label: 'Inteligência & Métricas',
          description: 'Gêneros, picos e ranking',
          icon: BarChart3,
          badge: null
        },
        {
          id: 'DEVICES',
          label: 'Dispositivos & Rede',
          description: 'TV, controles e celulares',
          icon: Wifi,
          badge: devicesCount > 0 ? String(devicesCount) : null
        },
        {
          id: 'LEADS',
          label: 'Leads & Clientes',
          description: 'Base LGPD e exportação CSV',
          icon: Users,
          badge: leadsCount > 0 ? String(leadsCount) : null
        },
        {
          id: 'AUDIT',
          label: 'Trilha de Auditoria',
          description: 'Log imutável de eventos',
          icon: FileText,
          badge: auditLogsCount > 0 ? String(auditLogsCount) : null
        }
      ]
    }
  ];

  const allMenuItems = menuSections.reduce<SupervisorMenuItem[]>((acc, s) => acc.concat(s.items), []);
  const currentItem = allMenuItems.find((item) => item.id === activeTab) || allMenuItems[0];

  const renderNavList = (isMobile = false) => (
    <div className="space-y-5">
      {menuSections.map((sec) => (
        <div key={sec.group} className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 block">
            {sec.group}
          </span>
          <div className="space-y-1">
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sup-nav-${item.id.toLowerCase()}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (isMobile) setMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition group ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-l-4 border-amber-400 text-white font-bold shadow-md shadow-amber-950/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                        isActive
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : 'bg-white/[0.04] text-slate-400 group-hover:text-slate-200 border border-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-xs block font-bold leading-tight">{item.label}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{item.description}</span>
                    </div>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 ml-2 flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar (< lg) */}
      <div className="lg:hidden flex items-center justify-between p-3.5 rounded-2xl bg-[#0a0e1c] border border-white/10 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 active:scale-95 transition"
            aria-label="Abrir menu lateral do supervisor"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <currentItem.icon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-display font-black text-white block leading-tight">{currentItem.label}</span>
              <span className="text-[10px] text-slate-400 leading-none">Supervisor / Caixa</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30">
            {session?.code || 'SLZ-704'}
          </span>
          <button
            onClick={onOpenTakeover}
            className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400 active:scale-95 transition"
            title="Assumir Controle Emergencial"
          >
            <AlertOctagon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-80 max-w-[85vw] h-full bg-[#0a0e1c] border-r border-white/10 p-5 overflow-y-auto flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-black text-white">VozPlay Supervisor</h3>
                    <p className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider">Autoridade Máxima</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavList(true)}
            </div>

            {/* Bottom Actions inside drawer */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  onOpenTakeover();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 active:scale-95 transition"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Assumir Controle Emergencial</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar Component */}
      <aside className="hidden lg:flex w-72 flex-shrink-0 flex-col justify-between rounded-3xl bg-[#0a0e1c] border border-white/10 p-4 shadow-2xl space-y-6 sticky top-20 ring-1 ring-white/5">
        <div className="space-y-6">
          {/* Identity & Session Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-[#131728] to-[#0c101d] border border-amber-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shadow-md shadow-amber-950/40">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-display font-black text-white leading-tight">VozPlay Supervisor</h3>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 inline-block mt-0.5">
                  Autoridade Máxima
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
              <div className="text-slate-400 text-[11px] truncate">
                {session?.establishmentName || 'VozPlay Lounge'}
              </div>
              <span className="font-mono font-bold text-amber-400 text-[11px]">
                {session?.code || 'SLZ-704'}
              </span>
            </div>
          </div>

          {/* Navigation Groups */}
          {renderNavList(false)}
        </div>

        {/* Sidebar Footer Widget */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          {/* Session Time Widget */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 font-bold text-[11px]">{remainingTimeMinutes}m restantes</span>
            </div>
            <button
              onClick={() => onExtendSession(15)}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-black transition active:scale-95"
            >
              +15m
            </button>
          </div>

          {/* Emergency Takeover Trigger */}
          <button
            onClick={onOpenTakeover}
            className="w-full py-3 px-3.5 rounded-2xl bg-gradient-to-r from-rose-600/90 to-red-600/90 hover:from-rose-600 hover:to-red-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 border border-rose-400/30 active:scale-95 transition"
            title="Revoga o operador atual e assume controle total"
          >
            <AlertOctagon className="w-4 h-4 flex-shrink-0" />
            <span>Assumir Controle</span>
          </button>
        </div>
      </aside>
    </>
  );
};
