/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Painel de Playlist Recomendada por IA (Gemini)
 * Sugestões inteligentes de repertório com base no gênero musical
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Music2,
  Mic2,
  Flame,
  Heart,
  Play,
  Plus,
  Check,
  RefreshCw,
  ArrowLeft,
  Lightbulb,
  Zap,
  SlidersHorizontal,
  Volume2,
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Participant, RecommendedPlaylist, RecommendedTrack } from '../../types.js';

interface RecommendedPlaylistViewProps {
  participant: Participant;
  initialGenre?: string;
  catalog: Music[];
  wishlistIds: Set<string>;
  onSelectSongToSing: (music: Music, preferredToneOffset?: number) => void;
  onAddToWishlist: (music: Music, preferredToneOffset?: number) => void;
  onAddToPlaylist: (music: Music, preferredToneOffset?: number) => void;
  onRequestCustomSong: (prefillTitle?: string, prefillArtist?: string, prefillGenre?: string) => void;
  onBackToCatalog?: () => void;
}

const PRESET_GENRES = [
  { id: 'Sertanejo', label: 'Sertanejo', icon: '🤠', desc: 'Modão, Sofrência & Universitário' },
  { id: 'Pagode', label: 'Pagode', icon: '🥁', desc: 'Roda de Samba & Sucessos 90' },
  { id: 'Rock Nacional', label: 'Rock Nacional', icon: '🎸', desc: 'Anos 80, 90 & 2000' },
  { id: 'MPB / Bossa Nova', label: 'MPB / Bossa', icon: '🍷', desc: 'Voz, Violão & Poesia' },
  { id: 'Pop Internacional', label: 'Pop Internacional', icon: '✨', desc: 'Hits Mundiais & Divas' },
  { id: 'Classic Rock', label: 'Classic Rock', icon: '⚡', desc: 'Hinos de Estádio & Guitarras' },
  { id: 'Pop / Soul Nacional', label: 'Pop Nacional', icon: '🎤', desc: 'Balanço, Groove & Funk Melody' },
  { id: 'Forró / Piseiro', label: 'Forró / Piseiro', icon: '🪗', desc: 'Ritmo Nordestino & Dançante' },
  { id: 'Axé / Carnaval', label: 'Axé / Carnaval', icon: '🎉', desc: 'Energia de Micareta & Alegria' },
  { id: 'Anos 80 / Flashback', label: 'Anos 80 / Flashback', icon: '📼', desc: 'Nostalgia Pura & Sintetizadores' }
];

const PRESET_MOODS = [
  '🔥 Fervo Total (Refrões Explosivos)',
  '🍷 Intimista (Voz & Violão)',
  '💔 Sofrência (Para Cantar com Emoção)',
  '🎤 Desafio Vocal (Para Mostrar Afinação)',
  '👥 Em Grupo (Todo Mundo Canta Junto)'
];

export const RecommendedPlaylistView: React.FC<RecommendedPlaylistViewProps> = ({
  participant,
  initialGenre = 'Sertanejo',
  catalog,
  wishlistIds,
  onSelectSongToSing,
  onAddToWishlist,
  onAddToPlaylist,
  onRequestCustomSong,
  onBackToCatalog
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>(
    initialGenre && initialGenre !== 'Todos' ? initialGenre : 'Sertanejo'
  );
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [playlist, setPlaylist] = useState<RecommendedPlaylist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedAllSuccess, setAddedAllSuccess] = useState(false);
  const [customToneAdjustments, setCustomToneAdjustments] = useState<Record<string, number>>({});

  // Carrega playlist ao montar se houver gênero definido
  useEffect(() => {
    fetchRecommendations(selectedGenre, selectedMood);
  }, []);

  const fetchRecommendations = async (genreToFetch: string, moodToFetch?: string) => {
    const finalGenre = genreToFetch.trim() || 'Sertanejo';
    setIsLoading(true);
    setError(null);
    setAddedAllSuccess(false);

    try {
      const response = await fetch('/api/v1/recommendations/genre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genre: finalGenre,
          mood: moodToFetch || undefined,
          participantName: participant.displayName
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível gerar a recomendação.');
      }

      setPlaylist(data.data);
      // Inicializa offsets customizados com a sugestão da IA
      const initialTones: Record<string, number> = {};
      data.data.tracks.forEach((t: RecommendedTrack) => {
        initialTones[`${t.title}-${t.artist}`] = t.suggestedToneOffset;
      });
      setCustomToneAdjustments(initialTones);
    } catch (err: any) {
      console.error('[RecommendedPlaylistView] Erro:', err);
      setError(err.message || 'Erro ao conectar com o assistente Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (genreId: string) => {
    setSelectedGenre(genreId);
    setCustomGenreInput('');
    fetchRecommendations(genreId, selectedMood);
  };

  const handleApplyCustomGenre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGenreInput.trim()) return;
    setSelectedGenre(customGenreInput.trim());
    fetchRecommendations(customGenreInput.trim(), selectedMood);
  };

  const handleToneChange = (trackKey: string, delta: number) => {
    setCustomToneAdjustments(prev => {
      const current = prev[trackKey] ?? 0;
      const nextVal = Math.max(-3, Math.min(3, current + delta));
      return { ...prev, [trackKey]: nextVal };
    });
  };

  // Encontra a música real do catálogo pelo ID ou título/artista
  const findCatalogSong = (track: RecommendedTrack): Music | undefined => {
    if (track.catalogMusicId) {
      const found = catalog.find(m => m.id === track.catalogMusicId);
      if (found) return found;
    }

    const normTitle = track.title.toLowerCase().trim();
    const normArtist = track.artist.toLowerCase().trim();
    return catalog.find(
      m =>
        m.title.toLowerCase() === normTitle ||
        m.title.toLowerCase().includes(normTitle) ||
        normTitle.includes(m.title.toLowerCase())
    );
  };

  // Adiciona todas as faixas que estão no catálogo à lista de desejos em lote
  const handleAddAllToWishlist = () => {
    if (!playlist) return;
    let count = 0;
    playlist.tracks.forEach(track => {
      const song = findCatalogSong(track);
      if (song) {
        const key = `${track.title}-${track.artist}`;
        const tone = customToneAdjustments[key] ?? track.suggestedToneOffset;
        onAddToWishlist(song, tone);
        count++;
      }
    });

    if (count > 0) {
      setAddedAllSuccess(true);
      setTimeout(() => setAddedAllSuccess(false), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner com estética Gemini IA */}
      <div className="relative rounded-3xl bg-gradient-to-r from-purple-950 via-[#14122d] to-[#0d1428] border border-purple-500/30 p-5 sm:p-7 overflow-hidden shadow-2xl">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-gradient-to-br from-pink-500/20 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-300 border border-purple-500/40 text-[11px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
              <span>VozPlay IA • Curadoria Gemini</span>
            </div>
            
            <h2 className="text-xl sm:text-3xl font-display font-black text-white tracking-tight leading-tight">
              Playlist Recomendada por Gênero
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
              O Gemini analisa o acervo do bar e seleciona as melhores músicas para o seu estilo musical, sugerindo tons vocais confortáveis e dicas de palco.
            </p>
          </div>

          {onBackToCatalog && (
            <button
              onClick={onBackToCatalog}
              className="flex-shrink-0 px-4 py-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-2 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Catálogo</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Seleção de Gênero Musical & Filtros de Vibe */}
      <div className="rounded-3xl bg-[#0c1120]/90 border border-white/[0.08] p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <span>Escolha o Gênero Musical:</span>
          </div>
          <span className="text-[11px] text-purple-300/80 font-mono">
            Gênero ativo: <strong className="text-white">{selectedGenre}</strong>
          </span>
        </div>

        {/* Chips de Gêneros Musicais Populares */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {PRESET_GENRES.map((g) => {
            const isSelected = selectedGenre.toLowerCase() === g.id.toLowerCase();
            return (
              <button
                key={g.id}
                onClick={() => handleSelectPreset(g.id)}
                className={`p-3 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between gap-1 active:scale-[0.98] ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-600/90 via-indigo-600/90 to-pink-600/90 border-pink-400/50 text-white shadow-lg shadow-purple-600/25'
                    : 'bg-[#10162a]/80 hover:bg-[#151c36] border-white/[0.06] hover:border-purple-500/30 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg">{g.icon}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">{g.label}</div>
                  <div className={`text-[10px] truncate ${isSelected ? 'text-purple-100' : 'text-slate-500'}`}>
                    {g.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Campo de Gênero Customizado + Seletor de Vibe */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Custom genre form */}
          <form onSubmit={handleApplyCustomGenre} className="flex-1 flex gap-2">
            <input
              type="text"
              value={customGenreInput}
              onChange={(e) => setCustomGenreInput(e.target.value)}
              placeholder="Ou digite outro estilo (ex: 'Reggae', 'Trap', 'Anos 90')..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#080b15] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!customGenreInput.trim() || isLoading}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition whitespace-nowrap"
            >
              Buscar
            </button>
          </form>

          {/* Vibe Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] text-slate-400 font-bold whitespace-nowrap">Clima:</span>
            {PRESET_MOODS.map((m) => {
              const isActive = selectedMood === m;
              return (
                <button
                  key={m}
                  onClick={() => {
                    const nextMood = isActive ? '' : m;
                    setSelectedMood(nextMood);
                    fetchRecommendations(selectedGenre, nextMood);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-white/[0.05] text-slate-400 hover:text-slate-200 border border-white/[0.05]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Feedback de Erro */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => fetchRecommendations(selectedGenre, selectedMood)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 4. Estado de Carregamento Inteligente */}
      {isLoading && (
        <div className="p-12 text-center rounded-3xl bg-[#0c1120]/80 border border-purple-500/20 space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full border-3 border-purple-500 border-t-transparent animate-spin flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-pink-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-base">O Gemini está curando sua playlist...</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Analisando os maiores hinos de <strong>{selectedGenre}</strong>, balanceando tons vocais e selecionando faixas com alta energia para o público cantar junto!
            </p>
          </div>
        </div>
      )}

      {/* 5. Exibição da Playlist Recomendada Gerada */}
      {!isLoading && playlist && (
        <div className="space-y-5">
          {/* Header da Playlist Curada */}
          <div className="rounded-3xl bg-gradient-to-br from-[#12162a]/95 via-[#0e1322] to-[#171129] border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-black uppercase">
                    {playlist.vibeTag}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    playlist.source === 'gemini'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {playlist.source === 'gemini' ? '✨ Gerada por Gemini AI' : '⚡ Curadoria do Catálogo'}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-display font-black text-white">
                  {playlist.playlistTitle}
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                  {playlist.description}
                </p>
              </div>

              {/* Ações Rápidas do Cabeçalho */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleAddAllToWishlist}
                  disabled={addedAllSuccess}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold transition shadow-lg shadow-pink-600/20 flex items-center gap-2 active:scale-95 disabled:opacity-80"
                >
                  <Heart className={`w-3.5 h-3.5 ${addedAllSuccess ? 'fill-white' : ''}`} />
                  <span>{addedAllSuccess ? 'Salvas nos Desejos!' : 'Salvar do Catálogo nos Desejos'}</span>
                </button>

                <button
                  onClick={() => fetchRecommendations(selectedGenre, selectedMood)}
                  className="p-2.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-slate-300 hover:text-white transition"
                  title="Gerar nova sugestão com Gemini"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Dica do Curador */}
            {playlist.curatorNote && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-start gap-3 bg-purple-950/30 rounded-2xl p-3 border border-purple-500/20">
                <Lightbulb className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-purple-200">
                  <strong className="text-amber-300 font-bold">Conselho do Especialista: </strong>
                  {playlist.curatorNote}
                </div>
              </div>
            )}
          </div>

          {/* Lista de Faixas Recomendadas */}
          <div className="space-y-3">
            {playlist.tracks.map((track, idx) => {
              const catalogSong = findCatalogSong(track);
              const isMatch = Boolean(catalogSong);
              const trackKey = `${track.title}-${track.artist}`;
              const currentTone = customToneAdjustments[trackKey] ?? track.suggestedToneOffset;
              const isInWishlist = catalogSong ? wishlistIds.has(catalogSong.id) : false;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col gap-3 ${
                    isMatch
                      ? 'bg-[#0f1426]/90 hover:bg-[#141b33] border-purple-500/20 hover:border-purple-500/40 shadow-lg'
                      : 'bg-[#0b0e1b]/70 border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  {/* Top line: Rank, Title, Artist, Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center font-mono font-black text-purple-300 text-xs flex-shrink-0">
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white leading-tight">
                            {track.title}
                          </h4>
                          
                          {/* Badges de Catálogo e Dificuldade */}
                          {isMatch ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>No Catálogo HD</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              <span>Sugestão IA</span>
                            </span>
                          )}

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            track.energyLevel === 'Explosiva'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : track.energyLevel === 'Alta'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            ⚡ {track.energyLevel}
                          </span>

                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[9px] font-semibold">
                            {track.difficulty}
                          </span>
                        </div>

                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação na Música */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {/* Ajuste de Tom Interativo */}
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                        <span className="text-[10px] text-slate-400 font-medium">Tom:</span>
                        <button
                          onClick={() => handleToneChange(trackKey, -1)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-slate-300 font-bold"
                          title="Diminuir 1 semitom"
                        >
                          -
                        </button>
                        <span className={`font-mono font-bold text-xs px-1 ${
                          currentTone === 0
                            ? 'text-slate-300'
                            : currentTone < 0
                            ? 'text-cyan-300'
                            : 'text-amber-300'
                        }`}>
                          {currentTone > 0 ? `+${currentTone}` : currentTone === 0 ? 'Original' : currentTone}
                        </span>
                        <button
                          onClick={() => handleToneChange(trackKey, 1)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-slate-300 font-bold"
                          title="Aumentar 1 semitom"
                        >
                          +
                        </button>
                      </div>

                      {/* Se está no catálogo */}
                      {catalogSong ? (
                        <>
                          <button
                            onClick={() => onAddToWishlist(catalogSong, currentTone)}
                            className={`p-2 rounded-xl border transition ${
                              isInWishlist
                                ? 'bg-pink-600/30 border-pink-500/50 text-pink-300'
                                : 'bg-white/[0.06] border-white/10 hover:bg-white/[0.12] text-slate-300 hover:text-pink-300'
                            }`}
                            title={isInWishlist ? 'Já na Lista de Desejos' : 'Adicionar à Lista de Desejos'}
                          >
                            <Heart className={`w-4 h-4 ${isInWishlist ? 'fill-pink-400 text-pink-400' : ''}`} />
                          </button>

                          <button
                            onClick={() => onSelectSongToSing(catalogSong, currentTone)}
                            className="p-2 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/[0.06] hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 transition active:scale-95"
                            title="Ouvir prévia no seu aparelho antes de mandar para a TV"
                          >
                            <Headphones className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onSelectSongToSing(catalogSong, currentTone)}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>Cantar</span>
                          </button>
                        </>
                      ) : (
                        /* Se não está no catálogo: Permite pedir a canção diretamente */
                        <button
                          onClick={() => onRequestCustomSong(track.title, track.artist, selectedGenre)}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pedir Esta Música</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dica vocal ou de palco fornecida pelo Gemini */}
                  {track.karaokeTip && (
                    <div className="text-[11px] text-slate-300/90 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/[0.04] flex items-start gap-2">
                      <Mic2 className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-purple-300 font-semibold">Dica de Palco: </strong>
                        {track.karaokeTip}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
