/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Página Pública de Acompanhamento da Vez (PRD Seção 43)
 * Link Compartilhável Seguro: vozplay.ai.slz.br/v/:queueItemId
 * Sem login nem vazamento de dados privados.
 */

import React, { useState, useEffect } from 'react';
import {
  Mic2,
  Clock,
  Music2,
  CheckCircle2,
  Share2,
  Sparkles,
  ArrowRight,
  Flame,
  Radio,
  ExternalLink,
  Bell,
  AlertCircle
} from 'lucide-react';

interface TurnTrackerProps {
  queueItemId: string;
  onGoToParticipant?: () => void;
  onClose?: () => void;
}

interface ShareData {
  id: string;
  participantDisplayName: string;
  musicTitle: string;
  musicArtist: string;
  versionStyle: string;
  toneOffset?: number;
  status: 'QUEUED' | 'PLAYING' | 'COMPLETED' | 'CANCELLED';
  positionInQueue: string | number;
  estimatedWaitMinutes: number;
  establishmentName: string;
  sessionStatus: string;
  domain: string;
}

export const TurnTrackerView: React.FC<TurnTrackerProps> = ({
  queueItemId,
  onGoToParticipant,
  onClose
}) => {
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchShareStatus();
    const interval = setInterval(fetchShareStatus, 3000);
    return () => clearInterval(interval);
  }, [queueItemId]);

  const fetchShareStatus = async () => {
    try {
      const res = await fetch(`/api/v1/queue/share/${queueItemId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.success && json.data) {
        setData(json.data);
        setError(null);
      } else if (json && json.error) {
        setError(json.error);
      }
    } catch {
      // Reconexão transitória
    } finally {
      setLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!data) return;
    const text = encodeURIComponent(
      `🎤 Acompanhe a vez de ${data.participantDisplayName} cantar "${data.musicTitle}" no ${data.establishmentName}: https://vozplay.ai.slz.br/v/${data.id}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!data) return;
    navigator.clipboard.writeText(
      `🎤 Acompanhe a vez de ${data.participantDisplayName} cantar "${data.musicTitle}": https://vozplay.ai.slz.br/v/${data.id}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 animate-pulse">
            <Mic2 className="w-8 h-8" />
          </div>
          <div className="absolute inset-0 rounded-2xl border-2 border-pink-400 animate-ping opacity-25" />
        </div>
        <p className="text-base font-display font-black text-white">Carregando acompanhamento ao vivo...</p>
        <p className="text-xs text-slate-400 mt-1">VOZPLAY • Transmissão em tempo real de palco</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-5 animate-in fade-in">
        <div className="w-20 h-20 rounded-3xl bg-[#0d1222] border border-white/10 text-slate-400 flex items-center justify-center mx-auto shadow-2xl ring-1 ring-white/5">
          <Music2 className="w-10 h-10 text-purple-400" />
        </div>
        <h3 className="text-xl font-display font-black text-white">Apresentação Não Localizada</h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
          {error || 'Esta apresentação pode ter sido finalizada ou o link expirou.'}
        </p>
        {onGoToParticipant && (
          <button
            onClick={onGoToParticipant}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs shadow-xl shadow-purple-600/30 transition inline-flex items-center gap-2 active:scale-95"
          >
            <span>Pedir Música no Palco</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  const isPlaying = data.status === 'PLAYING';
  const isCompleted = data.status === 'COMPLETED';
  const isNext = !isCompleted && !isPlaying && (data.positionInQueue === 1 || data.positionInQueue === '1º da fila' || data.positionInQueue === 'Próxima na fila');

  // Trigger subtle haptic vibration when participant becomes next (PRD Seção 4.2)
  useEffect(() => {
    if (isNext && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {
        // vibration not allowed or unsupported
      }
    }
  }, [isNext]);

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      {/* Top Bar with Venue */}
      <div className="flex items-center justify-between text-xs pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-white tracking-wide">{data.establishmentName || 'VozPlay Lounge & Bar'}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-300 hover:text-white transition px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 font-bold active:scale-95"
          >
            Voltar
          </button>
        )}
      </div>

      {/* Prepare seu Microfone Alert Banner (PRD Seções 4.2 e 32) */}
      {isNext && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 border-2 border-amber-400/60 shadow-xl shadow-amber-500/10 text-center animate-pulse space-y-1">
          <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-sm uppercase tracking-wider">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>Prepare seu Microfone!</span>
          </div>
          <p className="text-xs text-white font-medium">
            Você é o próximo a cantar! Aproxime-se do palco ou da cabine de som.
          </p>
        </div>
      )}

      {/* Main Status Hero Card (VIP Concert Pass) */}
      <div
        className={`rounded-3xl border p-6 sm:p-7 text-center relative overflow-hidden shadow-2xl transition-all ring-1 ${
          isPlaying
            ? 'bg-gradient-to-b from-[#1c0f2a] via-[#120c1f] to-[#090b14] border-pink-500/50 shadow-pink-500/20 ring-pink-500/30'
            : isCompleted
            ? 'bg-[#0d1222] border-white/10 ring-white/5'
            : 'bg-gradient-to-b from-[#12132e] via-[#0d1222] to-[#080c16] border-purple-500/40 shadow-purple-500/10 ring-purple-500/20'
        }`}
      >
        {/* Stage lighting glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-purple-500/20 to-transparent rounded-full blur-2xl pointer-events-none" />

        {/* Glow Status Tag */}
        <div className="inline-flex items-center gap-2 mb-5">
          {isPlaying ? (
            <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg shadow-pink-500/20 animate-pulse">
              <Radio className="w-3.5 h-3.5 text-pink-400" />
              Ao Vivo no Palco Agora!
            </span>
          ) : isCompleted ? (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Apresentação Concluída
            </span>
          ) : (
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-lg shadow-purple-500/20">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Aguardando na Fila
            </span>
          )}
        </div>

        {/* Live Audio Equalizer Animation for Active Song */}
        {isPlaying && (
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <span className="w-1.5 h-5 bg-pink-500 rounded-full animate-equalizer" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-8 bg-purple-400 rounded-full animate-equalizer" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-10 bg-amber-400 rounded-full animate-equalizer" style={{ animationDelay: '300ms' }} />
            <span className="w-1.5 h-7 bg-pink-400 rounded-full animate-equalizer" style={{ animationDelay: '100ms' }} />
            <span className="w-1.5 h-4 bg-purple-500 rounded-full animate-equalizer" style={{ animationDelay: '250ms' }} />
          </div>
        )}

        {/* Singer Name */}
        <div className="text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-1">
          Cantor(a) da Apresentação
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
          {data.participantDisplayName}
        </h2>

        {/* Song Info Card */}
        <div className="mt-5 p-4 rounded-2xl bg-[#080c16]/80 border border-white/[0.08] backdrop-blur-md space-y-1.5 shadow-inner">
          <div className="flex items-center justify-center gap-2 text-white font-display font-black text-lg sm:text-xl">
            <Mic2 className="w-5 h-5 text-pink-400 flex-shrink-0" />
            <span className="truncate">{data.musicTitle}</span>
          </div>
          <p className="text-xs text-slate-300 font-semibold">{data.musicArtist}</p>
          <div className="pt-1 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/[0.06] text-purple-300 border border-white/10">
              Estilo: {data.versionStyle}
            </span>
            {data.toneOffset !== undefined && data.toneOffset !== 0 ? (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Tom: {data.toneOffset > 0 ? `+${data.toneOffset}` : data.toneOffset} ST
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/[0.04] text-slate-400 border border-white/5">
                Tom Original
              </span>
            )}
          </div>
        </div>

        {/* Position / Estimate */}
        {!isCompleted && !isPlaying && (
          <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-white/[0.08]">
            <div className="p-3.5 rounded-2xl bg-[#080c16] border border-white/[0.08] shadow-inner">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Posição Atual</span>
              <div className="text-xl font-display font-black text-purple-300 mt-0.5">
                {typeof data.positionInQueue === 'number' ? `${data.positionInQueue}ª da fila` : data.positionInQueue}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#080c16] border border-white/[0.08] shadow-inner">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tempo Previsto</span>
              <div className="text-xl font-display font-black text-amber-300 mt-0.5">
                ~{data.estimatedWaitMinutes} min
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share / WhatsApp Actions */}
      <div className="space-y-2.5">
        <button
          onClick={handleShareWhatsApp}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 active:scale-95"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Avisar Amigos pelo WhatsApp</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="w-full py-3 px-4 rounded-2xl bg-[#0d1222] hover:bg-[#13192f] border border-white/10 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 active:scale-95 shadow-md"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-purple-400" />}
          <span>{copied ? 'Link de Acompanhamento Copiado!' : 'Copiar Link da Apresentação'}</span>
        </button>
      </div>

      {/* Invitation Card to Sing */}
      <div className="rounded-3xl bg-gradient-to-br from-[#121028] via-[#0d1222] to-[#080c16] border border-pink-500/20 p-6 space-y-4 text-center ring-1 ring-white/5 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center mx-auto shadow-lg shadow-pink-500/10">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-display font-black text-white">Quer soltar a voz também?</h4>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Acesse o catálogo com milhares de sucessos e entre na fila rotativa da casa!
          </p>
        </div>

        {onGoToParticipant && (
          <button
            onClick={onGoToParticipant}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs shadow-xl shadow-purple-600/30 transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Flame className="w-4 h-4" />
            <span>Pedir Minha Música Agora</span>
          </button>
        )}
      </div>

      {/* Safety Notice (Zero Leakage) */}
      <div className="text-center text-[10px] text-slate-400 pt-1 font-medium">
        🔒 Página pública de acompanhamento seguro do VozPlay • Nenhum dado sensível compartilhado.
      </div>
    </div>
  );
};
