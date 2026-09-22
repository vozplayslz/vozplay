/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Interface da TV de Reprodução (PWA TV / Android TV Client)
 * Seções 8, 9, 23, 26, 27, 28, 54 do PRD
 * 
 * Regra Arquitetural Absoluta: Utiliza estritamente TVSessionDTO.
 * NUNCA recebe ou exibe dados privados (WhatsApp, telefones, leads, tokens).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Tv, Music2, Radio, AlertTriangle, QrCode, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TVSessionDTO } from '../../types.js';
import { playDJAudioEffect } from '../../utils/synthAudio.js';

interface TVViewProps {
  onNotifyPlayerState?: (state: string, error?: string) => void;
  lastReaction?: { participantName: string; emoji: string; label: string; timestamp?: string; _t?: number } | null;
  lastSoundboard?: { soundType: string; label: string; timestamp?: string; _t?: number } | null;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  label: string;
  name: string;
  leftPercent: number;
}

export const TVView: React.FC<TVViewProps> = ({ onNotifyPlayerState, lastReaction, lastSoundboard }) => {
  const [tvData, setTvData] = useState<TVSessionDTO | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(6);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [activeSoundBanner, setActiveSoundBanner] = useState<{ soundType: string; label: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle incoming audience reactions
  useEffect(() => {
    if (!lastReaction) return;
    const newReaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji: lastReaction.emoji || '👏',
      label: lastReaction.label || 'Reação',
      name: lastReaction.participantName || 'Plateia',
      leftPercent: 12 + Math.random() * 74
    };

    setReactions((prev) => [...prev.slice(-12), newReaction]);

    const timer = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 3800);

    return () => clearTimeout(timer);
  }, [lastReaction]);

  // Handle incoming DJ soundboard effects
  useEffect(() => {
    if (!lastSoundboard) return;
    playDJAudioEffect(lastSoundboard.soundType);

    setActiveSoundBanner({
      soundType: lastSoundboard.soundType,
      label: lastSoundboard.label
    });

    const timer = setTimeout(() => {
      setActiveSoundBanner(null);
    }, 3200);

    return () => clearTimeout(timer);
  }, [lastSoundboard]);

  useEffect(() => {
    fetchTVSession();

    // Heartbeat every 4 seconds to notify backend TV is alive and get latest sanitized DTO
    const interval = setInterval(async () => {
      fetchTVSession();
      try {
        await fetch('/api/v1/tv/heartbeat', { method: 'POST' });
      } catch (err) {
        // silent ping
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Listen to YouTube postMessage events for auto-advancing on video end (Section 23 & 26)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          // YouTube player state 0 = ENDED
          if (data.event === 'onStateChange' && data.info === 0) {
            handleSongEnded();
          }
        } catch (e) {
          // not youtube json
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tvData]);

  const handleSongEnded = async () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTransitionCountdown(6);

    const timer = setInterval(() => {
      setTransitionCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Advance song on server
          fetch('/api/v1/controller/next', { method: 'POST' }).then(() => {
            fetchTVSession();
            setIsTransitioning(false);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchTVSession = async () => {
    try {
      const res = await fetch('/api/v1/tv/session');
      const json = await res.json();
      if (json.success) {
        setTvData(json.data);
        // Sync master volume to YouTube player iframe (Section 24)
        if (iframeRef.current?.contentWindow && typeof json.data.volume === 'number') {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: 'command',
              func: 'setVolume',
              args: [json.data.volume]
            }),
            '*'
          );
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar TV DTO:', err);
    }
  };


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentSong = tvData?.currentSong;
  const nextSong = tvData?.queue && tvData.queue.length > 0 ? tvData.queue[0] : null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-[85vh] sm:min-h-screen bg-black text-slate-100 flex flex-col justify-between p-4 sm:p-8 overflow-hidden select-none font-sans"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-950/30 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-pink-950/20 blur-[120px] pointer-events-none rounded-full" />

      {/* TOP BAR: Lounge Branding & Session Code & Discrete Alert */}
      <div className="relative z-10 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-500/20">
            VP
          </div>
          <div>
            <h1 className="font-black text-lg tracking-wider text-white">
              VOZ<span className="text-pink-500">PLAY</span> TV
            </h1>
            <span className="text-xs text-slate-400">
              {tvData?.establishmentName || 'VozPlay Lounge'}
            </span>
          </div>
        </div>

        {/* Section 28: Discrete, non-intrusive Session Alert */}
        {tvData?.sessionAlert && (
          <div className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-semibold flex items-center gap-2 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{tvData.sessionAlert.message}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Simulation button for dev testing */}
          {currentSong && !isTransitioning && (
            <button
              onClick={handleSongEnded}
              className="px-2.5 py-1 rounded-lg bg-pink-950/60 hover:bg-pink-900 border border-pink-800 text-[11px] text-pink-300 font-medium transition"
              title="Testar término do vídeo"
            >
              Simular Fim da Música
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-slate-300 font-medium transition"
          >
            {isFullscreen ? 'Sair da Tela Cheia' : 'Modo TV Tela Cheia'}
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Sinal Ao Vivo</span>
          </div>
        </div>
      </div>

      {/* SECTION 27: VISUAL TRANSITION SCREEN BETWEEN SONGS */}
      {isTransitioning && nextSong ? (
        <div className="relative z-20 my-auto py-12 flex flex-col items-center max-w-3xl mx-auto w-full text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-500/20 via-purple-500/20 to-indigo-500/20 border-2 border-pink-500/40 flex items-center justify-center text-pink-400 mb-6 shadow-2xl shadow-pink-500/25 backdrop-blur-md">
            <Sparkles className="w-12 h-12 animate-spin text-pink-400" style={{ animationDuration: '4s' }} />
          </div>

          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-indigo-400 mb-2">
            Show Concluído com Sucesso!
          </span>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-white mb-3 tracking-tight">
            Prepare-se, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">{nextSong.participantDisplayName}</span>!
          </h2>
          <p className="text-lg sm:text-2xl text-slate-200 font-semibold mb-6">
            Você vai cantar: <strong className="text-white font-bold">{nextSong.title}</strong> — <span className="text-purple-300">{nextSong.artist}</span>
          </p>

          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-xl shadow-2xl">
            <span className="text-xs text-slate-300 uppercase tracking-wider font-bold">Iniciando em</span>
            <span className="font-mono text-3xl font-black text-pink-400">{transitionCountdown}s</span>
          </div>
        </div>
      ) : (
        /* MAIN SCREEN STAGE: YOUTUBE EMBED PLAYER & SINGER BANNER */
        <div className="relative z-10 my-auto py-4 flex flex-col items-center max-w-6xl mx-auto w-full">
          {currentSong ? (
            <div className="w-full space-y-4">
              {/* Header: Singer Display Name Lower Third */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/40 text-pink-300 text-xs sm:text-sm font-black uppercase tracking-widest shadow-lg shadow-pink-500/10">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-pink-400" />
                  <span>No Palco Agora</span>
                </div>
                <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight drop-shadow-md">
                  {currentSong.participantDisplayName}
                </h2>
                <div className="text-base sm:text-2xl text-slate-200 font-bold">
                  {currentSong.title} — <span className="text-purple-300">{currentSong.artist}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pt-0.5">
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-slate-200 font-semibold">
                    Versão: <strong className="text-purple-300">{currentSong.versionStyle}</strong>
                  </span>
                  {currentSong.toneOffset !== undefined && currentSong.toneOffset !== 0 && (
                    <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs">
                      Tom Transposto: {currentSong.toneOffset > 0 ? `+${currentSong.toneOffset}` : currentSong.toneOffset} Semitons
                    </span>
                  )}
                </div>
              </div>

              {/* YouTube Embedded Player (Section 23) */}
              <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white/15 bg-slate-950 relative ring-1 ring-white/10">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${currentSong.youtubeVideoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
                    window.location.origin
                  )}&rel=0`}
                  title={`${currentSong.title} - ${currentSong.artist}`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            /* IDLE / WAITING SCREEN */
            <div className="text-center py-16 px-6 sm:px-12 rounded-3xl bg-[#0d1222]/80 border border-white/10 backdrop-blur-xl max-w-3xl w-full shadow-2xl relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-600 p-0.5 mx-auto mb-6 shadow-2xl shadow-purple-600/30">
                  <div className="w-full h-full bg-[#0a0e1c] rounded-[22px] flex items-center justify-center text-white">
                    <Music2 className="w-12 h-12 text-purple-300" />
                  </div>
                </div>
                <h2 className="text-2xl sm:text-5xl font-display font-black text-white mb-3 tracking-tight">
                  Palco VozPlay Disponível
                </h2>
                <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
                  Aponte a câmera do seu celular para o QR Code da sua mesa, acesse o catálogo em alta definição e mande a sua música para a TV!
                </p>

                {nextSong && (
                  <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/30 inline-block text-left shadow-xl">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 block mb-1">
                      A Seguir no Palco:
                    </span>
                    <span className="text-xl font-display font-black text-white block">
                      {nextSong.participantDisplayName}
                    </span>
                    <span className="text-sm text-slate-300 font-semibold">
                      {nextSong.title} • {nextSong.artist}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER BAR: Next Song + Upcoming Queue Ticker + Mini QR Code */}
      <div className="relative z-10 border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Next singer banner */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400 font-bold text-sm">
            2°
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              A Seguir:
            </span>
            <span className="text-xs sm:text-sm font-bold text-white">
              {nextSong ? `${nextSong.participantDisplayName} • ${nextSong.title}` : 'Fila livre para novas músicas'}
            </span>
          </div>
        </div>

        {/* Up to 3 upcoming songs ticker */}
        {tvData?.queue && tvData.queue.length > 1 && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500">Próximos:</span>
            {tvData.queue.slice(1, 4).map((q, idx) => (
              <span key={q.id} className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-slate-300">
                {idx + 3}º {q.participantDisplayName} ({q.title})
              </span>
            ))}
          </div>
        )}

        {/* Mini QR Code corner prompt */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
          <QrCode className="w-5 h-5 text-pink-400" />
          <div className="text-left text-[11px] leading-tight">
            <span className="text-slate-300 font-semibold block">Peça sua música</span>
            <span className="text-slate-500 font-mono text-[10px]">vozplay.ai.slz.br</span>
          </div>
        </div>
      </div>

      {/* PRD Section 47: DJ Soundboard Visual Banner on TV */}
      <AnimatePresence>
        {activeSoundBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 14 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white font-black text-lg shadow-2xl shadow-pink-500/40 border-2 border-white/40 flex items-center gap-3 backdrop-blur-md">
              <span className="text-3xl">
                {activeSoundBanner.soundType === 'applause' ? '👏' :
                 activeSoundBanner.soundType === 'drums' ? '🥁' :
                 activeSoundBanner.soundType === 'airhorn' ? '📣' :
                 activeSoundBanner.soundType === 'cheer' ? '🎉' : '👎'}
              </span>
              <span className="tracking-wide">DJ EFEITO: {activeSoundBanner.label}!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRD Section 48: Live Audience Floating Reactions on TV */}
      <div className="fixed inset-x-0 bottom-24 pointer-events-none z-40 overflow-hidden h-96">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: -260, scale: 1.05 }}
              exit={{ opacity: 0, y: -320, scale: 0.9 }}
              transition={{ duration: 3.5, ease: 'easeOut' }}
              className="absolute bottom-4 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/95 border border-pink-500/50 shadow-2xl shadow-pink-500/30 text-white text-xs font-bold backdrop-blur-md pointer-events-none"
              style={{ left: `${r.leftPercent}%` }}
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="leading-tight">
                <div className="text-pink-300 font-bold">{r.name}</div>
                <div className="text-[10px] text-slate-300 font-normal">{r.label}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
