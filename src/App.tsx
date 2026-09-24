/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY BETA - Plataforma de Karaokê para Estabelecimentos
 * Domínio: vozplay.ai.slz.br
 * Interfaces: Participante, Controlador, Supervisor, TV
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppSidebar } from './components/navigation/AppSidebar.js';
import { AppHeader } from './components/navigation/AppHeader.js';
import { HelpModal } from './components/common/HelpModal.js';
import { ParticipantView } from './components/participant/ParticipantView.js';
import { ControllerView } from './components/controller/ControllerView.js';
import { SupervisorView } from './components/supervisor/SupervisorView.js';
import { TVView } from './components/tv/TVView.js';
import { TurnTrackerView } from './components/public/TurnTrackerView.js';
import { OfflineBanner } from './components/common/OfflineBanner.js';
import { useVozPlaySocket } from './hooks/useVozPlaySocket.js';
import { Session, WSEventType, ActiveTab } from './types.js';
import { Sparkles } from 'lucide-react';
import { applyGlobalBrandingTokens } from './utils/brandingTokens.js';
import { apiFetch as fetch } from './utils/apiClient.js';

export default function App() {
  const [trackerItemId, setTrackerItemId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get('v') || params.get('turn');
      if (fromParam) return fromParam;
      const match = window.location.pathname.match(/\/v\/([^/]+)/);
      if (match) return match[1];
    }
    return 'queue-1';
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('v') || params.get('turn') || window.location.pathname.startsWith('/v/')) {
        return 'TRACKER';
      }
    }
    return 'PARTICIPANT';
  });

  const [sessionCode, setSessionCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('s') || params.get('table') || params.get('mesa');
      if (s) return s.toUpperCase();
    }
    return 'SLZ-704';
  });

  const [session, setSession] = useState<Session | null>(null);
  const [tvConnected, setTvConnected] = useState(false);
  const [lastReaction, setLastReaction] = useState<any>(null);
  const [lastSoundboard, setLastSoundboard] = useState<any>(null);
  const [lastQueueEvent, setLastQueueEvent] = useState<{ event: WSEventType; item?: any; tv?: any; _t: number } | null>(null);

  // Navigation sidebar & header state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Fetch initial session state
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/session');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setSession(data.data);
        setTvConnected(data.data.tvConnected);
        if (data.data.branding) {
          applyGlobalBrandingTokens(data.data.branding);
        }
      }
    } catch {
      // Reconexão transitória
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // WebSocket Real-time event listener
  const handleSocketEvent = useCallback(
    (event: WSEventType, payload: any) => {
      if (event === 'session.started' || event === 'session.updated' || event === 'session.ended') {
        if (payload?.session) {
          setSession(payload.session);
          if (payload.session.branding) {
            applyGlobalBrandingTokens(payload.session.branding);
          }
        }
      }
      if (event === 'branding.updated') {
        if (payload?.branding) {
          applyGlobalBrandingTokens(payload.branding);
          setSession(prev => prev ? {
            ...prev,
            establishmentName: payload.establishmentName || prev.establishmentName,
            branding: payload.branding
          } : prev);
        }
        if (payload?.tv) {
          setLastQueueEvent({ event, tv: payload.tv, _t: Date.now() });
        }
      }
      if (event === 'tv.connected') {
        setTvConnected(true);
      }
      if (event === 'tv.disconnected') {
        setTvConnected(false);
      }
      if (event === 'state.sync') {
        if (payload?.session) setSession(payload.session);
        if (payload?.tvConnected !== undefined) setTvConnected(payload.tvConnected);
        if (payload?.tv) {
          setLastQueueEvent({ event, tv: payload.tv, _t: Date.now() });
        }
      }
      if (
        event === 'queue.added' ||
        event === 'queue.updated' ||
        event === 'queue.cancelled' ||
        event === 'participant.turn_called' ||
        event === 'queue.playing' ||
        event === 'queue.completed' ||
        event === 'player.play' ||
        event === 'player.state_changed' ||
        event === 'participant.turn_started' ||
        event === 'participant.turn_missed' ||
        event === 'participant.turn_missed_again' ||
        event === 'queue.item_requeued'
      ) {
        setLastQueueEvent({ event, item: payload?.item, tv: payload?.tv, _t: Date.now() });
      }
      if (event === 'reaction.sent') {
        setLastReaction({ ...payload, _t: Date.now() });
      }
      if (event === 'soundboard.play') {
        setLastSoundboard({ ...payload, _t: Date.now() });
      }
    },
    []
  );

  const { isConnected: wsConnected, send: sendWs } = useVozPlaySocket({
    role: activeTab === 'TRACKER' ? 'PARTICIPANT' : activeTab,
    sessionId: session?.id,
    onEvent: handleSocketEvent
  });

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-row selection:bg-purple-500 selection:text-white relative overflow-x-hidden">
      {/* Ambient background studio lighting / subtle glow */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] z-0" />
      <div className="pointer-events-none fixed top-1/3 -right-40 w-[600px] h-[600px] bg-pink-600/10 rounded-full blur-[160px] z-0" />
      <div className="pointer-events-none fixed -bottom-40 left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] z-0" />

      {/* Global Modular Sidebar Menu (Desktop + Mobile Slide-over) */}
      <AppSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        wsConnected={wsConnected}
        tvConnected={tvConnected}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      {/* Main Canvas Area: Header + Dynamic View */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
        {/* Global Modular App Header */}
        <AppHeader
          activeTab={activeTab}
          session={session}
          wsConnected={wsConnected}
          tvConnected={tvConnected}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onOpenHelp={() => setShowHelpModal(true)}
        />

        {/* Global Central de Ajuda & Guia Operacional Modal */}
        <HelpModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
        />

        {/* Architecture Concept Helper Banner */}
        <div className="bg-[#0b0f1d]/70 border-b border-white/[0.05] py-2 px-4 text-center text-xs text-slate-400 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1">
            <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ecossistema VozPlay Lounge</span>
            </span>
            <span>
              <strong className="text-slate-200">O participante escolhe.</strong> O sistema organiza deterministicamente. O operador comanda. A TV reproduz.
            </span>
            <span className="hidden md:inline text-slate-600">•</span>
            <span className="hidden md:inline text-slate-400 font-mono text-[11px]">
              Decoupled REST API + Real-Time Sync + Anti-Monopólio
            </span>
          </div>
        </div>

        {/* Primary View Container */}
        <main className="flex-1 relative">
          {activeTab === 'PARTICIPANT' && (
            <ParticipantView
              session={session}
              sessionCode={sessionCode || session?.code || 'SLZ-704'}
              lastSoundboard={lastSoundboard}
              lastQueueEvent={lastQueueEvent}
              onOpenTracker={(id) => {
                setTrackerItemId(id);
                setActiveTab('TRACKER');
              }}
            />
          )}

          {activeTab === 'CONTROLLER' && (
            <ControllerView
              session={session}
              tvConnected={tvConnected}
              onStateRefresh={fetchSession}
              lastQueueEvent={lastQueueEvent}
            />
          )}

          {activeTab === 'SUPERVISOR' && (
            <SupervisorView
              session={session}
              tvConnected={tvConnected}
              onSessionUpdated={fetchSession}
              lastQueueEvent={lastQueueEvent}
            />
          )}

          {activeTab === 'TV' && (
            <TVView
              lastReaction={lastReaction}
              lastSoundboard={lastSoundboard}
              lastQueueEvent={lastQueueEvent}
              onNotifyPlayerState={(state, error) => {
                sendWs('TV_PLAYER_STATE', { playbackState: state, error });
              }}
            />
          )}

          {activeTab === 'TRACKER' && (
            <TurnTrackerView
              queueItemId={trackerItemId}
              onGoToParticipant={() => setActiveTab('PARTICIPANT')}
              onClose={() => setActiveTab('PARTICIPANT')}
            />
          )}
        </main>
      </div>

      {/* Offline Connectivity Banner */}
      <OfflineBanner />
    </div>
  );
}
