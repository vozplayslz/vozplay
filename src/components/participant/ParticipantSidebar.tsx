/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Participant Modular Sidebar Navigation
 * PWA Mobile & Responsive Desktop Sidebar
 */

import React from 'react';
import {
  Search,
  ListMusic,
  Clock,
  History,
  CheckCircle2,
  KeyRound,
  UserCheck,
  AlertTriangle,
  Radio,
  Flame,
  Plus,
  Share2,
  Heart,
  Sparkles,
  QrCode
} from 'lucide-react';
import { Participant, QueueItem } from '../../types.js';

export type ParticipantSubTab = 'SEARCH' | 'RECOMMENDATIONS' | 'WISHLIST' | 'PLAYLIST' | 'QUEUE' | 'HISTORY';

interface ParticipantSidebarProps {
  activeSubTab: ParticipantSubTab;
  setActiveSubTab: (tab: ParticipantSubTab) => void;
  participant: Participant;
  playlistCount: number;
  wishlistCount?: number;
  queuedCount: number;
  liveSong?: QueueItem;
  myQueuedSong?: QueueItem;
  queuedBeforeCount: number;
  isMyTurnNow: boolean;
  sendingReaction: string | null;
  onSendReaction: (emoji: string, label: string) => void;
  presenceCodeInput: string;
  setPresenceCodeInput: (val: string) => void;
  onVerifyPresence: (e: React.FormEvent) => void;
  isVerifyingPresence: boolean;
  presenceError: string;
  presenceSuccess: string;
  onOpenTracker?: (id: string) => void;
  onRequestCustomSong?: () => void;
  sessionCode?: string;
  onOpenQRScanner?: () => void;
}

const REACTION_BUTTONS = [
  { emoji: '👏', label: 'Aplausos' },
  { emoji: '🔥', label: 'Energia' },
  { emoji: '❤️', label: 'Amei' },
  { emoji: '🎤', label: 'Show' },
  { emoji: '🥳', label: 'Top' },
  { emoji: '🍻', label: 'Saúde' }
];

export const ParticipantSidebar: React.FC<ParticipantSidebarProps> = ({
  activeSubTab,
  setActiveSubTab,
  participant,
  playlistCount,
  wishlistCount = 0,
  queuedCount,
  liveSong,
  myQueuedSong,
  queuedBeforeCount,
  isMyTurnNow,
  sendingReaction,
  onSendReaction,
  presenceCodeInput,
  setPresenceCodeInput,
  onVerifyPresence,
  isVerifyingPresence,
  presenceError,
  presenceSuccess,
  onOpenTracker,
  onRequestCustomSong,
  sessionCode,
  onOpenQRScanner
}) => {
  return (
    <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
      {/* 1. VIP PARTICIPANT PASS CARD */}
      <div className="rounded-3xl bg-gradient-to-br from-[#12162a]/95 via-[#0e1220]/95 to-[#161028]/95 border border-white/10 p-4 sm:p-5 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 p-0.5 shadow-md shadow-purple-600/20">
              <div className="w-full h-full bg-[#0a0e1a] rounded-[14px] flex items-center justify-center font-black text-purple-300 text-base">
                {participant.displayName.charAt(0).toUpperCase()}
              </div>
            </div>
            {participant.isVerified && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0a0e1a] flex items-center justify-center">
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <h3 className="text-white font-black text-sm sm:text-base tracking-tight truncate">
                {participant.displayName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {participant.isVerified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <UserCheck className="w-2.5 h-2.5" /> Presença Validada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <KeyRound className="w-2.5 h-2.5" /> Código Pendente
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono truncate mt-1">
              {participant.whatsapp ? `WhatsApp: ${participant.whatsapp}` : 'Convidado da Mesa'}
            </p>

            <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-white/[0.08]">
              <span className="text-[10px] text-slate-400">
                Mesa: <strong className="text-purple-300 font-mono">{sessionCode || 'SLZ-704'}</strong>
              </span>
              {onOpenQRScanner && (
                <button
                  type="button"
                  onClick={onOpenQRScanner}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-300 hover:text-pink-200 transition bg-pink-500/10 hover:bg-pink-500/20 px-2 py-0.5 rounded-lg border border-pink-500/20 active:scale-95"
                  title="Escanear QR Code da mesa ou telão"
                >
                  <QrCode className="w-3 h-3 text-pink-400" />
                  Trocar Mesa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PRESENCE FORM IF NOT VERIFIED */}
        {!participant.isVerified && (
          <div className="mt-4 pt-3.5 border-t border-white/[0.08] relative z-10">
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold mb-2">
              <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Validar Presença no Som</span>
            </div>
            <form onSubmit={onVerifyPresence} className="flex gap-2">
              <input
                type="text"
                maxLength={4}
                value={presenceCodeInput}
                onChange={(e) => setPresenceCodeInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4 dígitos"
                className="w-24 text-center font-mono font-black text-sm tracking-widest px-2.5 py-1.5 rounded-xl bg-[#080B14] border border-amber-500/40 text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isVerifyingPresence || presenceCodeInput.length !== 4}
                className="flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-[11px] transition shadow-md disabled:opacity-40"
              >
                {isVerifyingPresence ? '...' : 'Liberar'}
              </button>
            </form>
            {presenceError && (
              <p className="text-[10px] text-rose-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {presenceError}
              </p>
            )}
            {presenceSuccess && (
              <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> {presenceSuccess}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. NAVIGATION SUBTABS (DESKTOP VERTICAL MENU & MOBILE COMPACT) */}
      <div className="rounded-3xl bg-[#0c111e]/90 border border-white/[0.08] p-2 space-y-1 shadow-xl backdrop-blur-xl">
        <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:block">
          Seções do Participante
        </div>

        <button
          id="btn-subtab-search"
          onClick={() => setActiveSubTab('SEARCH')}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
            activeSubTab === 'SEARCH'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4" />
            <div className="text-left">
              <span className="block leading-tight">Explorar Catálogo</span>
              <span className={`text-[10px] block font-normal ${activeSubTab === 'SEARCH' ? 'text-purple-100' : 'text-slate-500'}`}>
                Músicas, tons & estilos
              </span>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
            activeSubTab === 'SEARCH' ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-purple-300'
          }`}>
            HD
          </span>
        </button>

        <button
          id="btn-subtab-recommendations"
          onClick={() => setActiveSubTab('RECOMMENDATIONS')}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
            activeSubTab === 'RECOMMENDATIONS'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Sparkles className={`w-4 h-4 ${activeSubTab === 'RECOMMENDATIONS' ? 'text-pink-300 animate-pulse' : 'text-purple-400'}`} />
            <div className="text-left">
              <span className="block leading-tight">Playlist IA (Gemini)</span>
              <span className={`text-[10px] block font-normal ${activeSubTab === 'RECOMMENDATIONS' ? 'text-purple-100' : 'text-slate-500'}`}>
                Recomendações por gênero
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm flex items-center gap-1">
            IA
          </span>
        </button>

        <button
          id="btn-subtab-wishlist"
          onClick={() => setActiveSubTab('WISHLIST')}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
            activeSubTab === 'WISHLIST'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Heart className={`w-4 h-4 ${activeSubTab === 'WISHLIST' ? 'fill-pink-300 text-pink-300' : 'text-pink-400'}`} />
            <div className="text-left">
              <span className="block leading-tight">Lista de Desejos</span>
              <span className={`text-[10px] block font-normal ${activeSubTab === 'WISHLIST' ? 'text-purple-100' : 'text-slate-500'}`}>
                Músicas para as próximas rodadas
              </span>
            </div>
          </div>
          {wishlistCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm flex items-center gap-1">
              <Heart className="w-2.5 h-2.5 fill-white" />
              {wishlistCount}
            </span>
          ) : (
            <span className="text-[10px] text-pink-400/80 font-mono">
              ♡ 0
            </span>
          )}
        </button>

        <button
          id="btn-subtab-playlist"
          onClick={() => setActiveSubTab('PLAYLIST')}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
            activeSubTab === 'PLAYLIST'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <ListMusic className="w-4 h-4" />
            <div className="text-left">
              <span className="block leading-tight">Minha Playlist</span>
              <span className={`text-[10px] block font-normal ${activeSubTab === 'PLAYLIST' ? 'text-purple-100' : 'text-slate-500'}`}>
                Músicas salvas na mesa
              </span>
            </div>
          </div>
          {playlistCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500 text-white shadow-sm">
              {playlistCount}
            </span>
          )}
        </button>

        <button
          id="btn-subtab-queue"
          onClick={() => setActiveSubTab('QUEUE')}
          className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
            activeSubTab === 'QUEUE'
              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4" />
            <div className="text-left">
              <span className="block leading-tight">Fila da TV</span>
              <span className={`text-[10px] block font-normal ${activeSubTab === 'QUEUE' ? 'text-purple-100' : 'text-slate-500'}`}>
                Ordem ao vivo na tela
              </span>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeSubTab === 'QUEUE' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {queuedCount}
          </span>
        </button>

        {participant.whatsapp && (
          <button
            id="btn-subtab-history"
            onClick={() => setActiveSubTab('HISTORY')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
              activeSubTab === 'HISTORY'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-3">
              <History className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Meu Histórico</span>
                <span className={`text-[10px] block font-normal ${activeSubTab === 'HISTORY' ? 'text-purple-100' : 'text-slate-500'}`}>
                  Músicas cantadas
                </span>
              </div>
            </div>
            <span className="text-[10px] text-purple-300 font-mono">VIP</span>
          </button>
        )}

        {/* Custom Song Shortcut */}
        {onRequestCustomSong && (
          <div className="pt-2 border-t border-white/[0.06] mt-1">
            <button
              onClick={onRequestCustomSong}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/25 text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pedir Outra Canção</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. MY QUEUED POSITION QUICK CARD */}
      {myQueuedSong && (
        <div className="rounded-3xl bg-gradient-to-br from-purple-950/50 via-[#0e1322] to-indigo-950/50 border border-purple-500/30 p-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black text-sm">
              #{queuedBeforeCount + 1}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                Sua Vez na Fila
              </div>
              <div className="text-xs font-bold text-white truncate">
                {myQueuedSong.musicTitle}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 mb-3">
            {myQueuedSong.status === 'CALLED'
              ? '🎤 VOCÊ FOI CHAMADO! Suba ao palco e confirme no topo da tela!'
              : queuedBeforeCount === 0
              ? '🔥 Prepare o microfone! Você é o próximo!'
              : `Aguarde ~${(queuedBeforeCount + 1) * 4} min (${queuedBeforeCount} antes de você)`}
          </p>
          {onOpenTracker && (
            <button
              onClick={() => onOpenTracker(myQueuedSong.id)}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Acompanhar Minha Vez</span>
            </button>
          )}
        </div>
      )}

      {/* 4. LIVE AUDIENCE CHEER / TORCIDA NA TV */}
      {liveSong && (
        <div className="rounded-3xl bg-[#0d1222]/90 border border-pink-500/20 p-4 shadow-xl backdrop-blur-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-pink-400 animate-pulse" />
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-pink-400 block leading-none">
                  No Palco Agora
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[170px] block mt-0.5">
                  {liveSong.musicTitle}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">
              {liveSong.participantDisplayName}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Reaja e interaja com o telão ao vivo:
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {REACTION_BUTTONS.map((rx) => (
              <button
                key={rx.emoji}
                onClick={() => onSendReaction(rx.emoji, rx.label)}
                disabled={Boolean(sendingReaction)}
                className="py-1.5 px-2 rounded-xl bg-white/[0.05] hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-slate-200 transition active:scale-95 text-xs flex flex-col items-center justify-center gap-0.5 disabled:opacity-60"
                title={`Enviar ${rx.label}`}
              >
                <span className="text-base leading-none">{rx.emoji}</span>
                <span className="text-[9px] text-slate-400 font-semibold">{rx.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
