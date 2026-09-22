/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - DJ Soundboard & Broadcast Panel (PRD Section 47)
 * Permite ao operador de som acionar efeitos ao vivo que transmitem simultaneamente
 * para a TV e smartphones dos participantes via WebSockets.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  Radio,
  Headphones,
  CheckCircle2,
  Tv,
  Smartphone,
  Flame,
  Music4,
  RefreshCw,
  Zap,
  SlidersHorizontal,
  BellRing
} from 'lucide-react';
import { playDJAudioEffect } from '../../utils/synthAudio.js';

export interface SoundEffectItem {
  id: string;
  label: string;
  category: 'CROWD' | 'IMPACT' | 'STAGE';
  icon: string;
  desc: string;
  keyShortcut: string;
  tag: string;
  gradient: string;
  borderColor: string;
  activeColor: string;
}

const SOUND_EFFECTS: SoundEffectItem[] = [
  {
    id: 'applause',
    label: 'Aplausos',
    category: 'CROWD',
    icon: '👏',
    desc: 'Palmas e ovação de auditório após apresentação',
    keyShortcut: '1',
    tag: 'Plateia',
    gradient: 'from-pink-950/40 via-purple-950/20 to-[#090d18]',
    borderColor: 'border-pink-500/30 hover:border-pink-500/70',
    activeColor: 'ring-pink-500 shadow-pink-500/30'
  },
  {
    id: 'whistle',
    label: 'Assobios & Festa',
    category: 'CROWD',
    icon: '😙🎶',
    desc: 'Assobios empolgados de torcida para animar o salão',
    keyShortcut: '2',
    tag: 'Torcida',
    gradient: 'from-amber-950/40 via-purple-950/20 to-[#090d18]',
    borderColor: 'border-amber-500/30 hover:border-amber-500/70',
    activeColor: 'ring-amber-500 shadow-amber-500/30'
  },
  {
    id: 'cheer',
    label: 'Gritos & Vitória',
    category: 'CROWD',
    icon: '🎉',
    desc: 'Fanfarra triunfal e comemoração de pontuação alta',
    keyShortcut: '3',
    tag: 'Celebração',
    gradient: 'from-emerald-950/40 via-teal-950/20 to-[#090d18]',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/70',
    activeColor: 'ring-emerald-500 shadow-emerald-500/30'
  },
  {
    id: 'crowd',
    label: 'Coro / Arerê',
    category: 'CROWD',
    icon: '🙌🔥',
    desc: 'Vozes da plateia em uníssono acompanhando o ritmo',
    keyShortcut: '4',
    tag: 'Coral',
    gradient: 'from-indigo-950/40 via-purple-950/20 to-[#090d18]',
    borderColor: 'border-indigo-500/30 hover:border-indigo-500/70',
    activeColor: 'ring-indigo-500 shadow-indigo-500/30'
  },
  {
    id: 'airhorn',
    label: 'Air Horn DJ',
    category: 'IMPACT',
    icon: '📣',
    desc: 'A clássica buzina de reggae e funk para queda de beat',
    keyShortcut: '5',
    tag: 'Destaque',
    gradient: 'from-rose-950/40 via-red-950/20 to-[#090d18]',
    borderColor: 'border-rose-500/30 hover:border-rose-500/70',
    activeColor: 'ring-rose-500 shadow-rose-500/30'
  },
  {
    id: 'drums',
    label: 'Rufar de Tambores',
    category: 'IMPACT',
    icon: '🥁',
    desc: 'Suspense dramático antes de notas e premiação',
    keyShortcut: '6',
    tag: 'Suspense',
    gradient: 'from-yellow-950/40 via-amber-950/20 to-[#090d18]',
    borderColor: 'border-yellow-500/30 hover:border-yellow-500/70',
    activeColor: 'ring-yellow-500 shadow-yellow-500/30'
  },
  {
    id: 'rimshot',
    label: 'Ba-Dum-Tss',
    category: 'IMPACT',
    icon: '🥁✨',
    desc: 'Punchline para momentos engraçados e piadas no palco',
    keyShortcut: '7',
    tag: 'Comédia',
    gradient: 'from-cyan-950/40 via-blue-950/20 to-[#090d18]',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/70',
    activeColor: 'ring-cyan-500 shadow-cyan-500/30'
  },
  {
    id: 'boo',
    label: 'Uhhh / Vaia Amiga',
    category: 'IMPACT',
    icon: '👎',
    desc: 'Trote cômico e bem-humorado para desafinadas',
    keyShortcut: '8',
    tag: 'Descontraído',
    gradient: 'from-slate-900/60 via-zinc-950/40 to-[#090d18]',
    borderColor: 'border-slate-600/30 hover:border-slate-400/60',
    activeColor: 'ring-slate-400 shadow-slate-500/30'
  },
  {
    id: 'vinheta',
    label: 'Jingle VozPlay',
    category: 'STAGE',
    icon: '✨',
    desc: 'Vinheta oficial futurista de abertura e encerramento',
    keyShortcut: '9',
    tag: 'Oficial',
    gradient: 'from-purple-950/40 via-pink-950/20 to-[#090d18]',
    borderColor: 'border-purple-500/30 hover:border-purple-500/70',
    activeColor: 'ring-purple-500 shadow-purple-500/30'
  },
  {
    id: 'laser',
    label: 'Laser Drop',
    category: 'STAGE',
    icon: '⚡',
    desc: 'Varredura sci-fi de transição rápida entre performances',
    keyShortcut: '0',
    tag: 'Transição',
    gradient: 'from-fuchsia-950/40 via-indigo-950/20 to-[#090d18]',
    borderColor: 'border-fuchsia-500/30 hover:border-fuchsia-500/70',
    activeColor: 'ring-fuchsia-500 shadow-fuchsia-500/30'
  }
];

interface SoundboardPanelProps {
  tvConnected: boolean;
  onFeedback: (message: string, type: 'success' | 'error') => void;
}

export const SoundboardPanel: React.FC<SoundboardPanelProps> = ({
  tvConnected,
  onFeedback
}) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CROWD' | 'IMPACT' | 'STAGE'>('ALL');
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [triggerHistory, setTriggerHistory] = useState<Array<{ id: string; label: string; time: string }>>([]);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true);
  const [totalTriggersCount, setTotalTriggersCount] = useState(0);

  // Keyboard shortcut listener (1 to 9, 0)
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const match = SOUND_EFFECTS.find(s => s.keyShortcut === e.key);
      if (match) {
        e.preventDefault();
        handleBroadcastSound(match);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts]);

  // Trigger sound effect and broadcast to TV and all mobile participants
  const handleBroadcastSound = async (sound: SoundEffectItem) => {
    setBroadcastingId(sound.id);

    // Play locally on the operator's sound console
    try {
      playDJAudioEffect(sound.id);
    } catch (e) {
      console.warn('Falha na reprodução local:', e);
    }

    // Add to local trigger history
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTriggerHistory(prev => [
      { id: `${sound.id}-${Date.now()}`, label: sound.label, time: timeStr },
      ...prev.slice(0, 4)
    ]);
    setTotalTriggersCount(prev => prev + 1);

    // Broadcast through backend REST API -> WebSockets
    try {
      const res = await fetch('/api/v1/controller/soundboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soundType: sound.id,
          label: sound.label
        })
      });

      if (!res.ok) {
        throw new Error('Falha ao transmitir');
      }

      onFeedback(`Efeito "${sound.label}" transmitido ao vivo para TV & Celulares!`, 'success');
    } catch (err) {
      onFeedback('Aviso: Efeito tocou localmente, mas a transmissão via rede oscilou.', 'error');
    } finally {
      setTimeout(() => {
        setBroadcastingId(null);
      }, 1200);
    }
  };

  // Preview locally on headphones without broadcasting to lounge
  const handlePreviewSound = (sound: SoundEffectItem) => {
    setPreviewingId(sound.id);
    try {
      playDJAudioEffect(sound.id);
      onFeedback(`Pré-escuta local de "${sound.label}" (apenas fone/mesa).`, 'success');
    } catch (e) {
      console.warn('Erro ao testar:', e);
    }

    setTimeout(() => {
      setPreviewingId(null);
    }, 1000);
  };

  const filteredEffects = SOUND_EFFECTS.filter(effect => {
    if (activeCategory === 'ALL') return true;
    return effect.category === activeCategory;
  });

  return (
    <div className="rounded-3xl bg-[#0d1222]/95 border border-white/10 p-5 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl ring-1 ring-white/5 relative overflow-hidden">
      {/* Background Studio Glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-lg shadow-pink-500/20">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                DJ Soundboard Profissional
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
                Ao Vivo no Salão
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Dispare efeitos sonoros em tempo real sincronizados no <strong>Telão TV</strong> e nos <strong>smartphones da plateia</strong>.
            </p>
          </div>
        </div>

        {/* Global Broadcast Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-300">
            <Tv className={`w-3.5 h-3.5 ${tvConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-[11px] font-semibold">{tvConnected ? 'Telão TV Ativo' : 'TV Aguardando'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
            <Smartphone className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-semibold">Broadcast Mobile Sincronizado</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Categories & Quick Keyboard Toggle */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'Todos os Efeitos', count: SOUND_EFFECTS.length },
            { id: 'CROWD', label: 'Torcida & Vibração', count: 4 },
            { id: 'IMPACT', label: 'Impacto & Suspense', count: 4 },
            { id: 'STAGE', label: 'Palco & Identidade', count: 2 }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.05]'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Keyboard Shortcuts Prompt */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={enableKeyboardShortcuts}
              onChange={(e) => setEnableKeyboardShortcuts(e.target.checked)}
              className="rounded bg-slate-800 border-white/20 text-purple-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span className="text-[11px] font-medium">Atalhos de Teclado [1-9, 0]</span>
          </label>
        </div>
      </div>

      {/* Sound Effects Grid */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {filteredEffects.map((sound) => {
          const isBroadcasting = broadcastingId === sound.id;
          const isPreviewing = previewingId === sound.id;

          return (
            <div
              key={sound.id}
              className={`relative rounded-2xl bg-gradient-to-b ${sound.gradient} border ${sound.borderColor} p-4 transition-all duration-200 flex flex-col justify-between group shadow-lg ${
                isBroadcasting
                  ? `ring-2 ${sound.activeColor} scale-[1.02] bg-purple-900/60`
                  : 'hover:scale-[1.01]'
              }`}
            >
              {/* Top row: Emoji & Shortcut / Tag */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-3xl filter drop-shadow group-hover:scale-110 transition-transform">
                  {sound.icon}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black bg-white/[0.08] border border-white/10 text-slate-300">
                    [{sound.keyShortcut}]
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/[0.05] text-slate-400">
                    {sound.tag}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1 mb-3">
                <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors flex items-center justify-between">
                  <span>{sound.label}</span>
                  {isBroadcasting && (
                    <span className="text-[10px] text-pink-400 font-mono font-bold animate-pulse">
                      NO AR!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {sound.desc}
                </p>
              </div>

              {/* Action Buttons: Broadcast vs Preview */}
              <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2">
                <button
                  onClick={() => handleBroadcastSound(sound)}
                  disabled={isBroadcasting}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all ${
                    isBroadcasting
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-pink-500/40 ring-1 ring-white/30'
                      : 'bg-white/[0.08] hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 text-white hover:shadow-purple-600/30 border border-white/10'
                  }`}
                  title="Transmitir na TV e Dispositivos Móveis"
                >
                  <Radio className={`w-3.5 h-3.5 ${isBroadcasting ? 'animate-spin' : ''}`} />
                  <span>{isBroadcasting ? 'Transmitindo...' : 'Disparar'}</span>
                </button>

                <button
                  onClick={() => handlePreviewSound(sound)}
                  disabled={isPreviewing}
                  className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 text-slate-400 hover:text-white transition active:scale-95 shrink-0"
                  title="Pré-escuta local (Apenas fone/mesa)"
                >
                  <Headphones className={`w-3.5 h-3.5 ${isPreviewing ? 'text-amber-400 animate-pulse' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Live History & Activity Ticker */}
      <div className="relative z-10 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-400">
            <BellRing className="w-3.5 h-3.5 text-pink-400" />
            <span className="font-semibold text-slate-300">Últimos Disparos:</span>
          </div>

          {triggerHistory.length === 0 ? (
            <span className="text-slate-500 text-[11px]">Nenhum efeito disparado recentemente.</span>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
              {triggerHistory.map((item, idx) => (
                <span
                  key={item.id}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 whitespace-nowrap ${
                    idx === 0
                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-300'
                      : 'bg-white/[0.04] border-white/[0.06] text-slate-400'
                  }`}
                >
                  <span className="font-bold">{item.label}</span>
                  <span className="text-[9px] font-mono text-slate-500">{item.time}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto text-slate-400 font-mono text-[11px]">
          <span>Total disparados: <strong className="text-white">{totalTriggersCount}</strong></span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            Web Audio 0ms Latency
          </span>
        </div>
      </div>
    </div>
  );
};
