/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Interface do Participante (PWA Mobile)
 * Seções 4.1, 13, 14, 15, 16, 17, 18, 20, 21, 22, 41 e 43 do PRD
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Music2,
  Mic2,
  SlidersHorizontal,
  ListMusic,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Share2,
  Trash2,
  Plus,
  Play,
  AlertTriangle,
  History,
  Info,
  KeyRound,
  Sparkles,
  Radio
} from 'lucide-react';
import { Participant, Music, QueueItem, PlaylistItem, MusicVersion } from '../../types.js';

interface ParticipantViewProps {
  sessionCode?: string;
  onQueueUpdated?: () => void;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({ sessionCode = 'SLZ-704' }) => {
  // Participant Identity State
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Presence Code Verification State
  const [presenceCodeInput, setPresenceCodeInput] = useState('');
  const [isVerifyingPresence, setIsVerifyingPresence] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [presenceSuccess, setPresenceSuccess] = useState('');

  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'SEARCH' | 'PLAYLIST' | 'QUEUE' | 'HISTORY'>('SEARCH');

  // Music Catalog & Search
  const [catalog, setCatalog] = useState<Music[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Todos');
  const [genres, setGenres] = useState<string[]>(['Todos']);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Selected song for version confirmation modal
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<MusicVersion | null>(null);
  const [selectedToneOffset, setSelectedToneOffset] = useState<number>(0);

  // Personal Playlist & Queue
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Share Turn Modal
  const [shareModalItem, setShareModalItem] = useState<QueueItem | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Custom Music Request Modal State (PRD Catalog Expansion)
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [customYoutube, setCustomYoutube] = useState('');
  const [customStyle, setCustomStyle] = useState('Karaokê');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  // Load Catalog on mount
  useEffect(() => {
    fetchCatalog();
    fetchQueue();
  }, []);

  // Poll queue and playlist periodically
  useEffect(() => {
    const timer = setInterval(() => {
      fetchQueue();
      if (participant) {
        fetchPlaylist(participant.id);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [participant]);

  const fetchCatalog = async (q = '', g = 'Todos') => {
    try {
      setIsLoadingCatalog(true);
      const res = await fetch(`/api/v1/music?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(g)}`);
      const data = await res.json();
      if (data.success) {
        setCatalog(data.data);
        if (data.genres) setGenres(data.genres);
      }
    } catch (err) {
      console.error('Erro ao buscar catálogo:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/v1/queue');
      const data = await res.json();
      if (data.success) {
        setQueue(data.queue);
      }
    } catch (err) {
      console.error('Erro ao buscar fila:', err);
    }
  };

  const fetchPlaylist = async (pId: string) => {
    try {
      const res = await fetch(`/api/v1/playlists/${pId}`);
      const data = await res.json();
      if (data.success) {
        setPlaylist(data.items);
      }
    } catch (err) {
      console.error('Erro ao buscar playlist:', err);
    }
  };

  // Participant Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setRegisterError('Por favor, informe seu nome ou apelido.');
      return;
    }

    setIsRegistering(true);
    setRegisterError('');

    try {
      const res = await fetch('/api/v1/participants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: nameInput.trim(),
          whatsapp: whatsappInput.trim() || undefined,
          consentMarketing
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegisterError(data.error || 'Falha ao registrar participante.');
        return;
      }

      setParticipant(data.participant);
      fetchPlaylist(data.participant.id);
    } catch (err) {
      setRegisterError('Erro de conexão ao registrar.');
    } finally {
      setIsRegistering(false);
    }
  };

  // 4-Digit Presence Code Verification (Section 13)
  const handleVerifyPresence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant) return;
    if (presenceCodeInput.length !== 4) {
      setPresenceError('O código deve conter exatamente 4 números.');
      return;
    }

    setIsVerifyingPresence(true);
    setPresenceError('');
    setPresenceSuccess('');

    try {
      const res = await fetch('/api/v1/participants/verify-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          code: presenceCodeInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPresenceError(data.error || 'Código incorreto ou expirado.');
        return;
      }

      setPresenceSuccess(data.message);
      setParticipant({ ...participant, isVerified: true });
      setTimeout(() => {
        setPresenceSuccess('');
        setActiveSubTab('SEARCH');
      }, 1500);
    } catch (err) {
      setPresenceError('Erro ao validar presença no servidor.');
    } finally {
      setIsVerifyingPresence(false);
    }
  };

  // Add to Personal Playlist (Draft)
  const handleAddToPlaylist = async (music: Music, version: MusicVersion) => {
    if (!participant) return;
    try {
      const res = await fetch('/api/v1/playlists/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          musicId: music.id,
          versionId: version.id,
          toneOffset: selectedToneOffset
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchPlaylist(participant.id);
        setSelectedMusic(null);
        setSelectedToneOffset(0);
        showFeedback(`"${music.title}" adicionada à sua playlist pessoal!`, 'success');
      }
    } catch (err) {
      showFeedback('Falha ao adicionar à playlist.', 'error');
    }
  };

  // Add directly to Session Queue (Round-Robin)
  const handleAddToQueue = async (music: Music, version: MusicVersion, playlistItemId?: string) => {
    if (!participant) return;
    if (!participant.isVerified) {
      showFeedback('Valide o Código de Presença de 4 dígitos antes de entrar na fila.', 'error');
      setActiveSubTab('SEARCH');
      return;
    }

    try {
      const res = await fetch('/api/v1/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          musicId: music.id,
          versionId: version.id,
          playlistItemId,
          toneOffset: selectedToneOffset
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showFeedback(data.error || 'Falha ao entrar na fila.', 'error');
        return;
      }

      setSelectedMusic(null);
      setSelectedToneOffset(0);
      fetchQueue();
      fetchPlaylist(participant.id);
      showFeedback(data.message, 'success');
      setActiveSubTab('QUEUE');
    } catch (err) {
      showFeedback('Erro ao conectar ao servidor da fila.', 'error');
    }
  };

  // Live Audience Reaction (PRD Section 48)
  const handleSendReaction = async (emoji: string, label: string) => {
    try {
      await fetch('/api/v1/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: participant?.displayName || 'Plateia',
          emoji,
          label
        })
      });
      showFeedback(`${emoji} Reação enviada para o palco!`, 'success');
    } catch (err) {
      // silent
    }
  };

  // Cancel Own Queued Song (Section 20)
  const handleCancelSong = async (queueItemId: string) => {
    if (!participant) return;
    try {
      const res = await fetch('/api/v1/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueItemId,
          participantId: participant.id
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showFeedback(data.error || 'Não foi possível cancelar.', 'error');
        return;
      }

      fetchQueue();
      showFeedback('Música cancelada com sucesso.', 'success');
    } catch (err) {
      showFeedback('Erro ao cancelar música.', 'error');
    }
  };

  // Custom Music Request (Catalog Expansion)
  const handleCreateCustomMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim() || !customArtist.trim()) return;

    setIsSubmittingCustom(true);
    try {
      const res = await fetch('/api/v1/music/custom-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: customTitle.trim(),
          artist: customArtist.trim(),
          youtubeVideoId: customYoutube.trim() || undefined,
          style: customStyle
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showFeedback(data.error || 'Falha ao solicitar música.', 'error');
        return;
      }

      setShowCustomModal(false);
      setCustomTitle('');
      setCustomArtist('');
      setCustomYoutube('');
      await fetchCatalog();
      showFeedback(`Música "${data.music.title}" adicionada ao catálogo com sucesso!`, 'success');

      // Auto select the new music so participant can sing or save it immediately
      setSelectedMusic(data.music);
      setSelectedVersion(data.version);
    } catch (err) {
      showFeedback('Erro ao solicitar nova música.', 'error');
    } finally {
      setIsSubmittingCustom(false);
    }
  };


  const showFeedback = (message: string, type: 'success' | 'error') => {
    setActionFeedback({ message, type });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // If participant is not registered yet, show Clean Welcome & Register Step
  if (!participant) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 my-8">
        <div className="relative rounded-3xl bg-[#0d1222]/90 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />
          
          <div className="text-center mb-6 relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-pink-500/20 text-purple-300 mb-4 border border-purple-500/30 shadow-lg shadow-purple-900/30">
              <Music2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Bem-vindo ao VozPlay</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Lounge conectado à mesa/unidade <span className="text-purple-300 font-mono font-bold bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-500/30">{sessionCode}</span>
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Seu Nome ou Apelido no Palco <span className="text-pink-400">*</span>
              </label>
              <input
                id="input-participant-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Ex: Gabriel Silva"
                className="w-full px-4 py-3.5 rounded-xl bg-[#090D18] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition shadow-inner"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  WhatsApp (Opcional)
                </label>
                <span className="text-[11px] text-purple-400 font-medium">Histórico pessoal</span>
              </div>
              <input
                id="input-participant-whatsapp"
                type="tel"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                placeholder="(98) 98123-4567"
                className="w-full px-4 py-3.5 rounded-xl bg-[#090D18] border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition shadow-inner"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Usado apenas para salvar suas preferências e histórico. <strong className="text-slate-300">Zero spam</strong> garantido.
              </p>
            </div>

            {whatsappInput.trim() && (
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#090D18]/90 border border-white/10 cursor-pointer text-xs text-slate-300 hover:border-purple-500/30 transition">
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Aceito receber novidades e programações musicais desta casa via WhatsApp.</span>
              </label>
            )}

            {registerError && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{registerError}</span>
              </div>
            )}

            <button
              id="btn-participant-enter"
              type="submit"
              disabled={isRegistering}
              className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isRegistering ? 'Entrando no Lounge...' : 'Entrar no Karaokê'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/[0.08] text-center relative z-10">
            <span className="text-[11px] text-slate-500 font-medium">
              VozPlay Pro • O participante escolhe. O sistema organiza. A TV reproduz.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Active Participant Dashboard
  const liveSong = queue.find((q) => q.status === 'PLAYING');

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-6 pb-28">
      {/* Top Participant Status Card (VIP Pass Style) */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#101526]/95 via-[#0e1220]/95 to-[#161028]/95 border border-white/10 p-4 mb-5 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
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
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-base sm:text-lg tracking-tight">{participant.displayName}</h3>
              {participant.isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <UserCheck className="w-3 h-3" /> Presença Validada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <KeyRound className="w-3 h-3" /> Código Pendente
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {participant.whatsapp ? `VIP Identificado (${participant.whatsapp})` : 'Convidado da Mesa'}
            </p>
          </div>
        </div>

        {/* Presence Code Verification Trigger if not verified */}
        {!participant.isVerified && (
          <button
            onClick={() => setActiveSubTab('SEARCH')}
            className="text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition shadow-sm"
          >
            Inserir 4 Dígitos do Som
          </button>
        )}
      </div>

      {/* Global Feedback Message */}
      {actionFeedback && (
        <div
          className={`mb-4 p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shadow-xl animate-in fade-in slide-in-from-top-2 backdrop-blur-md ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Section 13 Presence Code Banner if NOT verified */}
      {!participant.isVerified && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-950/40 via-[#151222] to-[#0f1424] border border-amber-500/30 p-5 mb-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/30 shadow-md">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white tracking-tight">Validação Obrigatória de Presença Física</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Para cantar no palco, solicite o <strong>Código de 4 Dígitos</strong> visível na mesa do operador ou na TV. Ele garante uma fila justa para quem está presente!
              </p>

              <form onSubmit={handleVerifyPresence} className="mt-4 flex flex-wrap items-center gap-2.5">
                <input
                  id="input-presence-code"
                  type="text"
                  maxLength={4}
                  value={presenceCodeInput}
                  onChange={(e) => setPresenceCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="w-32 text-center text-xl tracking-[0.3em] font-mono font-black px-3 py-2.5 rounded-xl bg-[#080B14] border border-amber-500/50 text-amber-300 placeholder-slate-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 shadow-inner"
                />
                <button
                  id="btn-verify-presence"
                  type="submit"
                  disabled={isVerifyingPresence || presenceCodeInput.length !== 4}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-40"
                >
                  {isVerifyingPresence ? 'Validando...' : 'Liberar Microfone'}
                </button>
              </form>

              {presenceError && (
                <p className="text-xs text-rose-400 mt-2 font-medium flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {presenceError}
                </p>
              )}

              {presenceSuccess && (
                <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {presenceSuccess}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs (Segmented Pill Control) */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0c111e]/90 border border-white/[0.07] mb-6 overflow-x-auto shadow-inner">
        <button
          onClick={() => setActiveSubTab('SEARCH')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeSubTab === 'SEARCH'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Explorar</span>
        </button>

        <button
          onClick={() => setActiveSubTab('PLAYLIST')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeSubTab === 'PLAYLIST'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Playlist</span>
          {playlist.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[10px] font-black">
              {playlist.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('QUEUE')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeSubTab === 'QUEUE'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Fila da TV</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeSubTab === 'QUEUE' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {queue.filter((q) => q.status === 'QUEUED').length}
          </span>
        </button>

        {participant.whatsapp && (
          <button
            onClick={() => setActiveSubTab('HISTORY')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
              activeSubTab === 'HISTORY'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico</span>
          </button>
        )}
      </div>

      {/* TAB 1: MUSIC SEARCH & CATALOG */}
      {activeSubTab === 'SEARCH' && (
        <div className="space-y-5">
          {/* Streaming Hero Banner */}
          <div className="relative rounded-3xl bg-gradient-to-r from-purple-950/70 via-[#131127] to-[#0b1226] border border-purple-500/25 p-5 sm:p-7 overflow-hidden shadow-2xl">
            <div className="absolute -top-10 -right-10 w-72 h-72 bg-gradient-to-br from-pink-500/20 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/35 text-[11px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>Catálogo VozPlay HD</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-display font-black text-white tracking-tight leading-snug">
                  Qual é o seu sucesso no palco hoje?
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/90 max-w-lg leading-relaxed">
                  Escolha qualquer canção, module o tom vocal semitons (+3 a -3) e receba o chamado direto na sua mesa quando for sua vez de brilhar!
                </p>
              </div>
              <button
                onClick={() => setShowCustomModal(true)}
                className="flex-shrink-0 px-4 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-xl shadow-pink-600/25 flex items-center gap-2 active:scale-95 border border-white/20"
              >
                <Plus className="w-4 h-4" />
                <span>Pedir Outra Canção</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative group">
            <Search className="w-4 h-4 text-purple-400 absolute left-4 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-pink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                fetchCatalog(e.target.value, selectedGenre);
              }}
              placeholder="Buscar por música, cantor, banda ou gênero..."
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-[#090d18] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  fetchCatalog('', selectedGenre);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Genre Filters (Smooth pills with scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGenre(g);
                  fetchCatalog(searchQuery, g);
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                  selectedGenre === g
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]'
                    : 'bg-[#0e1322] text-slate-400 border border-white/[0.08] hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Songs List */}
          <div className="space-y-3">
            {isLoadingCatalog ? (
              <div className="p-14 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-semibold text-slate-300">Carregando catálogo musical em alta resolução...</span>
              </div>
            ) : catalog.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#0e1322]/80 border border-white/10 text-slate-400 text-sm space-y-4">
                <Music2 className="w-12 h-12 text-purple-400/50 mx-auto" />
                <p>Nenhuma música encontrada com o termo <strong className="text-white">"{searchQuery}"</strong>.</p>
                <button
                  onClick={() => {
                    setCustomTitle(searchQuery);
                    setShowCustomModal(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition inline-flex items-center gap-2 shadow-xl shadow-purple-600/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar e Cantar Esta Música</span>
                </button>
              </div>
            ) : (
              catalog.map((m) => (
                <div
                  key={m.id}
                  className="group rounded-2xl bg-[#0e1324]/85 hover:bg-[#141b32] border border-white/[0.07] hover:border-purple-500/40 p-3 sm:p-4 flex items-center justify-between gap-3.5 transition-all duration-200 hover:shadow-xl hover:shadow-purple-950/30"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative w-14 sm:w-16 h-14 sm:h-16 rounded-2xl overflow-hidden bg-slate-900 flex-shrink-0 shadow-lg ring-1 ring-white/10">
                      <img
                        src={m.coverUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=160&q=80'}
                        alt={m.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <Play className="w-6 h-6 text-white fill-white drop-shadow" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-base font-display font-bold text-white truncate group-hover:text-purple-200 transition-colors">
                        {m.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{m.artist}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
                          {m.genre}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {m.versions.length} {m.versions.length === 1 ? 'versão' : 'versões'} • Tom ajustável
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedMusic(m);
                      setSelectedVersion(m.versions[0]);
                    }}
                    className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <Mic2 className="w-3.5 h-3.5" />
                    <span>Cantar</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PERSONAL PLAYLIST */}
      {activeSubTab === 'PLAYLIST' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0e1322]/90 border border-white/[0.08] p-4 flex items-start gap-3 text-xs text-slate-300 shadow-lg">
            <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Playlist pessoal do Lounge:</strong> Guarde suas músicas favoritas para cantar durante a noite. Quando estiver pronto, clique em <em>Cantar na Fila</em> para entrar na rotação da TV!
            </p>
          </div>

          {playlist.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[#0e1322]/80 border border-white/[0.07] text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] text-purple-400 mx-auto flex items-center justify-center">
                <ListMusic className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Sua playlist está vazia</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">Explore o catálogo e adicione suas canções preferidas para cantar com os amigos.</p>
              <button
                onClick={() => setActiveSubTab('SEARCH')}
                className="mt-2 px-4 py-2 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold hover:bg-purple-600 hover:text-white transition shadow-sm"
              >
                Explorar Catálogo Musical
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {playlist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[#0e1322]/90 border border-white/[0.07] hover:border-purple-500/30 p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-lg shadow-black/40"
                >
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white truncate">{item.musicTitle}</h4>
                    <p className="text-xs text-slate-400 truncate">{item.musicArtist}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                      Versão: {item.versionStyle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAddToQueue({ id: item.musicId, title: item.musicTitle, artist: item.musicArtist, genre: '', versions: [] }, { id: item.versionId, musicId: item.musicId, style: item.versionStyle, label: '', youtubeVideoId: item.youtubeVideoId, durationSec: 180 }, item.id)}
                      disabled={!participant.isVerified}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 flex items-center gap-1.5 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Cantar</span>
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/v1/playlists/${participant.id}/${item.id}`, { method: 'DELETE' });
                        fetchPlaylist(participant.id);
                      }}
                      className="p-2.5 rounded-xl bg-white/[0.04] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.05] transition"
                      title="Remover da playlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION QUEUE */}
      {activeSubTab === 'QUEUE' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0e1322]/90 border border-white/[0.08] p-3.5 flex items-center justify-between gap-3 text-xs text-slate-300 shadow-md">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-200">Fila Rotativa Determinística VozPlay</span>
            </div>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.06] text-slate-400">
              {queue.filter((q) => q.status === 'QUEUED').length} na espera
            </span>
          </div>

          <div className="space-y-3">
            {queue.map((item, index) => {
              const isMine = item.participantId === participant.id;
              const isPlaying = item.status === 'PLAYING';
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-4 border transition-all duration-300 ${
                    isPlaying
                      ? 'bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-[#0e1322] border-pink-500/50 shadow-xl shadow-pink-500/10 ring-1 ring-pink-500/20'
                      : isMine
                      ? 'bg-gradient-to-r from-purple-950/30 to-[#0e1322] border-purple-500/40 shadow-lg'
                      : 'bg-[#0e1322]/80 border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 shadow-md ${
                          isPlaying
                            ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white'
                            : isMine
                            ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                            : 'bg-white/[0.06] text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {isPlaying ? (
                          <div className="flex items-center gap-0.5 h-3.5">
                            <span className="w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s] h-2.5" />
                            <span className="w-0.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s] h-3.5" />
                            <span className="w-0.5 bg-white rounded-full animate-bounce h-2" />
                          </div>
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-white truncate">{item.musicTitle}</h4>
                          {isPlaying && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/40 animate-pulse">
                              No Palco Agora
                            </span>
                          )}
                          {isMine && !isPlaying && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Sua Música
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.musicArtist} • Cantado por: <span className="text-slate-200 font-bold">{item.participantDisplayName}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] text-slate-500">
                            Versão: {item.versionStyle}
                          </span>
                          {item.toneOffset !== undefined && item.toneOffset !== 0 && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Tom {item.toneOffset > 0 ? `+${item.toneOffset}` : item.toneOffset} {item.toneOffset > 0 ? 'Agudo' : 'Grave'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions if mine */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isMine && (
                        <button
                          onClick={() => {
                            setShareModalItem(item);
                            setCopiedShare(false);
                          }}
                          className="p-2.5 rounded-xl bg-white/[0.05] text-purple-300 hover:bg-purple-600/20 border border-white/[0.08] transition shadow-sm"
                          title="Compartilhar minha vez"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Cancel button if QUEUED and mine (Section 20) */}
                      {isMine && item.status === 'QUEUED' && (
                        <button
                          onClick={() => handleCancelSong(item.id)}
                          className="px-3 py-2 rounded-xl bg-rose-950/60 text-rose-300 hover:bg-rose-900 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PRD Section 48: Live Audience Reactions when Playing */}
                  {isPlaying && (
                    <div className="mt-4 pt-3.5 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between text-xs text-slate-300 mb-2.5">
                        <span className="flex items-center gap-2 font-bold text-pink-300">
                          <Radio className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                          Torça pelo cantor • Reagir em tempo real na TV:
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { emoji: '👏', label: 'Aplausos' },
                          { emoji: '🔥', label: 'Arrasou!' },
                          { emoji: '❤️', label: 'Amei' },
                          { emoji: '🎤', label: 'Canta Muito!' },
                          { emoji: '⭐', label: 'Nota 10!' }
                        ].map((rx) => (
                          <button
                            key={rx.emoji}
                            type="button"
                            onClick={() => handleSendReaction(rx.emoji, rx.label)}
                            className="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] hover:border-pink-500/40 text-xs text-slate-200 transition-all flex items-center gap-1.5 active:scale-90 shadow-sm"
                          >
                            <span className="text-sm">{rx.emoji}</span>
                            <span className="text-[11px] font-bold text-slate-300">{rx.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PERSONAL HISTORY */}
      {activeSubTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#0e1322]/90 border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shadow-md">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">Identidade Persistente</h3>
                <p className="text-xs text-slate-400">Vinculada ao WhatsApp <span className="text-purple-300 font-mono">{participant.whatsapp}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-2xl bg-[#090D18] border border-white/[0.07]">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Músicas Cantadas</span>
                <span className="text-2xl font-black text-white mt-1 block">4</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#090D18] border border-white/[0.07]">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Estilo Favorito</span>
                <span className="text-2xl font-black text-purple-300 mt-1 block">Karaokê HD</span>
              </div>
            </div>

            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Suas Versões Mais Pedidas</h4>
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#090D18] border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-200 font-medium">Evidências - Chitãozinho & Xororó (Karaokê)</span>
                <span className="text-purple-300 font-bold bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-500/30">Cantada 3x</span>
              </div>
              <div className="p-3 rounded-xl bg-[#090D18] border border-white/[0.06] flex items-center justify-between">
                <span className="text-slate-200 font-medium">Cheia de Manias - Raça Negra (Playback)</span>
                <span className="text-purple-300 font-bold bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-500/30">Cantada 1x</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM VERSION & VOCAL TUNER MODAL (Section 21, 22, 23) */}
      {selectedMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#0d1222] border border-white/15 p-6 sm:p-7 shadow-2xl text-slate-100 relative overflow-hidden ring-1 ring-white/10">
            {/* Top ambient lights */}
            <div className="absolute -top-16 -right-16 w-44 h-44 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-pink-600/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-4 mb-5 relative z-10">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/20 flex-shrink-0">
                <img
                  src={selectedMusic.coverUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=160&q=80'}
                  alt={selectedMusic.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {selectedMusic.genre}
                  </span>
                  <span className="text-[10px] text-slate-400">Qualidade HD</span>
                </div>
                <h3 className="text-base sm:text-xl font-display font-black text-white truncate">{selectedMusic.title}</h3>
                <p className="text-xs text-slate-300 truncate mt-0.5">{selectedMusic.artist}</p>
              </div>
            </div>

            <div className="space-y-2 mb-5 relative z-10">
              <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Versão do Áudio / Playback</span>
                <span className="text-purple-400 font-mono text-[10px]">YouTube Sync</span>
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedMusic.versions.map((ver) => (
                  <div
                    key={ver.id}
                    onClick={() => setSelectedVersion(ver)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      selectedVersion?.id === ver.id
                        ? 'bg-gradient-to-r from-purple-950/70 to-indigo-950/60 border-purple-500 text-white shadow-lg shadow-purple-900/30 ring-1 ring-purple-500/40'
                        : 'bg-[#090d18] border-white/[0.07] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{ver.label}</span>
                        {selectedVersion?.id === ver.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Estilo: <span className="text-purple-300 font-medium">{ver.style || 'Karaokê'}</span> • Formato: {ver.quality || '1080p HD'}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedVersion?.id === ver.id ? 'border-purple-400 bg-purple-600' : 'border-slate-700 bg-slate-900'
                    }`}>
                      {selectedVersion?.id === ver.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRD Section 23: Vocal Pitch Tuner / Transposição de Semitons */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#080c16] border border-white/[0.1] space-y-3.5 mb-6 shadow-inner relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-white uppercase tracking-wider block">Ajuste de Tom Vocal</span>
                  <span className="text-[11px] text-slate-400">Transposição em semitons</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-black px-3 py-1 rounded-full text-xs border ${
                    selectedToneOffset === 0
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : selectedToneOffset > 0
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}>
                    {selectedToneOffset === 0
                      ? '0 (Original)'
                      : selectedToneOffset > 0
                      ? `+${selectedToneOffset} Semitons (Agudo)`
                      : `${selectedToneOffset} Semitons (Grave)`}
                  </span>
                </div>
              </div>

              {/* Stepper Buttons & Visual Scale */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedToneOffset((prev) => Math.max(-3, prev - 1))}
                  disabled={selectedToneOffset <= -3}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white font-black text-sm flex items-center justify-center border border-white/10 active:scale-95 transition"
                  title="Diminuir tom"
                >
                  -
                </button>

                <div className="grid grid-cols-7 gap-1 flex-1">
                  {[-3, -2, -1, 0, 1, 2, 3].map((semi) => (
                    <button
                      key={semi}
                      type="button"
                      onClick={() => setSelectedToneOffset(semi)}
                      className={`py-2.5 rounded-xl text-xs font-mono font-black border transition-all ${
                        selectedToneOffset === semi
                          ? semi > 0
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/40 scale-105'
                            : semi < 0
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/40 scale-105'
                            : 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/40 scale-105'
                          : 'bg-[#0f1424] text-slate-400 border-white/[0.08] hover:text-white hover:border-white/20'
                      }`}
                    >
                      {semi > 0 ? `+${semi}` : semi}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedToneOffset((prev) => Math.max(-3, Math.min(3, prev + 1)))}
                  disabled={selectedToneOffset >= 3}
                  className="w-10 h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white font-black text-sm flex items-center justify-center border border-white/10 active:scale-95 transition"
                  title="Aumentar tom"
                >
                  +
                </button>
              </div>

              {/* Dynamic Vocal Hint */}
              <div className="text-[11px] text-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                {selectedToneOffset === 0 && (
                  <span className="text-emerald-300 font-medium">✨ Tom de gravação original padrão (graves e agudos de estúdio).</span>
                )}
                {selectedToneOffset > 0 && (
                  <span className="text-amber-300 font-medium">🔥 Tom mais agudo (+{selectedToneOffset}): Facilita alcance vocal feminino ou tons altos.</span>
                )}
                {selectedToneOffset < 0 && (
                  <span className="text-cyan-300 font-medium">🎙️ Tom mais grave ({selectedToneOffset}): Confortável para vozes masculinas e barítonos.</span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 relative z-10">
              <button
                onClick={() => selectedVersion && handleAddToQueue(selectedMusic, selectedVersion)}
                disabled={!participant.isVerified}
                className="flex-1 py-4 px-5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white font-black text-xs shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 border border-white/20"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Cantar Agora na Fila da TV</span>
              </button>

              <button
                onClick={() => selectedVersion && handleAddToPlaylist(selectedMusic, selectedVersion)}
                className="py-4 px-5 rounded-2xl bg-[#090d18] hover:bg-white/[0.08] text-slate-200 font-bold text-xs border border-white/[0.12] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Playlist</span>
              </button>
            </div>

            <button
              onClick={() => setSelectedMusic(null)}
              className="mt-4 w-full py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancelar e Voltar ao Catálogo
            </button>
          </div>
        </div>
      )}

      {/* SHARE MY TURN MODAL (Section 43: SEM vazar WhatsApp) */}
      {shareModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
            <h3 className="text-base font-bold text-white mb-2">Compartilhar Minha Vez</h3>
            <p className="text-xs text-slate-400 mb-4">
              Envie para seus amigos acompanharem a contagem regressiva para sua apresentação!
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-xs space-y-1">
              <div className="text-slate-400">Participante: <strong className="text-white">{shareModalItem.participantDisplayName}</strong></div>
              <div className="text-slate-400">Música: <strong className="text-indigo-400">{shareModalItem.musicTitle}</strong></div>
              <div className="text-slate-400">Artista: <strong className="text-slate-300">{shareModalItem.musicArtist}</strong></div>
              <div className="text-emerald-400 font-semibold pt-1">
                Link Seguro: vozplay.ai.slz.br/v/{shareModalItem.id.substring(0, 8)}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const text = encodeURIComponent(
                    `🎤 Vou cantar "${shareModalItem.musicTitle}" no VozPlay! Acompanhe minha vez em tempo real: https://vozplay.ai.slz.br/v/${shareModalItem.id}`
                  );
                  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                }}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Enviar pelo WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `🎤 Vou cantar "${shareModalItem.musicTitle}" no VozPlay! Acompanhe minha vez: https://vozplay.ai.slz.br/v/${shareModalItem.id}`
                  );
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2000);
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                {copiedShare ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Copiar Link de Acompanhamento</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShareModalItem(null)}
              className="mt-3 w-full py-2 text-xs text-slate-400 hover:text-white transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM SONG REQUEST MODAL (PRD Section 21 & Expansion) */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-2 mb-2 text-pink-400">
              <Plus className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Pedir Nova Música</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Não encontrou sua música favorita? Adicione o título e artista para cadastrar instantaneamente no catálogo e cantar!
            </p>

            <form onSubmit={handleCreateCustomMusic} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome da Música <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ex: Tempo Perdido"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantor ou Banda <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  value={customArtist}
                  onChange={(e) => setCustomArtist(e.target.value)}
                  placeholder="Ex: Legião Urbana"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Link ou ID do YouTube (Opcional)
                </label>
                <input
                  type="text"
                  value={customYoutube}
                  onChange={(e) => setCustomYoutube(e.target.value)}
                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Estilo da Versão
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Karaokê', 'Playback', 'Acústico', 'Ao Vivo'].map((st) => (
                    <label
                      key={st}
                      className={`p-2 rounded-lg border text-center text-xs font-semibold cursor-pointer transition ${
                        customStyle === st
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="customStyle"
                        className="hidden"
                        checked={customStyle === st}
                        onChange={() => setCustomStyle(st)}
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingCustom || !customTitle.trim() || !customArtist.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition"
                >
                  {isSubmittingCustom ? 'Adicionando...' : 'Cadastrar e Escolher'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Live Stage Bar & Instant Reaction Pod (Section 48) */}
      {liveSong && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40">
          <div className="rounded-2xl bg-[#0c1020]/95 border border-pink-500/40 p-3 sm:p-3.5 shadow-2xl shadow-pink-950/50 backdrop-blur-xl ring-1 ring-pink-500/30">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Audio Equalizer animation bars */}
                <div className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 rounded-md bg-pink-500/20 text-pink-400 flex-shrink-0">
                  <span className="w-1 bg-pink-400 rounded-full h-3 eq-bar-1" />
                  <span className="w-1 bg-purple-400 rounded-full h-4 eq-bar-2" />
                  <span className="w-1 bg-indigo-400 rounded-full h-2 eq-bar-3" />
                  <span className="w-1 bg-pink-400 rounded-full h-3.5 eq-bar-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-pink-300">
                      No Palco Agora
                    </span>
                    <span className="text-slate-500 text-[10px]">•</span>
                    <span className="text-white text-xs font-bold truncate">
                      {liveSong.participantDisplayName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate font-medium">
                    {liveSong.musicTitle} <span className="text-slate-400">({liveSong.musicArtist})</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveSubTab('QUEUE')}
                className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-[10px] font-bold text-slate-200 transition flex-shrink-0"
              >
                Ver Fila
              </button>
            </div>

            {/* Quick reaction emojis */}
            <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/[0.08]">
              <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Torcer:</span>
              <div className="flex items-center gap-1 flex-1 justify-between sm:justify-end">
                {[
                  { emoji: '👏', label: 'Aplausos' },
                  { emoji: '🔥', label: 'Arrasou!' },
                  { emoji: '❤️', label: 'Amei' },
                  { emoji: '🎤', label: 'Canta Muito!' },
                  { emoji: '⭐', label: 'Nota 10!' }
                ].map((rx) => (
                  <button
                    key={rx.emoji}
                    type="button"
                    onClick={() => handleSendReaction(rx.emoji, rx.label)}
                    className="p-1.5 sm:px-2 sm:py-1 rounded-xl bg-white/[0.05] hover:bg-pink-500/20 hover:border-pink-500/30 border border-white/[0.06] text-xs transition active:scale-75 flex items-center gap-1"
                    title={rx.label}
                  >
                    <span>{rx.emoji}</span>
                    <span className="text-[10px] font-bold text-slate-300 hidden md:inline">{rx.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

