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
  Radio,
  RefreshCw,
  Volume2,
  VolumeX,
  BellRing,
  Heart,
  Headphones,
  Users,
  QrCode,
  Megaphone,
  Timer,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Participant, Music, QueueItem, PlaylistItem, MusicVersion, WishlistItem, CallingParticipantState, Session } from '../../types.js';
import { playDJAudioEffect } from '../../utils/synthAudio.js';
import { ParticipantSidebar, ParticipantSubTab } from './ParticipantSidebar.js';
import { RecommendedPlaylistView } from './RecommendedPlaylistView.js';
import { QRScannerModal } from './QRScannerModal.js';
import { apiFetch as fetch, setStoredToken } from '../../utils/apiClient.js';
import { VozPlayMascotIcon, VozPlayLogo } from '../common/VozPlayLogo.js';

interface ParticipantViewProps {
  session?: Session | null;
  sessionCode?: string;
  onQueueUpdated?: () => void;
  onOpenTracker?: (queueItemId: string) => void;
  lastSoundboard?: { soundType: string; label: string; timestamp?: string; _t?: number } | null;
  lastQueueEvent?: any;
}

export const ParticipantView: React.FC<ParticipantViewProps> = ({
  session,
  sessionCode = 'SLZ-704',
  onQueueUpdated,
  onOpenTracker,
  lastSoundboard,
  lastQueueEvent
}) => {
  // Mobile Sound Effects state (PRD Section 47)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeSoundAlert, setActiveSoundAlert] = useState<{ soundType: string; label: string } | null>(null);

  // QR Code Scanner State
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState(sessionCode);

  // Participant Identity State
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [whatsappInput, setWhatsappInput] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Audience Live Reaction State (PRD Section 48 & 49)
  const [sendingReaction, setSendingReaction] = useState<string | null>(null);

  // Presence Code Verification State
  const [presenceCodeInput, setPresenceCodeInput] = useState('');
  const [isVerifyingPresence, setIsVerifyingPresence] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [presenceSuccess, setPresenceSuccess] = useState('');

  // Navigation sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<ParticipantSubTab>('SEARCH');

  // Wishlist State (Lista de Desejos para Próximas Rodadas)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistSearchQuery, setWishlistSearchQuery] = useState('');
  const [wishlistGenreFilter, setWishlistGenreFilter] = useState('Todos');
  const [isLoadingWishlist, setIsLoadingWishlist] = useState(false);

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
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isDuetSelected, setIsDuetSelected] = useState<boolean>(false);
  const [duetPartnerName, setDuetPartnerName] = useState<string>('');

  // Personal Playlist & Queue
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Participant Persistent History (PRD Seção 41)
  const [participantHistory, setParticipantHistory] = useState<{
    hasPersistentIdentity: boolean;
    totalSung: number;
    totalParticipations: number;
    firstSeen?: string;
    historyItems: Array<{
      musicTitle: string;
      musicArtist: string;
      versionStyle: string;
      completedAt: string;
      sungCount: number;
      badgeText: string;
    }>;
  } | null>(null);

  // Calling & Live Stage State (Turn Management)
  const [callingState, setCallingState] = useState<CallingParticipantState | null>(null);
  const [isCalled, setIsCalled] = useState<boolean>(false);
  const [callingRemainingSeconds, setCallingRemainingSeconds] = useState<number>(30);
  const [isStartingTurn, setIsStartingTurn] = useState<boolean>(false);
  const [isPlayingNow, setIsPlayingNow] = useState<boolean>(false);
  const [lyricsLines, setLyricsLines] = useState<string[]>([]);
  const [activeLyricIndex, setActiveLyricIndex] = useState<number>(0);
  const [showLyricsModal, setShowLyricsModal] = useState<boolean>(false);

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

  // PRD Section 47: Real-time Soundboard Broadcast to Mobile
  useEffect(() => {
    if (!lastSoundboard) return;

    setActiveSoundAlert({
      soundType: lastSoundboard.soundType,
      label: lastSoundboard.label
    });

    if (soundEnabled) {
      try {
        playDJAudioEffect(lastSoundboard.soundType);
      } catch (err) {
        // Safe catch for mobile browser autoplay policy
      }
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 60, 40]);
      } catch (e) {}
    }

    const timer = setTimeout(() => {
      setActiveSoundAlert(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [lastSoundboard, soundEnabled]);

  // Load Catalog and register device handshake on mount
  useEffect(() => {
    fetchCatalog();
    fetchQueue();
    fetchWishlist();

    fetch('/api/v1/devices/handshake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'pwa-' + (typeof window !== 'undefined' ? (window.localStorage.getItem('vozplay_device_id') || Math.random().toString(36).substring(2, 9)) : 'client'),
        clientType: typeof navigator !== 'undefined' && navigator.userAgent.includes('Android') && !navigator.userAgent.includes('Chrome') ? 'ANDROID' : 'PWA',
        role: 'PARTICIPANT',
        platform: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('iPhone') ? 'iOS Safari PWA' : navigator.userAgent.includes('Android') ? 'Android Chrome PWA' : 'Web Mobile') : 'Mobile',
        clientVersion: '1.2.0-pwa'
      })
    }).catch(() => {});
  }, []);

  // Poll queue and playlist periodically
  useEffect(() => {
    const timer = setInterval(() => {
      fetchQueue();
      if (participant) {
        fetchPlaylist(participant.id);
        fetchWishlist(participant.id);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [participant]);

  useEffect(() => {
    if (lastQueueEvent) {
      fetchQueue();
      if (participant) {
        fetchPlaylist(participant.id);
      }
    }
  }, [lastQueueEvent, participant]);

  const fetchCatalog = async (q = '', g = 'Todos') => {
    try {
      setIsLoadingCatalog(true);
      const res = await fetch(`/api/v1/music?q=${encodeURIComponent(q)}&genre=${encodeURIComponent(g)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setCatalog(data.data);
        if (data.genres) setGenres(data.genres);
      }
    } catch {
      // Reconexão transitória
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const fetchLyrics = async (musicId: string) => {
    try {
      const res = await fetch(`/api/v1/lyrics/${musicId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (Array.isArray(data.lyrics)) {
            setLyricsLines(data.lyrics);
          } else if (data.lyrics?.lines && Array.isArray(data.lyrics.lines)) {
            setLyricsLines(data.lyrics.lines.map((l: any) => typeof l === 'string' ? l : l.text || ''));
          }
          setActiveLyricIndex(0);
        }
      }
    } catch {
      // Reconexão transitória
    }
  };

  const handleStartTurn = async () => {
    if (!participant) return;
    setIsStartingTurn(true);
    try {
      const res = await fetch('/api/v1/participant/start-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          queueItemId: callingState?.queueItemId
        })
      });
      const data = await res.json();
      if (data && data.success) {
        setIsCalled(false);
        setIsPlayingNow(true);
        setShowLyricsModal(true);
        showFeedback('🎤 Show time! Apresentação iniciada na TV.', 'success');
        fetchQueue();
        if (callingState?.musicId) {
          fetchLyrics(callingState.musicId);
        }
      } else {
        showFeedback(data.error || 'Falha ao iniciar vez.', 'error');
      }
    } catch {
      showFeedback('Erro de conexão ao iniciar apresentação.', 'error');
    } finally {
      setIsStartingTurn(false);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/v1/queue');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setQueue(data.queue);
        const call = (data.callingState as CallingParticipantState | null) || null;
        setCallingState(call);

        const pId = participant?.id;
        const called = Boolean(
          call && pId && (call.participantId === pId || (call.isDuet && call.partnerParticipantId === pId))
        );
        setIsCalled(called);
        if (called && call && typeof call.remainingSeconds === 'number') {
          setCallingRemainingSeconds(call.remainingSeconds);
        }

        const playing = (data.playingItem as QueueItem | null) || null;
        const userPlaying = Boolean(
          playing && pId && (playing.participantId === pId || (playing.isDuet && playing.partnerParticipantId === pId))
        );
        setIsPlayingNow(userPlaying);
        if (userPlaying && playing && lyricsLines.length === 0) {
          fetchLyrics(playing.musicId);
        }
      }
    } catch {
      // Reconexão transitória
    }
  };

  // 1-second interval to decrement calling remaining seconds
  useEffect(() => {
    if (!isCalled) return;
    const timer = setInterval(() => {
      setCallingRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isCalled]);

  // Synchronized lyrics automatic progression when on stage
  useEffect(() => {
    if (!isPlayingNow || lyricsLines.length === 0) return;
    const interval = setInterval(() => {
      setActiveLyricIndex((prev) => (prev + 1) % lyricsLines.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPlayingNow, lyricsLines.length]);

  const fetchPlaylist = async (pId: string) => {
    try {
      const res = await fetch(`/api/v1/playlists/${pId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        setPlaylist(data.items);
      }
    } catch {
      // Reconexão transitória
    }
  };

  const fetchWishlist = async (pId?: string) => {
    try {
      setIsLoadingWishlist(true);
      const activeId = pId || participant?.id;
      const localKey = activeId ? `vozplay_wishlist_${activeId}` : 'vozplay_wishlist_guest';
      const cached = typeof window !== 'undefined' ? localStorage.getItem(localKey) : null;
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setWishlist(parsed);
          }
        } catch {
          // ignore cache parse error
        }
      }

      if (activeId) {
        const res = await fetch(`/api/v1/wishlists/${activeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.items)) {
            setWishlist(data.items);
            if (typeof window !== 'undefined') {
              localStorage.setItem(localKey, JSON.stringify(data.items));
            }
          }
        }
      }
    } catch {
      // Reconexão transitória
    } finally {
      setIsLoadingWishlist(false);
    }
  };

  const fetchHistory = async (pId: string) => {
    try {
      const res = await fetch(`/api/v1/participants/${pId}/history`);
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setParticipantHistory(data);
      }
    } catch {
      // Reconexão transitória
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

      if (data.token) {
        setStoredToken('PARTICIPANT', data.token);
      }

      setParticipant(data.participant);
      fetchPlaylist(data.participant.id);
      fetchWishlist(data.participant.id);
      if (data.participant.whatsapp) {
        fetchHistory(data.participant.id);
      }
    } catch (err) {
      setRegisterError('Erro de conexão ao registrar.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Wishlist Actions (Lista de Desejos - Próximas Rodadas)
  const handleToggleWishlist = async (music: Music, preferredVersion?: MusicVersion, toneOffset = 0) => {
    const existing = wishlist.find((w) => w.musicId === music.id);
    const activeId = participant?.id;
    const localKey = activeId ? `vozplay_wishlist_${activeId}` : 'vozplay_wishlist_guest';

    if (existing) {
      // Remover da lista
      const updated = wishlist.filter((w) => w.musicId !== music.id);
      setWishlist(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, JSON.stringify(updated));
      }
      if (activeId) {
        fetch(`/api/v1/wishlists/${activeId}/${existing.id}`, { method: 'DELETE' }).catch(() => {});
      }
      showFeedback(`"${music.title}" removida da Lista de Desejos.`, 'success');
    } else {
      // Adicionar à lista
      const version = preferredVersion || music.versions[0];
      const newItem: WishlistItem = {
        id: 'wish-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        participantId: activeId || 'guest',
        musicId: music.id,
        musicTitle: music.title,
        musicArtist: music.artist,
        genre: music.genre,
        coverUrl: music.coverUrl,
        preferredVersionId: version?.id,
        preferredVersionStyle: version?.style,
        preferredToneOffset: toneOffset,
        addedAt: new Date().toISOString()
      };
      const updated = [newItem, ...wishlist];
      setWishlist(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(localKey, JSON.stringify(updated));
      }
      if (activeId) {
        fetch(`/api/v1/wishlists/${activeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            musicId: music.id,
            preferredVersionId: version?.id,
            preferredToneOffset: toneOffset
          })
        }).catch(() => {});
      }
      showFeedback(`"${music.title}" salva na sua Lista de Desejos para as próximas rodadas!`, 'success');
    }
  };

  const handleRemoveFromWishlist = async (itemId: string, title?: string) => {
    const activeId = participant?.id;
    const localKey = activeId ? `vozplay_wishlist_${activeId}` : 'vozplay_wishlist_guest';
    const updated = wishlist.filter((w) => w.id !== itemId && w.musicId !== itemId);
    setWishlist(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
    if (activeId) {
      fetch(`/api/v1/wishlists/${activeId}/${itemId}`, { method: 'DELETE' }).catch(() => {});
    }
    showFeedback(title ? `"${title}" removida dos Desejos.` : 'Música removida da Lista de Desejos.', 'success');
  };

  const handleClearWishlist = async () => {
    if (wishlist.length === 0) return;
    const activeId = participant?.id;
    const localKey = activeId ? `vozplay_wishlist_${activeId}` : 'vozplay_wishlist_guest';
    setWishlist([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify([]));
    }
    if (activeId) {
      fetch(`/api/v1/wishlists/${activeId}`, { method: 'DELETE' }).catch(() => {});
    }
    showFeedback('Lista de Desejos limpa com sucesso.', 'success');
  };

  const handleUpdateWishlistTone = async (itemId: string, newTone: number) => {
    const tone = Math.max(-3, Math.min(3, newTone));
    const updated = wishlist.map((w) => (w.id === itemId ? { ...w, preferredToneOffset: tone } : w));
    setWishlist(updated);
    const activeId = participant?.id;
    const localKey = activeId ? `vozplay_wishlist_${activeId}` : 'vozplay_wishlist_guest';
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify(updated));
    }
    if (activeId) {
      fetch(`/api/v1/wishlists/${activeId}/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredToneOffset: tone })
      }).catch(() => {});
    }
  };

  const handleSingFromWishlist = (item: WishlistItem) => {
    const foundMusic = catalog.find((m) => m.id === item.musicId) || {
      id: item.musicId,
      title: item.musicTitle,
      artist: item.musicArtist,
      genre: item.genre,
      coverUrl: item.coverUrl,
      versions: [
        {
          id: item.preferredVersionId || 'v-default',
          musicId: item.musicId,
          style: item.preferredVersionStyle || 'karaoke',
          label: 'Versão Karaokê Oficial',
          youtubeVideoId: '',
          durationSec: 240
        }
      ]
    };

    const targetVersion = foundMusic.versions.find((v) => v.id === item.preferredVersionId) || foundMusic.versions[0];
    const targetTone = item.preferredToneOffset !== undefined ? item.preferredToneOffset : 0;

    setSelectedMusic(foundMusic);
    setSelectedVersion(targetVersion);
    setSelectedToneOffset(targetTone);
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
          toneOffset: selectedToneOffset,
          isDuet: Boolean(isDuetSelected && duetPartnerName.trim()),
          partnerDisplayName: isDuetSelected ? duetPartnerName.trim() : undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showFeedback(data.error || 'Falha ao entrar na fila.', 'error');
        return;
      }

      setSelectedMusic(null);
      setSelectedToneOffset(0);
      setIsDuetSelected(false);
      setDuetPartnerName('');
      setIsPreviewPlaying(false);
      fetchQueue();
      fetchPlaylist(participant.id);
      showFeedback(data.message, 'success');
      setActiveSubTab('QUEUE');
    } catch (err) {
      showFeedback('Erro ao conectar ao servidor da fila.', 'error');
    }
  };

  // Live Audience Reaction (PRD Section 48 & 49)
  const handleSendReaction = async (emoji: string, label: string) => {
    setSendingReaction(emoji);
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
      showFeedback(`${emoji} Reação enviada para o telão!`, 'success');
    } catch (err) {
      // silent
    } finally {
      setTimeout(() => setSendingReaction(null), 1000);
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

  // Floating soundboard broadcast alert toast for mobile
  const renderSoundboardAlert = () => (
    <AnimatePresence>
      {activeSoundAlert && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 15 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] pointer-events-none"
        >
          <div className="p-3.5 rounded-2xl bg-[#0e1322]/95 border border-pink-500/50 shadow-2xl shadow-pink-500/20 backdrop-blur-xl flex items-center justify-between gap-3 text-white ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce">
                {activeSoundAlert.soundType === 'applause' ? '👏' :
                 activeSoundAlert.soundType === 'whistle' ? '😙🎶' :
                 activeSoundAlert.soundType === 'cheer' ? '🎉' :
                 activeSoundAlert.soundType === 'crowd' ? '🙌🔥' :
                 activeSoundAlert.soundType === 'airhorn' ? '📣' :
                 activeSoundAlert.soundType === 'drums' ? '🥁' :
                 activeSoundAlert.soundType === 'rimshot' ? '🥁✨' :
                 activeSoundAlert.soundType === 'laser' ? '⚡' :
                 activeSoundAlert.soundType === 'vinheta' ? '✨' : '👎'}
              </span>
              <div className="text-left leading-tight">
                <span className="text-[10px] uppercase font-black tracking-wider text-pink-400 block flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping inline-block" />
                  Mesa do DJ • Ao Vivo
                </span>
                <span className="text-xs font-bold text-white">
                  {activeSoundAlert.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1.5 rounded-lg border text-xs transition ${
                  soundEnabled
                    ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}
                title={soundEnabled ? 'Silenciar som no celular' : 'Ativar som no celular'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // If participant is not registered yet, show Clean Welcome & Register Step
  if (!participant) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 my-8">
        {renderSoundboardAlert()}
        <div className="relative rounded-3xl bg-[#0d1222]/90 border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />
          
          <div className="text-center mb-6 relative z-10">
            {session?.branding?.logoUrl ? (
              <div className="flex justify-center mb-4">
                <img
                  src={session.branding.logoUrl}
                  alt={session.branding.businessName || 'Logo'}
                  className="h-14 max-w-[200px] object-contain rounded-xl p-1 bg-black/40 border border-white/10 shadow-lg"
                />
              </div>
            ) : (
              <div className="flex justify-center mb-4">
                <div className="relative p-2 rounded-2xl bg-blue-600/10 border border-blue-500/25 backdrop-blur-md shadow-lg shadow-blue-500/20">
                  <VozPlayMascotIcon
                    size={64}
                    animated
                    themeColor={session?.branding?.primaryColor}
                    themeMode={session?.branding?.themeMode === 'LIGHT' ? 'light' : 'dark'}
                  />
                </div>
              </div>
            )}
            <h2 className="text-2xl font-black text-white tracking-tight">
              {session?.branding?.businessName || session?.establishmentName || 'VozPlay Lounge'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {session?.branding?.slogan || 'Lounge conectado à mesa/unidade'}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-purple-300 font-mono font-bold bg-purple-950/60 px-3 py-1 rounded-xl border border-purple-500/30 text-xs shadow-inner">
                {currentSessionCode}
              </span>
              <button
                type="button"
                onClick={() => setIsQRScannerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-xs font-bold transition active:scale-95 shadow-sm"
              >
                <QrCode className="w-3.5 h-3.5" />
                Escanear Mesa
              </button>
            </div>
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

        {/* QR Code Scanner Modal for Unregistered Visitor */}
        <QRScannerModal
          isOpen={isQRScannerOpen}
          onClose={() => setIsQRScannerOpen(false)}
          currentCode={currentSessionCode}
          onScanSuccess={(code) => {
            setCurrentSessionCode(code);
            showFeedback(`Conectado à mesa ${code}!`, 'success');
          }}
        />
      </div>
    );
  }

  // Active Participant Dashboard
  const liveSong = queue.find((q) => q.status === 'PLAYING');
  const myQueuedSong = queue.find((q) => q.participantId === participant.id && q.status === 'QUEUED');
  const queuedBeforeCount = myQueuedSong
    ? queue.filter((q) => q.status === 'QUEUED' && q.orderIndex < myQueuedSong.orderIndex).length
    : 0;
  const isMyTurnNow = liveSong?.participantId === participant.id;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-28">
      {/* Floating Soundboard Broadcast Alert on Mobile */}
      {renderSoundboardAlert()}

      {/* Global Feedback Message */}
      {actionFeedback && (
        <div
          className={`mb-5 p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shadow-xl animate-in fade-in slide-in-from-top-2 backdrop-blur-md ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* PRD TURN MANAGEMENT: VOCÊ FOI CHAMADO AO PALCO (30 SEGUNDOS) */}
      {isCalled && callingState && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-5 sm:p-7 mb-6 shadow-2xl shadow-amber-600/30 border-2 border-amber-300 ring-4 ring-amber-500/20 text-white relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/20 text-amber-200 text-xs font-black uppercase tracking-wider">
                  <Megaphone className="w-4 h-4 text-amber-300 animate-bounce" />
                  Sua vez chegou! Chamando ao Palco
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 text-white font-mono font-black text-sm border border-white/20">
                  <Timer className="w-4 h-4 text-amber-300" />
                  {callingRemainingSeconds}s restantes
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white drop-shadow">
                {callingState.musicTitle}
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 font-semibold">
                {callingState.musicArtist} {callingState.isDuet && callingState.partnerDisplayName ? `• Dueto com ${callingState.partnerDisplayName}` : ''}
              </p>
              <p className="text-xs text-amber-100/90 max-w-xl">
                Dirija-se ao microfone! Toque no botão abaixo para confirmar sua presença e soltar o áudio e a letra sincronizada no telão.
              </p>
            </div>

            <button
              onClick={handleStartTurn}
              disabled={isStartingTurn}
              className="py-4 px-6 rounded-2xl bg-white hover:bg-amber-50 text-slate-950 font-black text-sm sm:text-base shadow-2xl transition active:scale-95 flex items-center justify-center gap-2.5 flex-shrink-0"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>{isStartingTurn ? 'Iniciando no Telão...' : 'COMEÇAR A CANTAR AGORA'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* NOTIFICAÇÃO DE TURNO PERDIDO (1ª ou 2ª PERDA) */}
      {myQueuedSong?.missedTurnCount !== undefined && myQueuedSong.missedTurnCount > 0 && (
        <div className="rounded-2xl bg-amber-950/60 border border-amber-500/40 p-3.5 mb-5 flex items-center gap-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            {myQueuedSong.missedTurnCount === 1
              ? 'Você não iniciou a apresentação na 1ª chamada de 30s. Sua música permaneceu na fila e você será chamado novamente em breve!'
              : 'Você não respondeu a duas chamadas consecutivas. Sua música foi movida para o final da fila de espera.'}
          </span>
        </div>
      )}

      {/* PRD Seção 43 & 49: Banner Especial - É a sua vez no Palco! */}
      {isMyTurnNow && liveSong && (
        <div className="rounded-2xl bg-gradient-to-r from-pink-600/30 via-purple-600/30 to-indigo-600/30 border-2 border-pink-500/60 p-4 mb-6 shadow-2xl relative overflow-hidden backdrop-blur-xl animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-pink-500/40">
                🎤
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-pink-300">
                  🎉 É a sua vez no palco! Solte a voz!
                </div>
                <div className="text-white font-black text-base sm:text-lg">
                  {liveSong.musicTitle} <span className="text-slate-300 text-xs font-normal">• {liveSong.musicArtist}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => {
                  if (liveSong.musicId) fetchLyrics(liveSong.musicId);
                  setShowLyricsModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/20 shadow-md transition active:scale-95"
              >
                <Music2 className="w-3.5 h-3.5 text-pink-300" />
                <span>Letra no Celular</span>
              </button>
              <button
                onClick={() => onOpenTracker ? onOpenTracker(liveSong.id) : setShareModalItem(liveSong)}
                className="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/30 transition active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Acompanhar & Compartilhar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout (Modular Sidebar + Dynamic Subtab Workspace) */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        <ParticipantSidebar
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
          participant={participant}
          playlistCount={playlist.length}
          wishlistCount={wishlist.length}
          queuedCount={queue.filter((q) => q.status === 'QUEUED').length}
          liveSong={liveSong}
          myQueuedSong={myQueuedSong}
          queuedBeforeCount={queuedBeforeCount}
          isMyTurnNow={isMyTurnNow}
          sendingReaction={sendingReaction}
          onSendReaction={handleSendReaction}
          presenceCodeInput={presenceCodeInput}
          setPresenceCodeInput={setPresenceCodeInput}
          onVerifyPresence={handleVerifyPresence}
          isVerifyingPresence={isVerifyingPresence}
          presenceError={presenceError}
          presenceSuccess={presenceSuccess}
          onOpenTracker={onOpenTracker}
          onRequestCustomSong={() => setShowCustomModal(true)}
          sessionCode={currentSessionCode}
          onOpenQRScanner={() => setIsQRScannerOpen(true)}
        />

        {/* Dynamic Workspace Container */}
        <div className="flex-1 w-full min-w-0">
          {/* Mobile Horizontal Sub-Tab Navigation Bar (visible on screens < lg) */}
          <div className="flex lg:hidden items-center gap-1.5 p-1.5 rounded-2xl bg-[#0c111e]/90 border border-white/[0.07] mb-5 overflow-x-auto shadow-inner no-scrollbar">
            <button
              onClick={() => setActiveSubTab('SEARCH')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'SEARCH'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Explorar</span>
            </button>

            <button
              onClick={() => setActiveSubTab('RECOMMENDATIONS')}
              className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'RECOMMENDATIONS'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'RECOMMENDATIONS' ? 'text-pink-300 animate-pulse' : 'text-purple-400'}`} />
              <span>Playlist IA</span>
            </button>

            <button
              onClick={() => setActiveSubTab('WISHLIST')}
              className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'WISHLIST'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${activeSubTab === 'WISHLIST' ? 'fill-pink-300 text-pink-300' : 'text-pink-400'}`} />
              <span>Desejos</span>
              {wishlist.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-black">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('PLAYLIST')}
              className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'PLAYLIST'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Playlist</span>
              {playlist.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[9px] font-black">
                  {playlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('QUEUE')}
              className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeSubTab === 'QUEUE'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Fila</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold">
                {queue.filter((q) => q.status === 'QUEUED').length}
              </span>
            </button>

            {participant.whatsapp && (
              <button
                onClick={() => setActiveSubTab('HISTORY')}
                className={`flex-1 min-w-[95px] py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeSubTab === 'HISTORY'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
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

          {/* Gemini AI Recommendation Trigger Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-purple-950/70 via-[#13112c] to-[#0c1326] border border-purple-500/25 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-purple-600/30">
                <Sparkles className="w-5 h-5 animate-pulse text-pink-200" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <span>Playlist Recomendada por IA (Gemini)</span>
                  <span className="px-2 py-0.2 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[9px] font-black uppercase">
                    IA
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  {selectedGenre && selectedGenre !== 'Todos'
                    ? `Quer recomendações de ${selectedGenre}? O Gemini seleciona os hinos perfeitos com tons confortáveis e dicas de palco!`
                    : 'Deixe o Gemini sugerir uma playlist personalizada com os maiores sucessos do seu gênero musical favorito!'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSubTab('RECOMMENDATIONS')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-purple-600/25 active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
              <span>
                {selectedGenre && selectedGenre !== 'Todos'
                  ? `Sugerir Playlist de ${selectedGenre}`
                  : 'Gerar Playlist com IA'}
              </span>
            </button>
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

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Botão Rápido de Lista de Desejos */}
                    {(() => {
                      const isWishlisted = wishlist.some((w) => w.musicId === m.id);
                      return (
                        <button
                          type="button"
                          id={`btn-wishlist-toggle-${m.id}`}
                          onClick={() => handleToggleWishlist(m)}
                          className={`p-2.5 rounded-xl border transition-all active:scale-90 flex items-center justify-center ${
                            isWishlisted
                              ? 'bg-pink-500/20 border-pink-500/50 text-pink-400 shadow-md shadow-pink-500/20'
                              : 'bg-white/[0.04] hover:bg-pink-500/10 border-white/[0.08] hover:border-pink-500/30 text-slate-400 hover:text-pink-300'
                          }`}
                          title={isWishlisted ? 'Remover da Lista de Desejos' : 'Salvar na Lista de Desejos (Quero Cantar)'}
                        >
                          <Heart className={`w-4 h-4 transition-transform ${isWishlisted ? 'fill-pink-500 text-pink-500 scale-110' : ''}`} />
                        </button>
                      );
                    })()}

                    <button
                      type="button"
                      id={`btn-preview-${m.id}`}
                      onClick={() => {
                        setSelectedMusic(m);
                        setSelectedVersion(m.versions[0]);
                        setIsPreviewPlaying(true);
                      }}
                      className="p-2.5 rounded-xl border border-white/[0.08] hover:border-purple-500/30 bg-white/[0.04] hover:bg-purple-500/10 text-slate-400 hover:text-purple-300 transition-all flex items-center justify-center active:scale-90"
                      title="Ouvir prévia no seu aparelho antes de mandar para a TV"
                    >
                      <Headphones className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-sing-${m.id}`}
                      onClick={() => {
                        setSelectedMusic(m);
                        setSelectedVersion(m.versions[0]);
                        setIsPreviewPlaying(false);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-purple-600/25 transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <Mic2 className="w-3.5 h-3.5" />
                      <span>Cantar</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 1.2: PLAYLIST RECOMENDADA POR IA (GEMINI) */}
      {activeSubTab === 'RECOMMENDATIONS' && (
        <RecommendedPlaylistView
          participant={participant}
          initialGenre={selectedGenre}
          catalog={catalog}
          wishlistIds={new Set(wishlist.map((w) => w.musicId))}
          onSelectSongToSing={(music, preferredTone) => {
            setSelectedMusic(music);
            setSelectedVersion(music.versions[0] || null);
            setSelectedToneOffset(preferredTone ?? 0);
          }}
          onAddToWishlist={(music, preferredTone) => {
            handleToggleWishlist(music, music.versions[0], preferredTone ?? 0);
          }}
          onAddToPlaylist={(music, preferredTone) => {
            if (music.versions[0]) {
              setSelectedToneOffset(preferredTone ?? 0);
              handleAddToPlaylist(music, music.versions[0]);
            }
          }}
          onRequestCustomSong={(prefillTitle, prefillArtist, prefillGenre) => {
            if (prefillTitle) setCustomTitle(prefillTitle);
            if (prefillArtist) setCustomArtist(prefillArtist);
            if (prefillGenre) setCustomStyle('Karaokê');
            setShowCustomModal(true);
          }}
          onBackToCatalog={() => setActiveSubTab('SEARCH')}
        />
      )}

      {/* TAB 1.5: LISTA DE DESEJOS (WISHLIST - PRÓXIMAS RODADAS) */}
      {activeSubTab === 'WISHLIST' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Hero Banner */}
          <div className="rounded-3xl bg-gradient-to-br from-pink-950/40 via-[#130f24]/90 to-[#0a0d18] border border-pink-500/25 p-5 sm:p-7 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[11px] font-bold tracking-wide uppercase mb-3">
                  <Heart className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                  <span>Lista de Desejos • Próximas Rodadas</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight mb-2">
                  Músicas que você quer cantar hoje à noite
                </h2>
                <p className="text-xs sm:text-sm text-slate-300/90 max-w-xl leading-relaxed">
                  Guarde suas preferências vocais com antecedência. Quando o microfone estiver livre para a sua próxima rodada, mande direto para a fila em apenas 1 toque com o tom já ajustado!
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('SEARCH')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 border border-white/10"
                >
                  <Plus className="w-4 h-4" />
                  <span>Explorar Catálogo</span>
                </button>
                {wishlist.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearWishlist}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 font-medium text-xs transition-all flex items-center gap-1.5"
                    title="Limpar todas as músicas salvas na lista de desejos"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Lista</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats Pill */}
            {wishlist.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium text-pink-300">
                  <Heart className="w-3.5 h-3.5 fill-pink-400" />
                  <strong>{wishlist.length}</strong> {wishlist.length === 1 ? 'música salva' : 'músicas salvas'}
                </span>
                <span>•</span>
                <span>Tom vocal ajustável por semitom (-3 a +3)</span>
                <span>•</span>
                <span>Sincronizado na nuvem e no seu aparelho</span>
              </div>
            )}
          </div>

          {/* Search & Genre Filters for Wishlist */}
          {wishlist.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <Search className="w-4 h-4 text-pink-400 absolute left-4 top-1/2 -translate-y-1/2 transition-colors" />
                  <input
                    type="text"
                    value={wishlistSearchQuery}
                    onChange={(e) => setWishlistSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome de música ou artista na sua lista..."
                    className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[#090d18] border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30 transition shadow-inner"
                  />
                  {wishlistSearchQuery && (
                    <button
                      onClick={() => setWishlistSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Genre chips in wishlist */}
                {(() => {
                  const uniqueGenres = ['Todos', ...Array.from(new Set(wishlist.map((w) => w.genre).filter(Boolean)))];
                  if (uniqueGenres.length <= 2) return null;
                  return (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {uniqueGenres.map((genre) => (
                        <button
                          key={genre}
                          onClick={() => setWishlistGenreFilter(genre)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                            wishlistGenreFilter === genre
                              ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                              : 'bg-[#0e1322] text-slate-400 border border-white/[0.08] hover:text-slate-200'
                          }`}
                        >
                          {genre}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Wishlist Items List */}
          {wishlist.length === 0 ? (
            <div className="p-10 sm:p-14 text-center rounded-3xl bg-[#0e1322]/80 border border-pink-500/20 text-slate-400 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center mx-auto shadow-xl shadow-pink-500/10">
                <Heart className="w-8 h-8 fill-pink-500/30" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h4 className="text-white font-bold text-base sm:text-lg">Sua Lista de Desejos está vazia</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ao navegar pelo catálogo de músicas, clique no ícone de coração <strong>♡</strong> para salvar as faixas que você planeja cantar durante a noite.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubTab('SEARCH')}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-xl shadow-purple-600/25 transition inline-flex items-center gap-2 active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>Explorar Catálogo Musical</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const filtered = wishlist.filter((item) => {
                  const matchSearch =
                    !wishlistSearchQuery.trim() ||
                    item.musicTitle.toLowerCase().includes(wishlistSearchQuery.toLowerCase()) ||
                    item.musicArtist.toLowerCase().includes(wishlistSearchQuery.toLowerCase());
                  const matchGenre = wishlistGenreFilter === 'Todos' || item.genre === wishlistGenreFilter;
                  return matchSearch && matchGenre;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center rounded-2xl bg-[#0e1322] border border-white/10 text-slate-400 text-xs">
                      Nenhuma música na lista de desejos corresponde ao filtro pesquisado.
                    </div>
                  );
                }

                return filtered.map((item) => {
                  const tone = item.preferredToneOffset !== undefined ? item.preferredToneOffset : 0;
                  return (
                    <div
                      key={item.id}
                      className="group rounded-2xl bg-[#0e1324]/85 hover:bg-[#141b32] border border-white/[0.08] hover:border-pink-500/40 p-3.5 sm:p-4 transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-pink-950/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                        {/* Info & Cover */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative w-14 sm:w-16 h-14 sm:h-16 rounded-2xl overflow-hidden bg-slate-900 flex-shrink-0 shadow-lg ring-1 ring-white/10">
                            <img
                              src={item.coverUrl || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=160&q=80'}
                              alt={item.musicTitle}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute top-1 left-1 p-1 rounded-full bg-black/60 backdrop-blur-sm">
                              <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500" />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm sm:text-base font-display font-bold text-white truncate group-hover:text-pink-200 transition-colors">
                              {item.musicTitle}
                            </h4>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{item.musicArtist}</p>

                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-500/10 text-pink-300 font-semibold border border-pink-500/20">
                                {item.genre}
                              </span>
                              {item.preferredVersionStyle && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-slate-300 font-medium">
                                  {item.preferredVersionStyle === 'acustico'
                                    ? 'Acústico'
                                    : item.preferredVersionStyle === 'live'
                                    ? 'Ao Vivo'
                                    : 'Karaokê Oficial'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tone Stepper & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap sm:flex-nowrap border-t sm:border-t-0 pt-2.5 sm:pt-0 border-white/[0.06]">
                          {/* Stepper de Tom Vocal */}
                          <div
                            className="flex items-center gap-1.5 bg-[#080c16] px-2.5 py-1.5 rounded-xl border border-white/[0.08]"
                            title="Ajuste o tom vocal para esta música desejada"
                          >
                            <span className="text-[10px] font-bold text-slate-400 mr-1 hidden sm:inline">Tom:</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateWishlistTone(item.id, tone - 1)}
                              disabled={tone <= -3}
                              className="w-6 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition active:scale-95"
                            >
                              -
                            </button>
                            <span
                              className={`text-xs font-mono font-bold px-1.5 min-w-[32px] text-center ${
                                tone === 0
                                  ? 'text-emerald-400'
                                  : tone > 0
                                  ? 'text-amber-400'
                                  : 'text-cyan-400'
                              }`}
                            >
                              {tone > 0 ? `+${tone}` : tone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateWishlistTone(item.id, tone + 1)}
                              disabled={tone >= 3}
                              className="w-6 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center transition active:scale-95"
                            >
                              +
                            </button>
                          </div>

                          {/* Botão Cantar Nesta Rodada */}
                          <button
                            type="button"
                            onClick={() => handleSingFromWishlist(item)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-pink-600/25 transition-all flex items-center gap-1.5 active:scale-95 flex-shrink-0"
                          >
                            <Mic2 className="w-3.5 h-3.5" />
                            <span>Cantar Agora</span>
                          </button>

                          {/* Botão Remover */}
                          <button
                            type="button"
                            onClick={() => handleRemoveFromWishlist(item.id, item.musicTitle)}
                            className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-white/[0.06] hover:border-rose-500/30 transition active:scale-95"
                            title="Remover da lista de desejos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
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
                        <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>{item.musicArtist} • Cantado por:</span>
                          <span className="text-slate-200 font-bold">{item.participantDisplayName}</span>
                          {item.isDuet && item.partnerDisplayName && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                              <Users className="w-3 h-3 text-pink-400" />
                              & {item.partnerDisplayName}
                            </span>
                          )}
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

      {/* TAB 4: PERSONAL HISTORY (PRD Seção 41: "Você já cantou esta versão X vezes") */}
      {activeSubTab === 'HISTORY' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#0e1322]/90 border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Identidade Persistente</h3>
                  <p className="text-xs text-slate-400">Vinculada ao WhatsApp <span className="text-purple-300 font-mono font-bold">{participant.whatsapp}</span></p>
                </div>
              </div>

              <button
                onClick={() => fetchHistory(participant.id)}
                className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition active:scale-95"
                title="Atualizar Histórico"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-2xl bg-[#090D18] border border-white/[0.07]">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Músicas Cantadas</span>
                <span className="text-2xl font-black text-white mt-1 block">
                  {participantHistory?.totalSung ?? 0}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-[#090D18] border border-white/[0.07]">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Visitas à Casa</span>
                <span className="text-2xl font-black text-purple-300 mt-1 block">
                  {participantHistory?.totalParticipations ?? 1}
                </span>
              </div>
            </div>

            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Histórico e Versões Cantadas</h4>
            {(!participantHistory?.historyItems || participantHistory.historyItems.length === 0) ? (
              <div className="p-8 text-center rounded-2xl bg-[#090D18] border border-white/[0.06] text-slate-400 text-xs">
                Você ainda não concluiu nenhuma música no palco nesta sessão. Adicione sua música à fila e solte a voz!
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {participantHistory.historyItems.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[#090D18] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-purple-500/30 transition">
                    <div className="min-w-0">
                      <div className="text-slate-100 font-bold truncate">{item.musicTitle}</div>
                      <div className="text-[11px] text-slate-400 truncate">{item.musicArtist} • Versão {item.versionStyle}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 whitespace-nowrap shadow-sm">
                      {item.badgeText}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* CONFIRM VERSION & VOCAL TUNER MODAL (Section 21, 22, 23) */}
      {selectedMusic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0d1222] border border-white/15 p-5 sm:p-7 shadow-2xl text-slate-100 relative ring-1 ring-white/10">
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

            {/* In-App Device Audio/Video Preview (Ouvir Prévia no Aparelho) */}
            <div className="p-4 rounded-2xl bg-[#080c16] border border-purple-500/30 space-y-3 mb-5 shadow-inner relative z-10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md shadow-purple-600/30 flex-shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">Prévia no seu Aparelho</span>
                    <span className="text-[10px] text-slate-400">Ouça nos fones ou alto-falante do celular</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPreviewPlaying((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                    isPreviewPlaying
                      ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 hover:bg-rose-600/40'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-600/20'
                  }`}
                >
                  {isPreviewPlaying ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                      <span>Pausar Prévia</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Ouvir Prévia</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Escute a introdução e o tom antes de confirmar para a TV. Isso evita escolher a versão errada ou desistir quando já estiver no palco!
              </p>

              {isPreviewPlaying && selectedVersion && (
                <div className="pt-1 space-y-2 animate-in fade-in duration-200">
                  <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-purple-500/40 shadow-xl relative ring-1 ring-white/10">
                    <iframe
                      src={`https://www.youtube.com/embed/${selectedVersion.youtubeVideoId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`}
                      title={`Prévia: ${selectedMusic.title}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Tocando apenas no seu celular (o telão não é afetado)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPreviewPlaying(false)}
                      className="text-slate-400 hover:text-white underline text-[10px]"
                    >
                      Fechar prévia
                    </button>
                  </div>
                </div>
              )}
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

            {/* PRD: Cantar em Dupla (Dueto) */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsDuetSelected(!isDuetSelected)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white transition"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                    isDuetSelected ? 'bg-pink-500 border-pink-400 text-white' : 'bg-white/5 border-white/20'
                  }`}>
                    {isDuetSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className="flex items-center gap-1.5 text-pink-300">
                    <Users className="w-3.5 h-3.5" />
                    Cantar em Dupla (Dueto com Amigo)
                  </span>
                </button>
                <span className="text-[10px] text-slate-400">2 microfones no palco</span>
              </div>

              {isDuetSelected && (
                <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                  <label className="text-[11px] text-slate-300 font-semibold block">
                    Nome do(a) parceiro(a) de palco:
                  </label>
                  <input
                    type="text"
                    value={duetPartnerName}
                    onChange={(e) => setDuetPartnerName(e.target.value)}
                    placeholder="Ex: Mariana, Carlos..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-pink-500/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    O nome aparecerá no telão da TV e na cabine de som do operador.
                  </p>
                </div>
              )}
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

              {(() => {
                const isWishlisted = wishlist.some((w) => w.musicId === selectedMusic.id);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedVersion) {
                        handleToggleWishlist(selectedMusic, selectedVersion, selectedToneOffset);
                      }
                    }}
                    className={`py-4 px-4 rounded-2xl font-bold text-xs border transition-all flex items-center justify-center gap-2 active:scale-95 ${
                      isWishlisted
                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-md shadow-pink-500/15'
                        : 'bg-white/[0.04] hover:bg-pink-500/10 border-white/[0.12] hover:border-pink-500/30 text-slate-200'
                    }`}
                    title="Guardar na lista de desejos com este tom para as próximas rodadas"
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-pink-400 text-pink-400' : 'text-pink-400'}`} />
                    <span>{isWishlisted ? 'Na Lista de Desejos' : 'Salvar nos Desejos'}</span>
                  </button>
                );
              })()}

              <button
                onClick={() => selectedVersion && handleAddToPlaylist(selectedMusic, selectedVersion)}
                className="py-4 px-4 rounded-2xl bg-[#090d18] hover:bg-white/[0.08] text-slate-200 font-bold text-xs border border-white/[0.12] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar Playlist</span>
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedMusic(null);
                setIsDuetSelected(false);
                setDuetPartnerName('');
                setIsPreviewPlaying(false);
              }}
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
                  const shareText = `🎤 Vou cantar "${shareModalItem.musicTitle}" no VozPlay! Acompanhe minha vez em tempo real: https://vozplay.ai.slz.br/v/${shareModalItem.id}`;
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    navigator.share({
                      title: `VozPlay - ${shareModalItem.musicTitle}`,
                      text: shareText,
                      url: `https://vozplay.ai.slz.br/v/${shareModalItem.id}`
                    }).catch(() => {});
                    return;
                  }
                  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
                  const anchor = document.createElement('a');
                  anchor.href = whatsappUrl;
                  anchor.target = '_blank';
                  anchor.rel = 'noopener noreferrer';
                  anchor.click();
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

      {/* Floating Live Stage Bar & Instant Reaction Pod (Section 48) - Mobile only */}
      {liveSong && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40 lg:hidden">
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

      {/* QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        currentCode={currentSessionCode}
        onScanSuccess={(code) => {
          setCurrentSessionCode(code);
          showFeedback(`Conectado com sucesso à ${code}!`, 'success');
        }}
      />

      {/* PRD: LIVE KARAOKE LYRICS MODAL FOR MOBILE SINGER */}
      <AnimatePresence>
        {showLyricsModal && liveSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#090d1a] border border-pink-500/40 w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl shadow-pink-950/50 flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3.5 border-b border-white/10 gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[10px] font-black uppercase tracking-wider mb-1">
                    <Radio className="w-3 h-3 text-pink-400 animate-pulse" />
                    <span>Ao Vivo no Palco</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-display font-black text-white truncate">
                    {liveSong.musicTitle}
                  </h3>
                  <div className="text-xs text-slate-400">
                    {liveSong.musicArtist} • <span className="text-purple-300 font-semibold">{liveSong.versionStyle}</span>
                    {liveSong.toneOffset !== undefined && liveSong.toneOffset !== 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                        Tom {liveSong.toneOffset > 0 ? `+${liveSong.toneOffset}` : liveSong.toneOffset}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowLyricsModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition active:scale-95"
                  title="Minimizar Letra"
                >
                  ✕
                </button>
              </div>

              {/* Lyrics Scrolling Area */}
              <div className="flex-1 overflow-y-auto py-6 space-y-4 text-center my-2 pr-1 select-none">
                {lyricsLines.length === 0 ? (
                  <div className="py-12 text-slate-500 text-xs sm:text-sm">
                    Carregando letra sincronizada do karaokê...
                  </div>
                ) : (
                  lyricsLines.map((line, idx) => {
                    const isCurrent = idx === activeLyricIndex;
                    const isPast = idx < activeLyricIndex;
                    return (
                      <div
                        key={idx}
                        onClick={() => setActiveLyricIndex(idx)}
                        className={`transition-all duration-300 cursor-pointer rounded-xl px-3 py-2 ${
                          isCurrent
                            ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/25 to-pink-500/20 border border-pink-500/40 text-white font-black text-base sm:text-xl scale-105 shadow-lg shadow-pink-500/10'
                            : isPast
                            ? 'text-slate-600 font-semibold text-xs sm:text-sm opacity-50'
                            : 'text-slate-300 font-medium text-xs sm:text-sm opacity-85 hover:opacity-100'
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Navigation & Controls */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveLyricIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeLyricIndex <= 0}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs font-bold transition"
                >
                  ← Linha Anterior
                </button>

                <span className="text-[11px] font-mono text-slate-400">
                  {lyricsLines.length > 0 ? `${activeLyricIndex + 1} de ${lyricsLines.length}` : '—'}
                </span>

                <button
                  onClick={() => setActiveLyricIndex((prev) => Math.min(lyricsLines.length - 1, prev + 1))}
                  disabled={lyricsLines.length === 0 || activeLyricIndex >= lyricsLines.length - 1}
                  className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 disabled:opacity-30 text-white text-xs font-bold transition"
                >
                  Próxima Linha →
                </button>
              </div>

              {/* Quick Reactions Bar inside modal */}
              <div className="pt-3 flex items-center justify-center gap-2">
                {[
                  { emoji: '👏', label: 'Aplausos' },
                  { emoji: '🔥', label: 'Arrasou!' },
                  { emoji: '❤️', label: 'Amei' },
                  { emoji: '🎤', label: 'Canta Muito!' }
                ].map((rx) => (
                  <button
                    key={rx.emoji}
                    onClick={() => handleSendReaction(rx.emoji, rx.label)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-pink-500/20 text-xs font-bold text-slate-200 border border-white/10 transition active:scale-95 flex items-center gap-1"
                  >
                    <span>{rx.emoji}</span>
                    <span className="text-[10px]">{rx.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

