/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Interface do Controlador (Operação Musical)
 * Seções 5, 13, 20, 24, 25, 30 do PRD
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  AlertOctagon,
  KeyRound,
  Tv,
  ListOrdered,
  Radio,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Sliders,
  Volume2,
  VolumeX
} from 'lucide-react';
import { QueueItem, PresenceCode, Session, PlaybackStatus } from '../../types.js';

interface ControllerViewProps {
  session: Session | null;
  tvConnected: boolean;
  onStateRefresh?: () => void;
}

export const ControllerView: React.FC<ControllerViewProps> = ({ session, tvConnected, onStateRefresh }) => {
  const [presenceCode, setPresenceCode] = useState<PresenceCode | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('IDLE');
  const [playingItem, setPlayingItem] = useState<QueueItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isActing, setIsActing] = useState(false);

  // Volume & Master Audio Control (Section 24)
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);


  // Error reporting modal
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorReason, setErrorReason] = useState('Vídeo do YouTube indisponível ou bloqueado');

  useEffect(() => {
    fetchPresenceCode();
    fetchQueueAndPlayback();

    // High frequency interval for countdown and presence refresh
    const interval = setInterval(() => {
      fetchPresenceCode();
      fetchQueueAndPlayback();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const fetchPresenceCode = async () => {
    try {
      const res = await fetch('/api/v1/controller/presence-code');
      const data = await res.json();
      if (data.success) {
        setPresenceCode(data.presenceCode);
      }
    } catch (err) {
      console.error('Erro ao obter código de presença:', err);
    }
  };

  const fetchQueueAndPlayback = async () => {
    try {
      const res = await fetch('/api/v1/queue');
      const data = await res.json();
      if (data.success) {
        setQueue(data.queue);
        setPlayingItem(data.playingItem);
        if (data.playingItem) {
          setPlaybackStatus('PLAYING');
        } else {
          setPlaybackStatus('IDLE');
        }
      }
    } catch (err) {
      console.error('Erro ao obter fila da sessão:', err);
    }
  };

  const handlePlay = async () => {
    setIsActing(true);
    try {
      const res = await fetch('/api/v1/controller/play', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showFeedback(data.error || 'Falha ao iniciar reprodução.', 'error');
      } else {
        setPlaybackStatus('PLAYING');
        fetchQueueAndPlayback();
        showFeedback('Reprodução iniciada na TV.', 'success');
        if (onStateRefresh) onStateRefresh();
      }
    } catch (err) {
      showFeedback('Erro de comunicação com o servidor.', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handlePause = async () => {
    setIsActing(true);
    try {
      const res = await fetch('/api/v1/controller/pause', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPlaybackStatus('PAUSED');
        showFeedback('Música pausada.', 'success');
        if (onStateRefresh) onStateRefresh();
      }
    } catch (err) {
      showFeedback('Erro ao pausar.', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleNext = async () => {
    setIsActing(true);
    try {
      const res = await fetch('/api/v1/controller/next', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchQueueAndPlayback();
        showFeedback('Música avançada com sucesso.', 'success');
        if (onStateRefresh) onStateRefresh();
      }
    } catch (err) {
      showFeedback('Erro ao pular música.', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleReportError = async () => {
    try {
      const res = await fetch('/api/v1/controller/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errorReason })
      });
      const data = await res.json();
      if (data.success) {
        setShowErrorModal(false);
        fetchQueueAndPlayback();
        showFeedback('Erro registrado. A TV foi informada e o Supervisor notificado.', 'error');
        if (onStateRefresh) onStateRefresh();
      }
    } catch (err) {
      showFeedback('Erro ao registrar falha.', 'error');
    }
  };

  const handleVolumeChange = async (newVol: number) => {
    setVolume(newVol);
    try {
      await fetch('/api/v1/controller/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: newVol, muted: isMuted })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      await fetch('/api/v1/controller/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume, muted: nextMuted })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setActionFeedback({ message, type });
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // PRD Section 47: DJ Soundboard Audio Triggers
  const handleTriggerSound = async (soundType: string, label: string) => {
    try {
      await fetch('/api/v1/controller/soundboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundType, label })
      });
      showFeedback(`Efeito DJ "${label}" disparado na TV e caixas de som!`, 'success');
    } catch (err) {
      showFeedback('Falha ao acionar efeito sonoro.', 'error');
    }
  };

  // PRD Section 23: Transposição de Tom ao Vivo
  const handleTuneTone = async (queueItemId: string, newTone: number) => {
    const bounded = Math.max(-3, Math.min(3, newTone));
    try {
      const res = await fetch('/api/v1/queue/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItemId, toneOffset: bounded })
      });
      const data = await res.json();
      if (data.success) {
        fetchQueueAndPlayback();
        showFeedback(
          `Tom transposto para ${bounded === 0 ? 'Original (0)' : bounded > 0 ? `+${bounded}` : bounded} semitons!`,
          'success'
        );
      }
    } catch (err) {
      showFeedback('Falha ao transpor tom.', 'error');
    }
  };

  const activeQueued = queue.filter((q) => q.status === 'QUEUED');

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-6 pb-24">
      {/* Operator Header Bar */}
      <div className="rounded-3xl bg-[#0e1322]/90 border border-white/10 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-purple-600/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">Mesa do Controlador</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Operador de Áudio & TV
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sessão: <strong className="text-white font-mono">{session?.code || 'SLZ-704'}</strong> • Operador: <span className="text-purple-300 font-semibold">{session?.activeControllerName || 'Carlos'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all ${
            tvConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <span className="relative flex h-2.5 w-2.5">
              {tvConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${tvConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <Tv className="w-4 h-4" />
            <span className="font-bold">{tvConnected ? 'TV Sincronizada' : 'TV Offline'}</span>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shadow-xl transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* SECTION 13: 4-DIGIT PRESENCE CODE HUB */}
      <div className="rounded-3xl bg-gradient-to-br from-[#121028] via-[#0d1222] to-[#090d18] border border-purple-500/30 p-5 sm:p-7 shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 via-indigo-600/30 to-pink-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-xl shadow-purple-900/20">
              <KeyRound className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                <span className="text-xs font-black uppercase tracking-widest text-purple-300">
                  Código de Presença da Sessão
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  Renovação a cada 60s
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                Informe este PIN aos participantes presentes no salão para liberá-los na fila. Impede a entrada de pessoas fora do estabelecimento.
              </p>
            </div>
          </div>

          {/* 4-Digit Card with seconds indicator */}
          <div className="flex items-center gap-3">
            <div className="px-7 py-4 rounded-2xl bg-[#090d18] border border-purple-500/40 shadow-2xl flex items-center gap-5 ring-1 ring-purple-500/20">
              <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-pink-200 drop-shadow">
                {presenceCode?.code || '----'}
              </span>
              <div className="flex flex-col items-center pl-4 border-l border-white/10">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expira</span>
                <span className="font-mono text-base font-black text-amber-400">
                  {presenceCode?.remainingSeconds || 60}s
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (presenceCode?.code) {
                  navigator.clipboard.writeText(presenceCode.code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }
              }}
              className="p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 hover:text-white transition shadow-md active:scale-95"
              title="Copiar código"
            >
              {copiedCode ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* MASTER PLAYBACK CONTROLLER */}
      <div className="rounded-3xl bg-[#0d1222]/95 border border-white/10 p-5 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl ring-1 ring-white/5">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <Radio className={`w-5 h-5 ${playingItem ? 'text-pink-500 animate-pulse' : 'text-slate-500'}`} />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                Controle de Reprodução na TV
              </h3>
              <p className="text-[11px] text-slate-400">Comandos remotos ao vivo conectados à tela principal</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            playbackStatus === 'PLAYING'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse'
              : playbackStatus === 'PAUSED'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-white/[0.05] text-slate-400 border border-white/[0.08]'
          }`}>
            {playbackStatus === 'PLAYING' ? 'No Ar • Reproduzindo' : playbackStatus === 'PAUSED' ? 'Pausado' : 'Aguardando Início'}
          </span>
        </div>

        {/* Current song details */}
        {playingItem ? (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#090d18] to-[#0e1322] border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                  No Palco Agora
                </span>
                <span className="text-[11px] text-slate-400 font-mono">YouTube: {playingItem.youtubeVideoId}</span>
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg sm:text-2xl font-display font-black text-white truncate">{playingItem.musicTitle}</h4>
                {/* Audio Equalizer bars */}
                <div className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 rounded bg-pink-500/20 flex-shrink-0">
                  <span className="w-1 bg-pink-400 rounded-full h-3 eq-bar-1" />
                  <span className="w-1 bg-purple-400 rounded-full h-4 eq-bar-2" />
                  <span className="w-1 bg-indigo-400 rounded-full h-2 eq-bar-3" />
                </div>
              </div>
              <p className="text-xs text-slate-300 truncate">
                {playingItem.musicArtist} • Cantor(a): <strong className="text-purple-300 font-bold">{playingItem.participantDisplayName}</strong>
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                <span className="px-3 py-1 rounded-full bg-white/[0.06] text-purple-300 font-semibold border border-white/[0.08]">
                  Versão: {playingItem.versionStyle}
                </span>

                {/* PRD Section 23: Transposição de Tom ao Vivo */}
                <div className="flex items-center gap-2 bg-[#080c16] px-3 py-1 rounded-xl border border-white/10 text-xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tom na TV:</span>
                  <button
                    onClick={() => handleTuneTone(playingItem.id, (playingItem.toneOffset || 0) - 1)}
                    disabled={(playingItem.toneOffset || 0) <= -3}
                    className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-black flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
                    title="Diminuir 1 semitom"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-amber-300 px-1 text-xs">
                    {(playingItem.toneOffset || 0) === 0 ? '0' : (playingItem.toneOffset || 0) > 0 ? `+${playingItem.toneOffset}` : playingItem.toneOffset}
                  </span>
                  <button
                    onClick={() => handleTuneTone(playingItem.id, (playingItem.toneOffset || 0) + 1)}
                    disabled={(playingItem.toneOffset || 0) >= 3}
                    className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-black flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
                    title="Aumentar 1 semitom"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setShowErrorModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-2 shadow-sm active:scale-95"
                title="Reportar Erro de Reprodução"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Reportar Erro</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center rounded-2xl bg-[#090d18] border border-white/[0.06] text-slate-400 space-y-2">
            <p className="text-sm font-semibold text-slate-300">Nenhuma música em reprodução no momento.</p>
            {activeQueued.length > 0 ? (
              <p className="text-xs text-purple-300">
                Há <strong>{activeQueued.length} música(s)</strong> na fila aguardando. Pressione <strong>Iniciar Reprodução</strong> abaixo.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                A fila está vazia. Os participantes podem escanear o QR Code da TV para pedir músicas.
              </p>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {playbackStatus === 'PLAYING' ? (
            <button
              id="btn-ctrl-pause"
              onClick={handlePause}
              disabled={isActing}
              className="py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-600/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Pause className="w-5 h-5 fill-slate-950" />
              <span>Pausar Música</span>
            </button>
          ) : (
            <button
              id="btn-ctrl-play"
              onClick={handlePlay}
              disabled={isActing || activeQueued.length === 0}
              className="py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/20 transition flex items-center justify-center gap-2 active:scale-95"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Iniciar Reprodução</span>
            </button>
          )}

          <button
            id="btn-ctrl-next"
            onClick={handleNext}
            disabled={isActing || (!playingItem && activeQueued.length === 0)}
            className="py-4 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white font-black text-xs sm:text-sm shadow-xl shadow-purple-600/25 transition flex items-center justify-center gap-2 active:scale-95 border border-white/15"
          >
            <SkipForward className="w-5 h-5" />
            <span>Pular / Próxima</span>
          </button>

          <button
            onClick={fetchQueueAndPlayback}
            className="col-span-2 sm:col-span-1 py-4 px-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white font-bold text-xs border border-white/10 transition flex items-center justify-center gap-2 active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Atualizar Mesa</span>
          </button>
        </div>

        {/* Master TV Volume & Audio Control (PRD Section 24) */}
        <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <button
              onClick={handleToggleMute}
              className={`p-3 rounded-xl border transition ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-white/[0.05] border-white/10 text-slate-200 hover:bg-white/[0.1]'
              }`}
              title={isMuted ? 'Desmutar TV' : 'Mutar TV'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-purple-400" />}
            </button>
            <span className="font-bold text-slate-300">Volume Master TV:</span>
            <span className="font-mono font-bold text-white w-12">{isMuted ? 'MUDO' : `${volume}%`}</span>
          </div>

          <div className="flex-1 max-w-xs flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-bold">0%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              disabled={isMuted}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <span className="text-[10px] text-slate-500 font-bold">100%</span>
          </div>
        </div>
      </div>

      {/* PRD Section 47: DJ SOUNDBOARD & AUDIO TRIGGERS */}
      <div className="rounded-3xl bg-[#0d1222]/95 border border-white/10 p-5 sm:p-7 shadow-2xl space-y-4 backdrop-blur-xl ring-1 ring-white/5">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-pink-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              DJ Soundboard (Efeitos Sonoros na TV & Som)
            </h3>
          </div>
          <span className="text-[10px] text-purple-300 font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            Disparo em Tempo Real
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { id: 'applause', label: 'Aplausos', icon: '👏', desc: 'Palmas da Galera' },
            { id: 'drums', label: 'Tambores', icon: '🥁', desc: 'Rufar de Suspense' },
            { id: 'airhorn', label: 'Air Horn', icon: '📣', desc: 'Corneta de DJ' },
            { id: 'cheer', label: 'Festa', icon: '🎉', desc: 'Assobios & Vibração' },
            { id: 'boo', label: 'Uhhh / Vaia', icon: '👎', desc: 'Trote Amigável' }
          ].map((sound) => (
            <button
              key={sound.id}
              onClick={() => handleTriggerSound(sound.id, sound.label)}
              className="p-4 rounded-2xl bg-[#090d18] hover:bg-gradient-to-b hover:from-purple-950/60 hover:to-indigo-950/40 border border-white/[0.08] hover:border-purple-500/50 text-left transition-all flex flex-col justify-between group active:scale-95 shadow-md ring-1 ring-white/[0.02]"
            >
              <div className="text-3xl mb-2 group-hover:scale-125 transition-transform">{sound.icon}</div>
              <div>
                <div className="text-xs font-bold text-white group-hover:text-purple-300">{sound.label}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{sound.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* QUEUE MONITOR FOR CONTROLLER */}
      <div className="rounded-3xl bg-[#0e1322]/90 border border-white/10 p-5 sm:p-6 shadow-2xl space-y-4 backdrop-blur-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Fila da Sessão ({activeQueued.length} Aguardando)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Algoritmo Rotativo Justo Ativo</span>
        </div>

        {queue.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">Fila vazia. Os participantes podem escanear o QR Code para entrar.</div>
        ) : (
          <div className="space-y-2.5">
            {queue.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                  item.status === 'PLAYING'
                    ? 'bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-[#0e1322] border-pink-500/50 text-white shadow-lg shadow-pink-500/10'
                    : item.status === 'COMPLETED'
                    ? 'bg-[#090D18]/50 border-white/[0.04] text-slate-500'
                    : item.status === 'ERROR'
                    ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                    : 'bg-[#090D18] border-white/[0.06] text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-bold text-slate-400 w-5 flex-shrink-0">{idx + 1}.</span>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-100 truncate">{item.musicTitle}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {item.musicArtist} • Cantado por: <strong className="text-purple-300">{item.participantDisplayName}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                    {item.versionStyle}
                  </span>
                  {item.toneOffset !== undefined && item.toneOffset !== 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Tom {item.toneOffset > 0 ? `+${item.toneOffset}` : item.toneOffset}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      item.status === 'PLAYING'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : item.status === 'QUEUED'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : item.status === 'COMPLETED'
                        ? 'bg-white/[0.04] text-slate-500'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {item.status === 'PLAYING' ? 'NO PALCO' : item.status === 'QUEUED' ? 'NA FILA' : item.status === 'COMPLETED' ? 'CONCLUÍDO' : 'ERRO'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ERROR REPORTING MODAL (Section 25) */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1322] border border-white/10 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Reportar Erro de Reprodução</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              O sistema não registrará esta música como "cantada" no histórico do participante. O Supervisor receberá um alerta imediato.
            </p>

            <div className="space-y-2 mb-4">
              <label className="text-xs font-semibold text-slate-300">Motivo da Falha:</label>
              {[
                'Vídeo do YouTube indisponível ou excluído',
                'Vídeo bloqueado para incorporação (Embed)',
                'Falha de áudio ou vídeo mudo',
                'Participante não compareceu ao palco',
                'Problema na conexão de internet da TV'
              ].map((m) => (
                <label key={m} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#090D18] border border-white/[0.07] cursor-pointer text-xs text-slate-300 hover:border-white/20 transition">
                  <input
                    type="radio"
                    name="errReason"
                    checked={errorReason === m}
                    onChange={() => setErrorReason(m)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>{m}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleReportError}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition active:scale-95"
              >
                Confirmar Erro e Pular
              </button>
              <button
                onClick={() => setShowErrorModal(false)}
                className="py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-bold text-xs border border-white/10 transition active:scale-95"
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
