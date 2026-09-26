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
import { Tv, Music2, Radio, AlertTriangle, QrCode, Sparkles, CheckCircle2, Mic2, Flame, Users, Megaphone, Timer, Volume2, VolumeX, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TVSessionDTO } from '../../types.js';
import { playDJAudioEffect } from '../../utils/synthAudio.js';
import { apiFetch as fetch } from '../../utils/apiClient.js';
import { VozPlayMascotIcon, VozPlayLogo } from '../common/VozPlayLogo.js';

interface TVViewProps {
  onNotifyPlayerState?: (state: string, error?: string) => void;
  lastReaction?: { participantName: string; emoji: string; label: string; timestamp?: string; _t?: number } | null;
  lastSoundboard?: { soundType: string; label: string; timestamp?: string; _t?: number } | null;
  lastQueueEvent?: {
    event: string;
    item?: any;
    tv?: TVSessionDTO;
    callingState?: any;
    maiaAnnouncement?: any;
    message?: string;
    _t?: number;
  } | null;
}

interface MaiaActiveNotice {
  id: string;
  badge: string;
  singer?: string;
  song?: string;
  speechText: string;
  visualText: string;
  callType: 'CALL' | 'FIRST_ABSENCE' | 'SECOND_ABSENCE' | 'ANNOUNCEMENT';
  audioBase64?: string | null;
  mimeType?: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  label: string;
  name: string;
  leftPercent: number;
}

interface QueueHighlightNotice {
  id: string;
  participantDisplayName: string;
  partnerDisplayName?: string;
  isDuet?: boolean;
  title: string;
  artist: string;
  versionStyle: string;
  toneOffset?: number;
  isNext: boolean;
  positionText: string;
  timestamp: number;
}

export const TVView: React.FC<TVViewProps> = ({
  onNotifyPlayerState,
  lastReaction,
  lastSoundboard,
  lastQueueEvent
}) => {
  const [tvData, setTvData] = useState<TVSessionDTO | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(6);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [activeSoundBanner, setActiveSoundBanner] = useState<{ soundType: string; label: string } | null>(null);
  const [tvQrUrl, setTvQrUrl] = useState<string>('');
  const [queueHighlightNotice, setQueueHighlightNotice] = useState<QueueHighlightNotice | null>(null);
  const [isNextSongHighlighted, setIsNextSongHighlighted] = useState(false);
  const [activeMaiaNotice, setActiveMaiaNotice] = useState<MaiaActiveNotice | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const maiaNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const prevNextSongIdRef = useRef<string | null>(null);
  const prevQueueLengthRef = useRef<number>(0);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [completedPerformance, setCompletedPerformance] = useState<{
    singer: string;
    isDuet?: boolean;
    title: string;
    artist: string;
    score: number;
    badge: string;
    applauseCount: number;
  } | null>(null);

  // Countdown timer for calling state
  const [callingSeconds, setCallingSeconds] = useState<number>(30);

  useEffect(() => {
    if (tvData?.callingState?.remainingSeconds !== undefined) {
      setCallingSeconds(tvData.callingState.remainingSeconds);
    }
  }, [tvData?.callingState]);

  useEffect(() => {
    if (!tvData?.callingState) return;
    const timer = setInterval(() => {
      setCallingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [tvData?.callingState]);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const getSingerDisplayName = (item?: { participantDisplayName?: string; partnerDisplayName?: string; isDuet?: boolean } | null) => {
    if (!item) return '';
    if (item.isDuet && item.partnerDisplayName) {
      return `${item.participantDisplayName} & ${item.partnerDisplayName}`;
    }
    return item.participantDisplayName || '';
  };

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

    // Register TV Device Handshake (PRD Seções 36 & 37)
    fetch('/api/v1/devices/handshake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'dev-tv-' + (typeof window !== 'undefined' ? window.location.hostname : 'tv'),
        clientType: 'ANDROID_TV',
        role: 'TV',
        platform: navigator.userAgent.includes('Android') ? 'Android TV 12' : 'Web TV Player (Chrome 10-foot)',
        clientVersion: '1.2.0-tv'
      })
    }).catch(() => {});

    // Fetch official session QR code for screen corner display
    fetch('/api/v1/supervisor/qrcode')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.qrDataUrl) {
          setTvQrUrl(data.qrDataUrl);
        }
      })
      .catch(() => {});

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
    const current = tvData?.currentSong;
    if (current) {
      const generatedScore = Math.floor(92 + Math.random() * 8);
      const soloBadges = [
        'VOZ DE OURO ⭐⭐⭐⭐⭐',
        'SHOW DE CARISMA 🔥🔥🔥',
        'AFINAÇÃO IMPECÁVEL 🎤✨',
        'ESTRELA DO LOUNGE 🌟👑'
      ];
      const duetBadges = [
        'DUPLA DE OURO 🎤🎤⭐⭐⭐⭐⭐',
        'SINTONIA PERFEITA 🔥🔥🔥',
        'HARMONIA IMPECÁVEL 🎶✨',
        'SUPER DUETO DO LOUNGE 🌟👑'
      ];
      const badges = current.isDuet ? duetBadges : soloBadges;
      setCompletedPerformance({
        singer: getSingerDisplayName(current),
        isDuet: current.isDuet,
        title: current.title,
        artist: current.artist,
        score: generatedScore,
        badge: badges[Math.floor(Math.random() * badges.length)],
        applauseCount: Math.max(18, reactions.length * 3 + Math.floor(Math.random() * 32))
      });
      // Trigger soundboard applause effect automatically
      try {
        playDJAudioEffect('applause');
      } catch (e) {}
    }

    setIsTransitioning(true);
    setTransitionCountdown(7);

    const timer = setInterval(() => {
      setTransitionCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Advance song on server
          fetch('/api/v1/tv/song-ended', { method: 'POST' }).then(() => {
            fetchTVSession();
            setIsTransitioning(false);
            setCompletedPerformance(null);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerQueueHighlight = (
    item: {
      id: string;
      title: string;
      artist: string;
      versionStyle: any;
      participantDisplayName: string;
      partnerDisplayName?: string;
      isDuet?: boolean;
      toneOffset?: number;
    },
    isNext: boolean,
    positionText: string
  ) => {
    setQueueHighlightNotice({
      id: `${item.id}-${Date.now()}`,
      participantDisplayName: item.participantDisplayName,
      partnerDisplayName: item.partnerDisplayName,
      isDuet: item.isDuet,
      title: item.title,
      artist: item.artist,
      versionStyle: item.versionStyle,
      toneOffset: item.toneOffset,
      isNext,
      positionText,
      timestamp: Date.now()
    });

    setIsNextSongHighlighted(true);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setQueueHighlightNotice(null);
    }, 6500);

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setIsNextSongHighlighted(false);
    }, 6500);
  };

  const checkAndTriggerHighlight = (freshTvData: TVSessionDTO) => {
    const next = freshTvData.queue && freshTvData.queue.length > 0 ? freshTvData.queue[0] : null;
    const newLength = freshTvData.queue?.length || 0;
    const prevLength = prevQueueLengthRef.current;
    const prevNextId = prevNextSongIdRef.current;

    const isFirstLoad = prevNextId === null && prevLength === 0;

    if (next && !isFirstLoad) {
      if (next.id !== prevNextId) {
        triggerQueueHighlight(next, true, 'A Seguir • Próxima Música no Palco');
      } else if (newLength > prevLength) {
        const newestItem = freshTvData.queue[newLength - 1];
        triggerQueueHighlight(
          newestItem,
          newLength === 1,
          newLength === 1 ? 'A Seguir • Próxima Música no Palco' : `Fila Atualizada • ${newLength}ª Posição`
        );
      }
    }

    prevNextSongIdRef.current = next ? next.id : null;
    prevQueueLengthRef.current = newLength;
  };

  const fetchTVSession = async (): Promise<TVSessionDTO | null> => {
    try {
      const res = await fetch('/api/v1/tv/session');
      if (!res.ok) return null;
      const json = await res.json();
      if (json && json.success) {
        setTvData(json.data);
        checkAndTriggerHighlight(json.data);

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
        return json.data;
      }
    } catch {
      // Reconexão transitória
    }
    return null;
  };

  const playMaiaAudio = (audioBase64?: string | null, mimeType = 'audio/wav', speechText?: string) => {
    if (audioBase64) {
      try {
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        audio.volume = 1.0;
        audio.play().then(() => {
          setAudioUnlocked(true);
        }).catch((err) => {
          console.warn('[TV] Autoplay de áudio MaIA bloqueado pelo navegador:', err);
        });
        return;
      } catch (e) {
        console.warn('[TV] Erro ao instanciar áudio:', e);
      }
    }

    if (speechText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(speechText);
        utter.lang = 'pt-BR';
        utter.rate = 1.0;
        utter.pitch = 1.05;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        // silent
      }
    }
  };

  // Real-time listener for WebSocket queue updates and MaIA Voice announcements
  useEffect(() => {
    if (!lastQueueEvent) return;

    // 1. Processa anúncios de voz nativos da MaIA
    const announcement = lastQueueEvent.maiaAnnouncement;
    const eventType = lastQueueEvent.event;

    if (eventType === 'participant.turn_called' || announcement?.callType === 'INITIAL' || announcement?.callType === 'CALL') {
      const singer = announcement?.participantDisplayName || lastQueueEvent.callingState?.participantDisplayName || lastQueueEvent.item?.participantDisplayName || 'Próximo Cantor';
      const isDuet = announcement?.isDuet || lastQueueEvent.callingState?.isDuet;
      const partner = announcement?.partnerDisplayName || lastQueueEvent.callingState?.partnerDisplayName;
      const songTitle = announcement?.musicTitle || lastQueueEvent.callingState?.musicTitle || lastQueueEvent.item?.musicTitle;
      const songArtist = announcement?.musicArtist || lastQueueEvent.callingState?.musicArtist || lastQueueEvent.item?.musicArtist;
      const songFull = songTitle && songArtist ? `${songTitle} • ${songArtist}` : songTitle || '';
      const speech = announcement?.speechText || (isDuet && partner
        ? `${singer} e ${partner}, chegou a sua vez! Preparem-se para cantar ${songTitle || 'no palco'}.`
        : `${singer}, chegou a sua vez! Prepare-se para cantar ${songTitle || 'no palco'}.`);

      if (maiaNoticeTimerRef.current) clearTimeout(maiaNoticeTimerRef.current);
      setActiveMaiaNotice({
        id: `maia-call-${Date.now()}`,
        badge: isDuet ? 'MAIA • DUETO CONVOCADO' : 'MAIA • CONVOCAÇÃO VOCAL',
        singer: isDuet && partner ? `${singer} & ${partner}` : singer,
        song: songFull,
        speechText: speech,
        visualText: announcement?.visualText || 'SUA VEZ NO PALCO!',
        callType: 'CALL',
        audioBase64: announcement?.audioBase64,
        mimeType: announcement?.mimeType || 'audio/wav'
      });

      playMaiaAudio(announcement?.audioBase64, announcement?.mimeType, speech);
      maiaNoticeTimerRef.current = setTimeout(() => {
        setActiveMaiaNotice(null);
      }, 7500);
    } else if (eventType === 'participant.turn_missed' || announcement?.callType === 'FIRST_ABSENCE') {
      const singer = announcement?.participantDisplayName || lastQueueEvent.item?.participantDisplayName || 'Cantor';
      const speech = announcement?.speechText || `${singer}, estamos esperando você no palco. Prepare-se para começar!`;

      if (maiaNoticeTimerRef.current) clearTimeout(maiaNoticeTimerRef.current);
      setActiveMaiaNotice({
        id: `maia-missed-1-${Date.now()}`,
        badge: 'MAIA • 1ª AUSÊNCIA (30s RESTANTES)',
        singer,
        speechText: speech,
        visualText: 'AGUARDANDO CANTOR NA MESA',
        callType: 'FIRST_ABSENCE',
        audioBase64: announcement?.audioBase64,
        mimeType: announcement?.mimeType || 'audio/wav'
      });

      playMaiaAudio(announcement?.audioBase64, announcement?.mimeType, speech);
      maiaNoticeTimerRef.current = setTimeout(() => {
        setActiveMaiaNotice(null);
      }, 7500);
    } else if (eventType === 'participant.turn_missed_again' || announcement?.callType === 'SECOND_ABSENCE') {
      const singer = announcement?.participantDisplayName || lastQueueEvent.item?.participantDisplayName || 'Cantor';
      const speech = announcement?.speechText || `${singer} não compareceu à mesa. Vamos chamar o próximo cantor da fila!`;

      if (maiaNoticeTimerRef.current) clearTimeout(maiaNoticeTimerRef.current);
      setActiveMaiaNotice({
        id: `maia-missed-2-${Date.now()}`,
        badge: 'MAIA • MÚSICA REENFILEIRADA',
        singer,
        speechText: speech,
        visualText: 'CONVOCANDO PRÓXIMO DA FILA',
        callType: 'SECOND_ABSENCE',
        audioBase64: announcement?.audioBase64,
        mimeType: announcement?.mimeType || 'audio/wav'
      });

      playMaiaAudio(announcement?.audioBase64, announcement?.mimeType, speech);
      maiaNoticeTimerRef.current = setTimeout(() => {
        setActiveMaiaNotice(null);
      }, 7500);
    } else if (eventType === 'maia.voice.started' || (announcement && announcement.speechText)) {
      const speech = announcement?.speechText || lastQueueEvent.message || '';
      if (speech) {
        if (maiaNoticeTimerRef.current) clearTimeout(maiaNoticeTimerRef.current);
        setActiveMaiaNotice({
          id: `maia-shout-${Date.now()}`,
          badge: 'MAIA • AVISO DA MESA DE SOM',
          speechText: speech,
          visualText: announcement?.visualText || 'COMUNICADO AO VIVO',
          callType: 'ANNOUNCEMENT',
          audioBase64: announcement?.audioBase64,
          mimeType: announcement?.mimeType || 'audio/wav'
        });

        playMaiaAudio(announcement?.audioBase64, announcement?.mimeType, speech);
        maiaNoticeTimerRef.current = setTimeout(() => {
          setActiveMaiaNotice(null);
        }, 7500);
      }
    }

    // 2. Sincronização geral de dados sanitizados da TV
    if (lastQueueEvent.tv) {
      setTvData(lastQueueEvent.tv);
      checkAndTriggerHighlight(lastQueueEvent.tv);
    } else {
      fetchTVSession().then((freshData) => {
        if (freshData && lastQueueEvent.item) {
          const isFirst = freshData.queue.length > 0 && freshData.queue[0].id === lastQueueEvent.item.id;
          triggerQueueHighlight(
            lastQueueEvent.item,
            isFirst,
            isFirst ? 'A Seguir • Próxima Música no Palco' : 'Nova Música • Fila Atualizada'
          );
        }
      });
    }
  }, [lastQueueEvent]);


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
          {tvData?.branding?.logoUrl ? (
            <img
              src={tvData.branding.logoUrl}
              alt={tvData.branding.businessName || 'Logo'}
              className="h-10 max-w-[150px] object-contain rounded-lg p-0.5 bg-black/40 border border-white/10"
            />
          ) : (
            <div className="relative flex-shrink-0">
              <VozPlayMascotIcon
                size={42}
                animated
                themeColor={tvData?.branding?.primaryColor}
              />
            </div>
          )}
          <div>
            <h1 className="font-black text-lg tracking-wider text-white">
              {tvData?.branding?.businessName || tvData?.establishmentName || 'VOZPLAY TV'}
            </h1>
            <span className="text-xs text-slate-400">
              {tvData?.branding?.slogan || 'Karaokê Profissional & Lounge'}
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

      {/* SECTION 27 & 40: CELEBRATION & VISUAL TRANSITION SCREEN BETWEEN SONGS */}
      {isTransitioning ? (
        <div className="relative z-20 my-auto py-8 sm:py-12 flex flex-col items-center max-w-4xl mx-auto w-full text-center animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-pink-500/20 to-purple-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 mb-5 shadow-2xl shadow-amber-500/25 backdrop-blur-md">
            <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-amber-400" style={{ animationDuration: '4s' }} />
          </div>

          <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-400 mb-1">
            Show Concluído com Sucesso!
          </span>

          {completedPerformance && (
            <div className="space-y-3 mb-6">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight">
                {completedPerformance.isDuet ? 'Parabéns à Dupla, ' : 'Parabéns, '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400">
                  {completedPerformance.singer}
                </span>!
              </h2>
              <p className="text-sm sm:text-lg text-slate-300">
                {completedPerformance.isDuet ? 'Vocês cantaram: ' : 'Você cantou: '}
                <strong className="text-white font-semibold">{completedPerformance.title}</strong> — <span className="text-purple-300">{completedPerformance.artist}</span>
              </p>

              {/* Pontuação & Aplausômetro */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
                <div className="px-5 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 shadow-xl">
                  <span className="text-xs uppercase font-bold text-amber-300">Pontuação VozPlay:</span>
                  <span className="text-2xl sm:text-3xl font-mono font-black text-amber-300">{completedPerformance.score}</span>
                  <span className="text-xs text-amber-400/80 font-bold">/100 pts</span>
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs font-black tracking-wide">
                  {completedPerformance.badge}
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-black flex items-center gap-1.5">
                  <span>👏</span>
                  <span>{completedPerformance.applauseCount} Aplausos da Galera</span>
                </div>
              </div>
            </div>
          )}

          {nextSong ? (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-[#11162a]/90 to-[#19102c]/90 border border-purple-500/30 backdrop-blur-xl max-w-xl w-full shadow-2xl space-y-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-purple-400 block">
                Prepare seu Microfone:
              </span>
              <h3 className="text-xl sm:text-3xl font-display font-black text-white">
                {getSingerDisplayName(nextSong)}
              </h3>
              <p className="text-sm sm:text-base text-slate-300">
                {nextSong.title} — <span className="text-purple-300 font-semibold">{nextSong.artist}</span>
              </p>
              <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-xl bg-white/10 text-white font-mono text-sm font-bold">
                <span>Iniciando em:</span>
                <span className="text-pink-400 text-lg font-black">{transitionCountdown}s</span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-[#0c101d]/90 border border-white/10 backdrop-blur-xl max-w-md w-full shadow-2xl space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 block">
                Fila de Músicas Livre!
              </span>
              <p className="text-sm text-slate-300">
                Aponte a câmera para o QR Code da mesa e mande a sua música para o palco!
              </p>
            </div>
          )}
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
                  {getSingerDisplayName(currentSong)}
                </h2>
                {currentSong.isDuet && currentSong.partnerDisplayName && (
                  <div className="flex justify-center mt-1">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-pink-500/25 border border-pink-500/40 text-pink-300 shadow-md">
                      <Users className="w-3.5 h-3.5 text-pink-400" />
                      Apresentação em Dupla (Dueto)
                    </span>
                  </div>
                )}
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
          ) : tvData?.callingState ? (
            /* PRD: CALLING PARTICIPANT STAGE SCREEN (30-SECOND WINDOW) */
            <div className="text-center py-10 px-6 sm:px-14 rounded-3xl bg-gradient-to-b from-[#180d24]/95 via-[#0d0a1c]/95 to-[#080714]/95 border-2 border-amber-500/60 backdrop-blur-2xl max-w-4xl w-full shadow-2xl relative overflow-hidden ring-4 ring-amber-500/20 animate-pulse-subtle">
              {/* Pulsing spotlight effect */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                {/* Header Badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-300 text-xs sm:text-base font-black uppercase tracking-widest shadow-xl shadow-amber-500/25 animate-bounce">
                  <Megaphone className="w-5 h-5 text-amber-300" />
                  <span>Atenção: Chamando ao Palco!</span>
                </div>

                {/* Singer Name */}
                <div className="space-y-2">
                  <h1 className="text-4xl sm:text-6xl md:text-7xl font-display font-black text-white tracking-tight drop-shadow-2xl">
                    {tvData.callingState.participantDisplayName}
                    {tvData.callingState.isDuet && tvData.callingState.partnerDisplayName && (
                      <span className="block text-pink-300 text-3xl sm:text-5xl mt-1 font-bold">
                        & {tvData.callingState.partnerDisplayName}
                      </span>
                    )}
                  </h1>

                  {tvData.callingState.isDuet && (
                    <div className="flex justify-center">
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-pink-500/25 border border-pink-500/40 text-pink-300">
                        <Users className="w-3.5 h-3.5 text-pink-400" />
                        Apresentação em Dueto (2 Microfones)
                      </span>
                    </div>
                  )}

                  <div className="text-xl sm:text-3xl text-slate-200 font-bold pt-2">
                    {tvData.callingState.musicTitle} — <span className="text-amber-300">{tvData.callingState.musicArtist}</span>
                  </div>
                </div>

                {/* Big Circular Countdown */}
                <div className="py-2 flex flex-col items-center justify-center">
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-amber-500/30 animate-ping opacity-30" />
                    <div className="w-full h-full rounded-full border-4 border-amber-400 bg-gradient-to-tr from-amber-950/80 to-purple-950/80 flex flex-col items-center justify-center shadow-2xl shadow-amber-500/30">
                      <span className="text-4xl sm:text-6xl font-display font-black text-white font-mono leading-none">
                        {callingSeconds}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 mt-1">
                        Segundos
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-amber-200/90 mt-3">
                    Janela de presença física: dirija-se ao microfone!
                  </p>
                </div>

                {/* Call to action for the singer */}
                <div className="p-4 rounded-2xl bg-black/40 border border-white/10 max-w-xl mx-auto space-y-1.5">
                  <div className="flex items-center justify-center gap-2 text-white font-black text-xs sm:text-sm">
                    <Mic2 className="w-4 h-4 text-pink-400 animate-pulse" />
                    <span>Toque em &quot;COMEÇAR A CANTAR&quot; no seu smartphone</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    O sistema aguarda a sua confirmação no celular para soltar a música e a letra sincronizada.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* IDLE / WAITING SCREEN */
            <div className="text-center py-12 px-6 sm:px-12 rounded-3xl bg-[#0d1222]/85 border border-white/10 backdrop-blur-xl max-w-3xl w-full shadow-2xl relative overflow-hidden ring-1 ring-white/10">
              <div className="absolute -top-20 -left-20 w-56 h-56 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-20 w-56 h-56 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <div className="relative mx-auto flex flex-col items-center justify-center">
                  <div className="relative p-2 rounded-3xl bg-blue-600/10 border border-blue-500/30 backdrop-blur-md shadow-2xl shadow-blue-500/20">
                    <VozPlayMascotIcon
                      size={100}
                      animated
                      themeColor={tvData?.branding?.primaryColor}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-display font-black text-white mb-2 tracking-tight">
                    Palco Aberto • {tvData?.branding?.businessName || tvData?.establishmentName || 'VozPlay'}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
                    {tvData?.branding?.slogan ? `"${tvData.branding.slogan}" — ` : ''}Aponte a câmera do seu celular para o QR Code da sua mesa, acesse o catálogo completo e escolha a sua música para cantar na TV!
                  </p>
                </div>

                {tvQrUrl && (
                  <div className="inline-block p-3.5 bg-white rounded-2xl shadow-2xl shadow-purple-500/20 ring-4 ring-purple-500/20">
                    <img src={tvQrUrl} alt="QR Code da Mesa" className="w-36 h-36 sm:w-44 sm:h-44 object-contain rounded-lg" />
                    <span className="block text-[10px] font-black uppercase tracking-wider text-slate-800 mt-1">
                      Mesa • Conecte-se
                    </span>
                  </div>
                )}

                <AnimatePresence mode="wait">
                  {nextSong && (
                    <motion.div
                      key={nextSong.id}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        boxShadow: isNextSongHighlighted
                          ? '0 0 30px rgba(236,72,153,0.35)'
                          : '0 10px 25px -5px rgba(0,0,0,0.3)'
                      }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className={`p-4 rounded-2xl border max-w-md mx-auto text-left shadow-xl flex items-center justify-between transition-colors duration-500 ${
                        isNextSongHighlighted
                          ? 'bg-gradient-to-r from-purple-900/80 via-pink-900/70 to-slate-900/80 border-pink-500/60 ring-1 ring-pink-500/40'
                          : 'bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border-purple-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 block">
                            A Seguir no Palco:
                          </span>
                          {isNextSongHighlighted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pink-500/25 text-pink-300 border border-pink-500/40 text-[9px] font-bold uppercase animate-pulse">
                              <Sparkles className="w-2.5 h-2.5" />
                              Atualizado
                            </span>
                          )}
                        </div>
                        <span className="text-base font-display font-black text-white block mt-0.5">
                          {getSingerDisplayName(nextSong)}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          {nextSong.title} • <span className="text-purple-300">{nextSong.artist}</span>
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        1° da Fila
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FOOTER BAR: Next Song + Upcoming Queue Ticker + Mini QR Code */}
      <div className="relative z-10 border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Next singer banner with smooth transition & highlight glow */}
        <motion.div
          animate={
            isNextSongHighlighted
              ? {
                  scale: [1, 1.02, 1],
                  boxShadow: [
                    '0 0 0px rgba(236,72,153,0)',
                    '0 0 24px rgba(236,72,153,0.4)',
                    '0 0 6px rgba(168,85,247,0.2)'
                  ]
                }
              : {}
          }
          transition={{ duration: 1.4, repeat: isNextSongHighlighted ? 3 : 0 }}
          className={`flex items-center gap-3.5 px-3.5 py-2 rounded-2xl border transition-all duration-500 ${
            isNextSongHighlighted
              ? 'bg-gradient-to-r from-purple-950/90 via-pink-950/80 to-slate-900/90 border-pink-500/70'
              : 'bg-white/[0.04] border-white/[0.08]'
          }`}
        >
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                isNextSongHighlighted
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/40'
                  : 'bg-white/10 text-indigo-400'
              }`}
            >
              {nextSong ? '2°' : '—'}
            </div>
            {isNextSongHighlighted && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                A Seguir:
              </span>
              {isNextSongHighlighted && (
                <span className="inline-flex items-center gap-1 text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" />
                  Próxima
                </span>
              )}
            </div>
            <AnimatePresence mode="wait">
              {nextSong ? (
                <motion.div
                  key={nextSong.id}
                  initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2 truncate"
                >
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {getSingerDisplayName(nextSong)}
                  </span>
                  <span className="text-xs text-purple-300 font-medium truncate">
                    • {nextSong.title}
                  </span>
                  <span className="text-[11px] text-slate-400 hidden xl:inline">
                    ({nextSong.artist})
                  </span>
                </motion.div>
              ) : (
                <motion.span
                  key="empty-queue"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs sm:text-sm font-medium text-slate-400"
                >
                  Fila livre para novas músicas
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Up to 3 upcoming songs ticker with fluid staggered motion */}
        {tvData?.queue && tvData.queue.length > 1 && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Próximos:</span>
            <div className="flex items-center gap-1.5 overflow-hidden">
              <AnimatePresence initial={false}>
                {tvData.queue.slice(1, 4).map((q, idx) => (
                  <motion.span
                    key={q.id}
                    initial={{ opacity: 0, scale: 0.9, x: 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -12 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span className="text-pink-400 font-mono font-bold text-[10px]">{idx + 3}º</span>
                    <span className="text-white font-medium">{getSingerDisplayName(q)}</span>
                    <span className="text-slate-400 text-[11px]">({q.title})</span>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Mini QR Code corner prompt */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 shadow-lg">
          {tvQrUrl ? (
            <img src={tvQrUrl} alt="QR Code TV" className="w-8 h-8 rounded-lg bg-white p-0.5 shadow-sm" />
          ) : (
            <QrCode className="w-5 h-5 text-pink-400" />
          )}
          <div className="text-left text-[11px] leading-tight">
            <span className="text-slate-200 font-bold block">Peça sua música</span>
            <span className="text-pink-400 font-mono text-[10px]">Aponte a câmera</span>
          </div>
        </div>
      </div>

      {/* Real-Time Queue Transition & Next Song Highlight Card on TV */}
      <AnimatePresence>
        {queueHighlightNotice && (
          <motion.div
            key={queueHighlightNotice.id}
            initial={{ opacity: 0, y: -30, scale: 0.94, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-20 right-6 sm:right-10 z-50 max-w-md w-full pointer-events-none"
          >
            <div className="relative overflow-hidden rounded-3xl bg-[#0b0f1e]/95 border border-pink-500/40 p-4 sm:p-5 shadow-2xl shadow-purple-950/70 backdrop-blur-2xl ring-1 ring-white/10">
              {/* Subtle ambient lighting */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/30 shrink-0">
                  <Mic2 className="w-6 h-6 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[10px] font-black uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-pink-400" />
                      <span>{queueHighlightNotice.positionText}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Tempo Real</span>
                  </div>
                  <h4 className="text-lg sm:text-xl font-display font-black text-white truncate tracking-tight">
                    {getSingerDisplayName(queueHighlightNotice)}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-200 truncate font-medium mt-0.5">
                    {queueHighlightNotice.title} <span className="text-purple-300 font-semibold">• {queueHighlightNotice.artist}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-300">
                      {queueHighlightNotice.versionStyle}
                    </span>
                    {queueHighlightNotice.toneOffset !== undefined && queueHighlightNotice.toneOffset !== 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold text-[10px]">
                        Tom: {queueHighlightNotice.toneOffset > 0 ? `+${queueHighlightNotice.toneOffset}` : queueHighlightNotice.toneOffset}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress timer bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6.5, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-pink-500 to-purple-600"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                 activeSoundBanner.soundType === 'cheer' ? '🎉' :
                 activeSoundBanner.soundType === 'whistle' ? '😙🎶' :
                 activeSoundBanner.soundType === 'crowd' ? '🙌🔥' :
                 activeSoundBanner.soundType === 'rimshot' ? '🥁✨' :
                 activeSoundBanner.soundType === 'laser' ? '⚡' :
                 activeSoundBanner.soundType === 'vinheta' ? '✨' : '👎'}
              </span>
              <span className="tracking-wide">DJ EFEITO: {activeSoundBanner.label}!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NATIVE MAIA VOICE ANNOUNCEMENT CARD ON TV (Seção 8, 9, 10, 12) */}
      <AnimatePresence>
        {activeMaiaNotice && (
          <motion.div
            key={activeMaiaNotice.id}
            initial={{ opacity: 0, y: -60, scale: 0.9, filter: 'blur(12px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -40, scale: 0.95, filter: 'blur(8px)' }}
            transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[70] max-w-2xl w-[94%] sm:w-auto pointer-events-none"
          >
            <div className="relative overflow-hidden rounded-3xl bg-[#080c1a]/95 border-2 border-purple-500/50 p-6 sm:p-7 shadow-[0_25px_70px_rgba(147,51,234,0.4)] backdrop-blur-2xl ring-2 ring-white/10 text-white">
              {/* Dynamic ambient background glow */}
              <div className="absolute -top-16 -right-16 w-52 h-52 bg-purple-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
              <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-pink-500/25 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-start gap-5">
                {/* MaIA Animated Avatar & Waveforms */}
                <div className="relative shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/40 ring-4 ring-purple-400/20">
                    <Sparkles className="w-9 h-9 sm:w-11 sm:h-11 animate-pulse" />
                  </div>
                  {/* Waveform indicator */}
                  <div className="absolute -bottom-2 inset-x-0 flex items-center justify-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-purple-400/40">
                    <span className="w-1 h-3 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-bounce" />
                    <span className="w-1 h-3.5 bg-purple-300 rounded-full animate-bounce [animation-delay:-0.2s]" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-black uppercase tracking-wider shadow-sm">
                      <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                      <span>{activeMaiaNotice.badge}</span>
                    </span>
                    <span className="text-xs font-mono text-purple-300/80 bg-purple-950/40 px-2.5 py-0.5 rounded-md border border-purple-500/20">
                      Voz Feminina Nativa (pt-BR)
                    </span>
                  </div>

                  {activeMaiaNotice.singer && (
                    <h3 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight leading-tight">
                      {activeMaiaNotice.singer}
                    </h3>
                  )}

                  {activeMaiaNotice.song && (
                    <p className="text-sm sm:text-base text-purple-200 font-semibold mt-0.5 truncate">
                      {activeMaiaNotice.song}
                    </p>
                  )}

                  <p className="text-sm sm:text-base text-slate-200 mt-2 font-medium leading-snug bg-white/[0.04] p-3 rounded-xl border border-white/10">
                    "{activeMaiaNotice.speechText}"
                  </p>
                </div>
              </div>

              {/* Progress timer bar */}
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 7.5, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Unlock Button for Browsers with strict autoplay */}
      {!audioUnlocked && (
        <button
          onClick={() => {
            setAudioUnlocked(true);
            const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A');
            silent.play().catch(() => {});
          }}
          className="fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-full bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md transition shadow-lg pointer-events-auto"
          title="Clique para habilitar áudio automático das chamadas vocais"
        >
          <Volume2 className="w-3.5 h-3.5 text-purple-300" />
          <span>Habilitar Áudio da MaIA</span>
        </button>
      )}

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
