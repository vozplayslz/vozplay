/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Interface do Supervisor / Caixa
 * Seções 6, 7, 29, 31, 42, 44, 49, 52 do PRD
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Clock,
  Plus,
  AlertTriangle,
  QrCode,
  Users,
  BarChart3,
  FileText,
  Bell,
  CheckCircle2,
  Tv,
  Power,
  RotateCcw,
  UserX,
  UserPlus,
  Download,
  AlertOctagon,
  TrendingUp,
  Music2,
  Radio,
  Wifi,
  Smartphone,
  Laptop,
  Cpu,
  Menu,
  X,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Session, SessionMetrics, AuditLog, SessionNotification, Lead } from '../../types.js';
import { SupervisorSidebar, SUPERVISOR_ITEMS_MAP, SupervisorSectionId } from './SupervisorSidebar.js';
import { SupervisorBrandingSection } from './SupervisorBrandingSection.js';

interface DeviceItem {
  deviceId: string;
  clientType: 'PWA' | 'ANDROID' | 'ANDROID_TV';
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV';
  platform: string;
  clientVersion: string;
  lastSeenAt: string;
}

interface SupervisorViewProps {
  session: Session | null;
  tvConnected: boolean;
  onSessionUpdated?: () => void;
  lastQueueEvent?: any;
}

export const SupervisorView: React.FC<SupervisorViewProps> = ({ session, tvConnected, onSessionUpdated, lastQueueEvent }) => {
  const [activeTab, setActiveTab] = useState<SupervisorSectionId>('OVERVIEW');
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<SessionNotification[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState<string>('');

  // Analytics State (Section 52 & 53)
  const [analytics, setAnalytics] = useState<{
    metrics: SessionMetrics;
    genrePopularity: { genre: string; count: number }[];
    topSongs: { title: string; artist: string; genre: string; playCount: number }[];
    averageWaitMinutes: number;
    peakHours: { hour: string; requests: number }[];
  } | null>(null);

  // TV Broadcast Alert State (Section 28 & 29)
  const [alertMessage, setAlertMessage] = useState('');
  const [alertLevel, setAlertLevel] = useState<'INFO' | 'WARNING' | 'ERROR'>('INFO');
  const [isBroadcasting, setIsBroadcasting] = useState(false);


  // Controller Authorization Form
  const [newControllerName, setNewControllerName] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Takeover confirmation state
  const [showTakeoverModal, setShowTakeoverModal] = useState(false);
  const [isTakingOver, setIsTakingOver] = useState(false);

  // Mobile Sidebar Drawer State
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSupervisorData();

    // Register Supervisor Device Handshake (PRD Seções 36 & 37)
    fetch('/api/v1/devices/handshake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'sup-desk-' + (typeof window !== 'undefined' ? window.location.hostname : 'manager'),
        clientType: 'PWA',
        role: 'SUPERVISOR',
        platform: 'Gerência / Caixa Dashboard',
        clientVersion: '1.2.0-sup'
      })
    }).catch(() => {});

    const interval = setInterval(fetchSupervisorData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (lastQueueEvent) {
      fetchSupervisorData();
    }
  }, [lastQueueEvent]);

  const safeFetchJson = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const fetchSupervisorData = async () => {
    try {
      const [metricsData, logsData, notifsData, leadsData, qrData, analyticsData, devicesData] = await Promise.all([
        safeFetchJson('/api/v1/metrics'),
        safeFetchJson('/api/v1/supervisor/audit-logs'),
        safeFetchJson('/api/v1/supervisor/notifications'),
        safeFetchJson('/api/v1/leads'),
        safeFetchJson('/api/v1/supervisor/qrcode'),
        safeFetchJson('/api/v1/analytics'),
        safeFetchJson('/api/v1/devices')
      ]);

      if (metricsData && metricsData.success) setMetrics(metricsData.metrics);
      if (logsData && logsData.success) setAuditLogs(logsData.logs);
      if (notifsData && notifsData.success) setNotifications(notifsData.notifications);
      if (leadsData && leadsData.leads) setLeads(leadsData.leads);
      if (analyticsData && analyticsData.success) setAnalytics(analyticsData.analytics);
      if (devicesData && devicesData.devices) setDevices(devicesData.devices);
      if (qrData && qrData.success) {
        setQrDataUrl(qrData.qrDataUrl);
        setTargetUrl(qrData.targetUrl);
      }
    } catch {
      // Falhas transitórias tratadas silenciosamente durante reconexão
    }
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      const res = await fetch('/api/v1/supervisor/broadcast-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: alertMessage.trim(), level: alertLevel })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback('Aviso transmitido para a tela da TV com sucesso!', 'success');
      }
    } catch (err) {
      showFeedback('Erro ao transmitir aviso para a TV.', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleClearAlert = async () => {
    try {
      const res = await fetch('/api/v1/supervisor/broadcast-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' })
      });
      const data = await res.json();
      if (data.success) {
        setAlertMessage('');
        showFeedback('Aviso removido da tela da TV.', 'success');
      }
    } catch (err) {
      showFeedback('Erro ao limpar aviso.', 'error');
    }
  };


  const handleExtendSession = async (minutes: number) => {
    try {
      const res = await fetch('/api/v1/session/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Sessão estendida em +${minutes} minutos!`, 'success');
        if (onSessionUpdated) onSessionUpdated();
      }
    } catch (err) {
      showFeedback('Erro ao estender sessão.', 'error');
    }
  };

  const handleEndSession = async () => {
    if (!confirm('Deseja realmente encerrar esta sessão? Músicas pendentes na fila serão canceladas.')) return;
    try {
      const res = await fetch('/api/v1/session/end', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback('Sessão encerrada com sucesso.', 'success');
        if (onSessionUpdated) onSessionUpdated();
      }
    } catch (err) {
      showFeedback('Erro ao encerrar sessão.', 'error');
    }
  };

  // Section 31: Emergency Takeover
  const handleEmergencyTakeover = async () => {
    setIsTakingOver(true);
    try {
      const res = await fetch('/api/v1/supervisor/takeover', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setShowTakeoverModal(false);
        showFeedback('Controle emergencial assumido! Novo código de presença gerado.', 'success');
        if (onSessionUpdated) onSessionUpdated();
      }
    } catch (err) {
      showFeedback('Erro ao assumir controle emergencial.', 'error');
    } finally {
      setIsTakingOver(false);
    }
  };

  const handleAuthorizeController = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newControllerName.trim()) return;
    setIsAuthorizing(true);
    try {
      const res = await fetch('/api/v1/supervisor/authorize-controller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ controllerName: newControllerName.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewControllerName('');
        showFeedback(`Controlador "${data.session.activeControllerName}" autorizado!`, 'success');
        if (onSessionUpdated) onSessionUpdated();
      }
    } catch (err) {
      showFeedback('Erro ao autorizar controlador.', 'error');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleRevokeController = async () => {
    if (!confirm('Deseja revogar o controlador atual?')) return;
    try {
      const res = await fetch('/api/v1/supervisor/revoke-controller', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback('Controlador revogado com sucesso.', 'success');
        if (onSessionUpdated) onSessionUpdated();
      }
    } catch (err) {
      showFeedback('Erro ao revogar controlador.', 'error');
    }
  };

  const exportLeadsCSV = () => {
    if (leads.length === 0) return;
    const header = 'Nome,WhatsApp,Participacoes,PrimeiraVisita,UltimaVisita,ConsentimentoMarketing\n';
    const rows = leads
      .map(
        (l) =>
          `"${l.name}","${l.normalizedWhatsapp}",${l.participationsCount},"${l.firstParticipation}","${l.lastParticipation}",${l.consentMarketing}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vozplay-leads-${session?.code || 'slz'}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Calculate remaining time
  const remainingTimeMinutes = session?.scheduledEndTime
    ? Math.max(0, Math.floor((new Date(session.scheduledEndTime).getTime() - Date.now()) / 60000))
    : 0;

  const currentItem = SUPERVISOR_ITEMS_MAP[activeTab] || SUPERVISOR_ITEMS_MAP.OVERVIEW;

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-6 pb-24 space-y-6">
      {/* Main Flex Layout with Modularized Sidebar */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <SupervisorSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          session={session}
          devicesCount={devices.length}
          leadsCount={leads.length}
          auditLogsCount={auditLogs.length}
          remainingTimeMinutes={remainingTimeMinutes}
          onExtendSession={handleExtendSession}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
          onOpenTakeover={() => setShowTakeoverModal(true)}
        />

        {/* MAIN WORKSPACE CONTENT */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Top Section Header */}
          <div className="rounded-3xl bg-gradient-to-r from-[#121028] via-[#0d1222] to-[#090d18] border border-amber-500/30 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl relative overflow-hidden ring-1 ring-white/5">
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold shadow-md shadow-amber-900/20">
                <currentItem.icon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Painel do Supervisor</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-[10px] text-slate-400">{currentItem.description}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-display font-black text-white">{currentItem.label}</h2>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 relative z-10">
              <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sessão Ativa: <strong className="text-white">{session?.code || 'SLZ-704'}</strong></span>
              </span>
            </div>
          </div>

          {/* Global Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xl transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

      {/* TAB 1: OVERVIEW & SCHEDULED END TIMES (Section 29) */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-bold">
                <span>Participantes</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-3xl font-display font-black text-white">{metrics?.totalParticipants || 0}</span>
              <p className="text-[10px] text-slate-400 mt-1">Conectados à sessão</p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-bold">
                <span>Músicas Cantadas</span>
                <Music2 className="w-4 h-4 text-pink-400" />
              </div>
              <span className="text-3xl font-display font-black text-pink-400">{metrics?.totalSongsPlayed || 0}</span>
              <p className="text-[10px] text-slate-400 mt-1">Execuções concluídas</p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-bold">
                <span>Fila de Espera</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-3xl font-display font-black text-emerald-400">{metrics?.totalSongsQueued || 0}</span>
              <p className="text-[10px] text-slate-400 mt-1">Músicas aguardando</p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-bold">
                <span>Erros / Skips</span>
                <AlertOctagon className="w-4 h-4 text-rose-400" />
              </div>
              <span className="text-3xl font-display font-black text-rose-400">
                {(metrics?.totalSkips || 0) + (metrics?.playbackErrors || 0)}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Falhas ou trocas</p>
            </div>
          </div>

          {/* Scheduled End Time Card */}
          <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-5 sm:p-7 shadow-2xl space-y-5 ring-1 ring-white/5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-base sm:text-lg font-display font-black text-white">Programação de Encerramento da Sessão</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Conforme a Seção 29 do PRD, a TV exibe alertas automáticos prévios (30m, 15m, 5m, 1m).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono text-xs font-black shadow-inner">
                  {remainingTimeMinutes > 0 ? `Restam ${remainingTimeMinutes} min` : 'Horário Atingido'}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#080c16] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4 shadow-inner">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Horário Previsto para Fim:</span>
                <span className="text-2xl font-mono font-black text-white mt-0.5 block">
                  {session?.scheduledEndTime
                    ? new Date(session.scheduledEndTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : 'Não configurado'}
                </span>
              </div>

              {/* Extension buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 mr-1 font-semibold">Estender Sessão:</span>
                <button
                  onClick={() => handleExtendSession(15)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-xs border border-white/10 transition active:scale-95"
                >
                  +15 min
                </button>
                <button
                  onClick={() => handleExtendSession(30)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-xs border border-white/10 transition active:scale-95"
                >
                  +30 min
                </button>
                <button
                  onClick={() => handleExtendSession(60)}
                  className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-xs border border-white/10 transition active:scale-95"
                >
                  +60 min
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs transition active:scale-95"
                >
                  Encerrar Agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DEVICES & NETWORK TOPOLOGY (PRD Seções 36, 37, 56, 61) */}
      {activeTab === 'DEVICES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-display font-black text-white">Topologia de Dispositivos & Rede Multi-Cliente</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Rastreamento autoritativo de conexões TV, Mesa do Operador e Smartphones dos Participantes.
              </p>
            </div>
            <button
              onClick={fetchSupervisorData}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-slate-200 font-bold transition border border-white/10 active:scale-95 flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Atualizar Dispositivos</span>
            </button>
          </div>

          {/* Quick Node Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-bold">
                <span>TV Principal de Palco</span>
                <Tv className="w-4 h-4 text-pink-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${tvConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                <span className="text-xl font-display font-black text-white">
                  {tvConnected ? 'TV Conectada' : 'Aguardando TV'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Heartbeat a cada 4s • Modo TV Lounge 10-foot
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-bold">
                <span>Mesa de Som / Controlador</span>
                <Laptop className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-xl font-display font-black text-white">
                  {session?.activeControllerName ? 'Operador Ativo' : 'Não Atribuído'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 font-mono">
                {session?.activeControllerName || 'Aguardando autorização'}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-bold">
                <span>Smartphones Conectados</span>
                <Smartphone className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-xl font-display font-black text-white">
                  {devices.filter((d) => d.role === 'PARTICIPANT').length} Celulares
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Suporte híbrido a PWA e APK Nativo
              </p>
            </div>
          </div>

          {/* Connected Devices Table */}
          <div className="rounded-3xl bg-[#0d1222] border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
            <div className="p-5 bg-[#0a0e1c] border-b border-white/[0.08] flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                Nós de Rede Registrados na Sessão ({devices.length})
              </h4>
              <span className="text-[11px] font-mono text-purple-300">
                Sessão {session?.code}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#080c16] text-slate-400 border-b border-white/[0.08] uppercase tracking-wider text-[10px] font-black font-mono">
                  <tr>
                    <th className="p-4">Dispositivo</th>
                    <th className="p-4">Papel / Função</th>
                    <th className="p-4">Tipo de Cliente</th>
                    <th className="p-4">Plataforma & Ambiente</th>
                    <th className="p-4">Versão</th>
                    <th className="p-4">Última Atividade</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {devices.map((dev) => (
                    <tr key={dev.deviceId} className="hover:bg-white/[0.03] transition">
                      <td className="p-4 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          {dev.role === 'TV' ? <Tv className="w-4 h-4 text-pink-400 flex-shrink-0" /> :
                           dev.role === 'CONTROLLER' ? <Laptop className="w-4 h-4 text-purple-400 flex-shrink-0" /> :
                           dev.role === 'SUPERVISOR' ? <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" /> :
                           <Smartphone className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                          <span className="truncate max-w-[120px]">{dev.deviceId}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          dev.role === 'TV' ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' :
                          dev.role === 'CONTROLLER' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                          dev.role === 'SUPERVISOR' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {dev.role}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-200">
                        {dev.clientType === 'ANDROID_TV' ? 'Android TV Nativo' :
                         dev.clientType === 'ANDROID' ? 'APK Android' : 'PWA Web'}
                      </td>
                      <td className="p-4 text-slate-300 font-medium">{dev.platform}</td>
                      <td className="p-4 font-mono text-purple-300 text-[11px]">{dev.clientVersion}</td>
                      <td className="p-4 text-slate-400 font-mono text-[11px]">
                        {new Date(dev.lastSeenAt).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Online
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Architectural Notes Box (PRD Seções 36, 37 e 56) */}
          <div className="p-5 rounded-3xl bg-[#080c16] border border-white/10 text-xs text-slate-300 space-y-2 ring-1 ring-white/5">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Diretriz Arquitetural de Desacoplamento Multi-Dispositivo (Seções 36 e 56 do PRD)
            </h4>
            <p className="leading-relaxed text-slate-400">
              O sistema opera com separação estrita de camadas. A migração ou convivência de aplicações PWA com aplicativos empacotados APK para Android e Android TV ocorre sem alterações de regras de negócio ou de esquema de banco de dados. Os contratos de dados REST e WebSocket permanecem idênticos e garantem interoperabilidade contínua.
            </p>
          </div>
        </div>
      )}

      {/* TAB: BRANDING & WHITE-LABEL (Identidade Visual por Estabelecimento) */}
      {activeTab === 'BRANDING' && (
        <SupervisorBrandingSection
          session={session}
          onBrandingUpdated={() => {
            if (onSessionUpdated) onSessionUpdated();
          }}
        />
      )}

      {/* TAB 2: CONTROLLER MANAGEMENT (Section 30) */}
      {activeTab === 'CONTROLLER' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-6 sm:p-7 shadow-2xl space-y-6 ring-1 ring-white/5">
            <div>
              <h3 className="text-base sm:text-lg font-display font-black text-white">Controlador Musical Ativo</h3>
              <p className="text-xs text-slate-300 mt-1">
                Deve existir apenas 1 controlador ativo por sessão. Ao autorizar um novo ou revogar, o código de presença antigo é invalidado imediatamente no backend.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#080c16] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Operador Atual</span>
                  <span className="text-base font-bold text-white mt-0.5 block">
                    {session?.activeControllerName || 'Nenhum controlador atribuído'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {session?.activeControllerId || 'Nenhum'}
                  </span>
                </div>
              </div>

              {session?.activeControllerId && (
                <button
                  onClick={handleRevokeController}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold transition flex items-center gap-2 active:scale-95"
                >
                  <UserX className="w-4 h-4" />
                  <span>Revogar Operador</span>
                </button>
              )}
            </div>

            {/* Authorize New Controller Form */}
            <form onSubmit={handleAuthorizeController} className="pt-2 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Autorizar / Substituir Controlador:
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newControllerName}
                  onChange={(e) => setNewControllerName(e.target.value)}
                  placeholder="Nome do Operador (Ex: Marcos - Mesa 01)"
                  className="flex-1 px-4 py-3 rounded-xl bg-[#080c16] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500/80 ring-1 ring-white/5 transition"
                />
                <button
                  type="submit"
                  disabled={isAuthorizing || !newControllerName.trim()}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Autorizar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PUBLIC QR CODE (Section 12) */}
      {activeTab === 'QRCODE' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-7 sm:p-9 shadow-2xl max-w-lg mx-auto text-center space-y-5 ring-1 ring-white/5">
            <div>
              <h3 className="text-xl font-display font-black text-white">QR Code Oficial da Sessão</h3>
              <p className="text-xs text-slate-300 mt-1">
                Imprima ou exiba este QR Code nas mesas e no balcão para os participantes acessarem o PWA do smartphone.
              </p>
            </div>

            {qrDataUrl ? (
              <div className="inline-block p-5 rounded-3xl bg-white shadow-2xl mx-auto ring-4 ring-white/10">
                <img src={qrDataUrl} alt="QR Code da Sessão" className="w-64 h-64 mx-auto rounded-lg" />
                <div className="text-slate-950 font-black text-sm mt-3 tracking-widest font-mono">
                  VOZPLAY • {session?.code}
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 mx-auto bg-[#080c16] rounded-3xl border border-white/10 flex items-center justify-center text-slate-500 text-xs font-mono">
                Gerando QR Code...
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-[#080c16] border border-white/10 text-xs text-purple-300 font-mono break-all shadow-inner">
              {targetUrl}
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-left leading-relaxed shadow-sm">
              <strong className="text-amber-300">Atenção (Seção 12):</strong> Escanear o QR Code permite navegar pelo catálogo e montar a playlist, mas <em>não autoriza entrar na fila</em> antes da validação do Código de Presença de 4 dígitos com o operador.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEADS & CRM (Section 42) */}
      {activeTab === 'LEADS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-display font-black text-white">Base de Participantes & Leads</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Histórico de clientes que informaram WhatsApp. O consentimento de marketing é registrado de forma transparente.
              </p>
            </div>
            <button
              onClick={exportLeadsCSV}
              disabled={leads.length === 0}
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 font-bold text-xs transition flex items-center gap-2 active:scale-95 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>

          {leads.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#0d1222] border border-white/10 text-slate-400 text-xs ring-1 ring-white/5">
              Nenhum lead registrado ainda. Os dados aparecem aqui quando os participantes informam o WhatsApp.
            </div>
          ) : (
            <div className="rounded-3xl bg-[#0d1222] border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#080c16] text-slate-400 border-b border-white/[0.08] uppercase tracking-wider text-[10px] font-black font-mono">
                    <tr>
                      <th className="p-4">Nome</th>
                      <th className="p-4">WhatsApp</th>
                      <th className="p-4">Participações</th>
                      <th className="p-4">Consentimento Comercial</th>
                      <th className="p-4">Última Visita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-white/[0.03] transition">
                        <td className="p-4 font-bold text-white">{l.name}</td>
                        <td className="p-4 font-mono text-purple-300 font-semibold">{l.normalizedWhatsapp}</td>
                        <td className="p-4 font-medium">{l.participationsCount} sessões</td>
                        <td className="p-4">
                          {l.consentMarketing ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Aceito
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/[0.06] text-slate-400 border border-white/10">
                              Não Aceito
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-400 font-mono">
                          {new Date(l.lastParticipation).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUDIT LOGS & NOTIFICATIONS (Section 44 & 49) */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-display font-black text-white">Log de Auditoria Operacional do Sistema</h3>
            <p className="text-xs text-slate-300 mt-0.5">Trilha de auditoria indelével de todas as ações de comando e controle.</p>
          </div>
          <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-5 space-y-2 max-h-96 overflow-y-auto font-mono text-xs ring-1 ring-white/5 shadow-inner">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-[#080c16] border border-white/[0.06] flex items-start gap-2.5 hover:border-white/20 transition">
                <span className="text-slate-400 text-[10px] whitespace-nowrap font-mono mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  {log.actorRole}
                </span>
                <span className="text-slate-200">
                  <strong className="text-white">{log.action}:</strong> {log.details}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: BUSINESS INTELLIGENCE & ANALYTICS (PRD Section 52 & 53) */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-display font-black text-white">Painel de Inteligência de Negócio & Métricas</h3>
              <p className="text-xs text-slate-300 mt-0.5">Estatísticas em tempo real para otimização de faturamento e engajamento.</p>
            </div>
            <button
              onClick={fetchSupervisorData}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs text-slate-200 font-bold transition border border-white/10 active:scale-95"
            >
              Atualizar Métricas
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Músicas Cantadas</span>
              <div className="text-3xl font-display font-black text-white mt-1.5">{analytics?.metrics.totalSongsPlayed ?? 0}</div>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-1">● Sessão em andamento</span>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Músicas Buscadas</span>
              <div className="text-3xl font-display font-black text-purple-400 mt-1.5">{analytics?.metrics.totalSongsSearched ?? 0}</div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Interesse do público</span>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tempo Médio Fila</span>
              <div className="text-3xl font-display font-black text-amber-400 mt-1.5">{analytics?.averageWaitMinutes ?? 12} min</div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Rotação equilibrada</span>
            </div>

            <div className="p-5 rounded-3xl bg-[#0d1222] border border-white/10 ring-1 ring-white/5 shadow-xl">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Taxa Conclusão</span>
              <div className="text-3xl font-display font-black text-emerald-400 mt-1.5">98.5%</div>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Zero travamentos</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Genre Popularity */}
            <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-6 space-y-4 ring-1 ring-white/5 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Music2 className="w-4 h-4 text-pink-400" />
                Gêneros Mais Solicitados
              </h4>
              <div className="space-y-3.5">
                {analytics?.genrePopularity.map((gp) => {
                  const maxCount = Math.max(...(analytics?.genrePopularity.map((g) => g.count) || [1]));
                  const pct = Math.round((gp.count / (maxCount || 1)) * 100);
                  return (
                    <div key={gp.genre} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-200">{gp.genre}</span>
                        <span className="font-mono text-purple-300">{gp.count} pedidos</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-[#080c16] overflow-hidden border border-white/[0.06]">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Songs */}
            <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-6 space-y-4 ring-1 ring-white/5 shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Hits Mais Tocados na Sessão
              </h4>
              <div className="space-y-2.5">
                {analytics?.topSongs.map((ts, idx) => (
                  <div
                    key={ts.title}
                    className="p-3.5 rounded-2xl bg-[#080c16] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 text-center font-mono font-black text-xs text-amber-400">#{idx + 1}</span>
                      <div>
                        <div className="text-xs font-black text-white">{ts.title}</div>
                        <div className="text-[11px] text-slate-400 font-medium">{ts.artist} • {ts.genre}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {ts.playCount}x
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: TV BROADCAST ALERT (PRD Section 28 & 29) */}
      {activeTab === 'TV_ALERT' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base sm:text-lg font-display font-black text-white">Transmissão de Aviso na Tela da TV</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Exibe mensagens discretas e elegantes na faixa superior da TV sem interromper a reprodução do vídeo.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-6 sm:p-7 space-y-5 ring-1 ring-white/5 shadow-2xl">
            <form onSubmit={handleBroadcastAlert} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Mensagem para a Faixa Superior da TV
                </label>
                <input
                  type="text"
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  placeholder="Ex: Última rodada de pedidos de músicas liberada!"
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#080c16] border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500/80 ring-1 ring-white/5 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Nível de Destaque
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'INFO', label: 'Informativo (Azul/Branco)' },
                    { id: 'WARNING', label: 'Alerta (Âmbar)' },
                    { id: 'ERROR', label: 'Urgente (Vermelho)' }
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setAlertLevel(lvl.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition active:scale-95 ${
                        alertLevel === lvl.id
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/30'
                          : 'bg-[#080c16] text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mensagens Rápidas Pré-formatadas:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Última rodada de músicas aberta para a noite!',
                    'Parabéns ao aniversariante da mesa!',
                    'Atenção: A sessão de karaokê se encerrará em 15 minutos.',
                    'Cardápio de bebidas com 20% de desconto na próxima hora!'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAlertMessage(preset)}
                      className="px-3 py-1.5 rounded-xl text-xs bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 border border-white/10 transition active:scale-95"
                    >
                      "{preset}"
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isBroadcasting || !alertMessage.trim()}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/30 transition flex items-center gap-2 active:scale-95"
                >
                  <Radio className="w-4 h-4" />
                  <span>Transmitir para a TV Agora</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAlert}
                  className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-bold transition border border-white/10 active:scale-95"
                >
                  Limpar Aviso da TV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        </main>
      </div>

      {/* EMERGENCY TAKEOVER MODAL (Section 31) */}
      {showTakeoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0d1222] border border-rose-500/40 p-7 shadow-2xl text-slate-100 ring-1 ring-white/10">
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-display font-black text-white">Supervisor Emergency Takeover</h3>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Ação Irreversível de Segurança</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Esta ação revoga imediatamente todas as permissões operacionais do Controlador atual e transfere o controle musical diretamente para o Supervisor.
            </p>
            <div className="p-4 rounded-2xl bg-[#080c16] border border-white/10 text-xs text-slate-300 mb-6 space-y-1.5 font-medium">
              <div className="flex items-center gap-2 text-emerald-400">✓ A sessão continuará sem interrupção</div>
              <div className="flex items-center gap-2 text-emerald-400">✓ A fila de músicas é preservada integralmente</div>
              <div className="flex items-center gap-2 text-emerald-400">✓ O código de presença é renovado imediatamente</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleEmergencyTakeover}
                disabled={isTakingOver}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs shadow-xl shadow-rose-600/30 transition active:scale-95"
              >
                {isTakingOver ? 'Assumindo...' : 'Confirmar Takeover'}
              </button>
              <button
                onClick={() => setShowTakeoverModal(false)}
                className="py-3.5 px-5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 text-xs font-bold transition border border-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
