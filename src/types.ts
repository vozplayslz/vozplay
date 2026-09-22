/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Core Types & DTOs
 * Plataforma de Karaokê para Estabelecimentos
 * Dominio: vozplay.ai.slz.br
 */

export type Role = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'SYSTEM_ADMIN';
export type ActiveTab = 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV' | 'TRACKER';
export type ClientType = 'PWA' | 'ANDROID' | 'ANDROID_TV';
export type SessionStatus = 'CREATED' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'EXPIRED';
export type PlaybackStatus = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ERROR' | 'COMPLETED';

export type QueueItemStatus = 
  | 'QUEUED'
  | 'PLAYING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELLED_SESSION_ENDED'
  | 'ERROR';

export type MusicVersionStyle = 
  | 'karaoke'
  | 'playback'
  | 'acustico'
  | 'original'
  | 'instrumental'
  | 'cover'
  | 'live'
  | 'remix'
  | 'Estilo não identificado';

export interface MusicVersion {
  id: string;
  musicId: string;
  style: MusicVersionStyle;
  label: string;
  youtubeVideoId: string;
  durationSec: number;
  quality?: string;
  audioKey?: string;
}

export interface Music {
  id: string;
  title: string;
  artist: string;
  genre: string;
  coverUrl?: string;
  versions: MusicVersion[];
}

export interface PlaylistItem {
  id: string;
  participantId: string;
  musicId: string;
  versionId: string;
  musicTitle: string;
  musicArtist: string;
  versionStyle: MusicVersionStyle;
  youtubeVideoId: string;
  toneOffset?: number; // -3 to +3 semitones (0 is default original)
  status: 'DRAFT' | 'QUEUED' | 'SUNG' | 'CANCELLED';
  createdAt: string;
}

export interface QueueItem {
  id: string;
  sessionId: string;
  participantId: string;
  participantDisplayName: string;
  musicId: string;
  musicTitle: string;
  musicArtist: string;
  versionId: string;
  versionStyle: MusicVersionStyle;
  youtubeVideoId: string;
  toneOffset?: number; // -3 to +3 semitones
  status: QueueItemStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  orderIndex: number;
}

export interface Session {
  id: string;
  establishmentId: string;
  establishmentName: string;
  name: string;
  code: string;
  status: SessionStatus;
  startedAt: string;
  scheduledEndTime?: string;
  endedAt?: string;
  activeControllerId?: string;
  activeControllerName?: string;
  supervisorId: string;
  supervisorName: string;
  createdAt: string;
}

export interface PresenceCode {
  code: string;
  sessionId: string;
  controllerId: string;
  createdAt: string;
  expiresAt: string;
  remainingSeconds: number;
}

export interface Participant {
  id: string;
  sessionId: string;
  displayName: string;
  whatsapp?: string;
  isVerified: boolean;
  verifiedAt?: string;
  identityId?: string;
  joinedAt: string;
}

export interface ParticipantIdentity {
  id: string;
  normalizedWhatsapp: string;
  displayName: string;
  consentMarketing: boolean;
  consentTimestamp?: string;
  totalParticipations: number;
  firstSeen: string;
  lastSeen: string;
}

export interface TVSessionDTO {
  sessionId: string;
  establishmentName: string;
  sessionName: string;
  status: SessionStatus;
  currentSong: {
    id: string;
    title: string;
    artist: string;
    versionStyle: MusicVersionStyle;
    youtubeVideoId: string;
    participantDisplayName: string;
    toneOffset?: number;
  } | null;
  queue: Array<{
    id: string;
    title: string;
    artist: string;
    versionStyle: MusicVersionStyle;
    participantDisplayName: string;
    toneOffset?: number;
  }>;
  playbackState: PlaybackStatus;
  sessionAlert: {
    message: string;
    type: 'info' | 'warning' | 'error';
    timestamp: string;
  } | null;
  volume?: number;
  isMuted?: boolean;
  scheduledEndTime?: string;
  qrCodeUrl: string;
}

export interface Lead {
  id: string;
  name: string;
  normalizedWhatsapp: string;
  establishmentId: string;
  firstParticipation: string;
  lastParticipation: string;
  participationsCount: number;
  consentMarketing: boolean;
  consentDate?: string;
  origin: 'PARTICIPANTE' | 'CONTROLADOR_SESSAO';
}

export interface SessionMetrics {
  totalParticipants: number;
  totalSongsSearched: number;
  totalSongsQueued: number;
  totalSongsPlayed: number;
  totalCancellations: number;
  totalSkips: number;
  playbackErrors: number;
  averageQueueWaitMinutes: number;
}

export interface SessionNotification {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

export interface AuditLog {
  id: string;
  sessionId: string;
  actorRole: Role;
  actorName: string;
  action: string;
  details: string;
  timestamp: string;
}

// WebSocket Event Types
export type WSEventType =
  | 'session.started'
  | 'session.updated'
  | 'session.ended'
  | 'session.alert'
  | 'participant.joined'
  | 'participant.verified'
  | 'queue.added'
  | 'queue.updated'
  | 'queue.cancelled'
  | 'queue.playing'
  | 'queue.completed'
  | 'player.play'
  | 'player.pause'
  | 'player.next'
  | 'player.skip'
  | 'player.error'
  | 'player.state_changed'
  | 'player.volume'
  | 'controller.assigned'
  | 'controller.changed'
  | 'controller.revoked'
  | 'presence.renewed'
  | 'tv.connected'
  | 'tv.disconnected'
  | 'reaction.sent'
  | 'soundboard.play'
  | 'state.sync';

export interface WSMessage<T = unknown> {
  event: WSEventType;
  sessionId: string;
  payload: T;
  timestamp: string;
}
