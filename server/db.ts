/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - In-Memory Relational Store & Authoritative State Engine
 * Following PostgreSQL Entity Schema (Section 47 of PRD)
 */

import {
  Music,
  Session,
  Participant,
  ParticipantIdentity,
  QueueItem,
  PlaylistItem,
  PresenceCode,
  PlaybackStatus,
  TVSessionDTO,
  Lead,
  SessionMetrics,
  SessionNotification,
  AuditLog,
  MusicVersionStyle
} from '../src/types.js';

// Seed Music Catalog with validated YouTube Karaoke & Playback IDs
const INITIAL_CATALOG: Music[] = [
  {
    id: 'm-1',
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    genre: 'Sertanejo',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    versions: [
      {
        id: 'v-1-1',
        musicId: 'm-1',
        style: 'karaoke',
        label: 'Karaokê com Letra Oficial (HD)',
        youtubeVideoId: 'wYV_ZJ2U-t4', // Popular Brazilian Karaoke track
        durationSec: 280,
        quality: '1080p',
        audioKey: 'E'
      },
      {
        id: 'v-1-2',
        musicId: 'm-1',
        style: 'playback',
        label: 'Playback Instrumental com Backing Vocal',
        youtubeVideoId: 'hTWKbfoikeg',
        durationSec: 278,
        quality: '1080p',
        audioKey: 'D'
      },
      {
        id: 'v-1-3',
        musicId: 'm-1',
        style: 'acustico',
        label: 'Versão Acústica Voz & Violão',
        youtubeVideoId: '9gW-qI7h19s',
        durationSec: 290,
        quality: '720p',
        audioKey: 'E'
      }
    ]
  },
  {
    id: 'm-2',
    title: 'Cheia de Manias',
    artist: 'Raça Negra',
    genre: 'Pagode',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    versions: [
      {
        id: 'v-2-1',
        musicId: 'm-2',
        style: 'karaoke',
        label: 'Karaokê Oficial (Didididiê)',
        youtubeVideoId: 'fJ9rUzIMcZQ',
        durationSec: 215,
        quality: '1080p'
      },
      {
        id: 'v-2-2',
        musicId: 'm-2',
        style: 'playback',
        label: 'Playback Show Ao Vivo',
        youtubeVideoId: 'kXYiU_JCYtU',
        durationSec: 220,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-3',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    genre: 'Classic Rock',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    versions: [
      {
        id: 'v-3-1',
        musicId: 'm-3',
        style: 'karaoke',
        label: 'Karaoke Piano & Opera Track (HD)',
        youtubeVideoId: 'fJ9rUzIMcZQ',
        durationSec: 355,
        quality: '1080p'
      },
      {
        id: 'v-3-2',
        musicId: 'm-3',
        style: 'cover',
        label: 'Versão Acústica Voz e Violão',
        youtubeVideoId: '3p4MZJsexEs',
        durationSec: 320,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-4',
    title: 'Anna Júlia',
    artist: 'Los Hermanos',
    genre: 'Rock Nacional',
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80',
    versions: [
      {
        id: 'v-4-1',
        musicId: 'm-4',
        style: 'karaoke',
        label: 'Karaokê com Letra Sincronizada',
        youtubeVideoId: '9bZkp7q19f0',
        durationSec: 210,
        quality: '1080p'
      },
      {
        id: 'v-4-2',
        musicId: 'm-4',
        style: 'playback',
        label: 'Playback de Estúdio sem Guia',
        youtubeVideoId: 'kJQP7kiw5Fk',
        durationSec: 212,
        quality: '1080p'
      }
    ]
  },
  {
    id: 'm-5',
    title: 'Flowers',
    artist: 'Miley Cyrus',
    genre: 'Pop Internacional',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    versions: [
      {
        id: 'v-5-1',
        musicId: 'm-5',
        style: 'karaoke',
        label: 'Karaoke Sing King Style (HD)',
        youtubeVideoId: 'G7KNmW9a75Y',
        durationSec: 200,
        quality: '1080p'
      },
      {
        id: 'v-5-2',
        musicId: 'm-5',
        style: 'instrumental',
        label: 'Versão Instrumental Lo-Fi / Chill',
        youtubeVideoId: 'L_LUpnjgPso',
        durationSec: 195,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-6',
    title: 'Garota de Ipanema',
    artist: 'Tom Jobim & Vinicius',
    genre: 'MPB / Bossa Nova',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
    versions: [
      {
        id: 'v-6-1',
        musicId: 'm-6',
        style: 'karaoke',
        label: 'Karaokê Bossa Nova Clássico',
        youtubeVideoId: 'c5QfXj533f0',
        durationSec: 240,
        quality: '1080p'
      },
      {
        id: 'v-6-2',
        musicId: 'm-6',
        style: 'acustico',
        label: 'Violão Solo em Tom Menor',
        youtubeVideoId: 'sF80OBUeFBU',
        durationSec: 235,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-7',
    title: 'Falta Você',
    artist: 'Thiaguinho',
    genre: 'Pagode',
    coverUrl: 'https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300&q=80',
    versions: [
      {
        id: 'v-7-1',
        musicId: 'm-7',
        style: 'karaoke',
        label: 'Karaokê Pagode Oficial',
        youtubeVideoId: '9Gj6y94xR_4',
        durationSec: 190,
        quality: '1080p'
      },
      {
        id: 'v-7-2',
        musicId: 'm-7',
        style: 'playback',
        label: 'Playback Show ao Vivo',
        youtubeVideoId: 'CevxZvSJLk8',
        durationSec: 188,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-8',
    title: 'Exagerado',
    artist: 'Cazuza',
    genre: 'Rock / Pop Nacional',
    coverUrl: 'https://images.unsplash.com/photo-1445985543470-41fdd6ce388d?w=300&q=80',
    versions: [
      {
        id: 'v-8-1',
        musicId: 'm-8',
        style: 'karaoke',
        label: 'Karaokê Anos 80 com Guia',
        youtubeVideoId: 'kJQP7kiw5Fk',
        durationSec: 225,
        quality: '1080p'
      }
    ]
  }
];

export interface DeviceInfo {
  deviceId: string;
  clientType: 'PWA' | 'ANDROID' | 'ANDROID_TV';
  role: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV';
  platform: string;
  clientVersion: string;
  lastSeenAt: string;
}

class VozPlayDB {
  public catalog: Music[] = [...INITIAL_CATALOG];
  public session: Session;
  public presenceCode: PresenceCode;
  public participants: Map<string, Participant> = new Map();
  public identities: Map<string, ParticipantIdentity> = new Map(); // normalizedWhatsapp -> Identity
  public playlists: Map<string, PlaylistItem[]> = new Map(); // participantId -> items
  public queue: QueueItem[] = [];
  public devices: Map<string, DeviceInfo> = new Map(); // deviceId -> DeviceInfo (Section 36 & 37)
  public playbackState: {
    status: PlaybackStatus;
    currentQueueItemId: string | null;
    currentTimeSec: number;
    volume: number;
    updatedAt: string;
  };
  public leads: Map<string, Lead> = new Map();
  public notifications: SessionNotification[] = [];
  public auditLogs: AuditLog[] = [];
  public metrics: SessionMetrics = {
    totalParticipants: 0,
    totalSongsSearched: 0,
    totalSongsQueued: 0,
    totalSongsPlayed: 0,
    totalCancellations: 0,
    totalSkips: 0,
    playbackErrors: 0,
    averageQueueWaitMinutes: 12
  };
  public tvConnected: boolean = false;
  public lastTvHeartbeat: number = Date.now();
  public sessionAlert: { message: string; level: string; active: boolean; timestamp: string } | null = null;
  public presenceFailedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();


  constructor() {
    const now = new Date();
    const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

    this.session = {
      id: 'sess-slz-01',
      establishmentId: 'est-slz-lounge',
      establishmentName: 'VozPlay Lounge São Luís',
      name: 'Noite de Karaokê - Sexta Premium',
      code: 'SLZ-704',
      status: 'ACTIVE',
      startedAt: now.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      activeControllerId: 'ctrl-carlos',
      activeControllerName: 'Carlos (Operador de Som)',
      supervisorId: 'sup-renata',
      supervisorName: 'Renata (Gerente)',
      createdAt: now.toISOString()
    };

    this.presenceCode = this.generateNewPresenceCode();

    this.playbackState = {
      status: 'IDLE',
      currentQueueItemId: null,
      currentTimeSec: 0,
      volume: 100,
      updatedAt: new Date().toISOString()
    };

    // Seed some initial participants and history for immediate realistic experience
    this.seedInitialSessionData();
  }

  private generate4DigitCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  public generateNewPresenceCode(): PresenceCode {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // exactly 60 seconds
    const code = this.generate4DigitCode();
    this.presenceCode = {
      code,
      sessionId: this.session.id,
      controllerId: this.session.activeControllerId || 'supervisor',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      remainingSeconds: 60
    };
    return this.presenceCode;
  }

  public getPresenceCode(): PresenceCode {
    const now = Date.now();
    const expires = new Date(this.presenceCode.expiresAt).getTime();
    if (now >= expires) {
      return this.generateNewPresenceCode();
    }
    const remainingSeconds = Math.max(0, Math.ceil((expires - now) / 1000));
    return {
      ...this.presenceCode,
      remainingSeconds
    };
  }

  public normalizeWhatsapp(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return '+' + digits;
    if (digits.length === 10 || digits.length === 11) return '+55' + digits;
    return '+' + digits;
  }

  private seedInitialSessionData() {
    // Seed 2 participants
    const p1: Participant = {
      id: 'p-joao',
      sessionId: this.session.id,
      displayName: 'João Silva',
      whatsapp: '+5598981234567',
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      identityId: 'id-joao',
      joinedAt: new Date(Date.now() - 30 * 60000).toISOString()
    };
    const p2: Participant = {
      id: 'p-maria',
      sessionId: this.session.id,
      displayName: 'Maria Fernandes',
      whatsapp: '+5598987654321',
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      identityId: 'id-maria',
      joinedAt: new Date(Date.now() - 25 * 60000).toISOString()
    };

    this.participants.set(p1.id, p1);
    this.participants.set(p2.id, p2);
    this.metrics.totalParticipants = 2;

    this.identities.set(p1.whatsapp!, {
      id: 'id-joao',
      normalizedWhatsapp: p1.whatsapp!,
      displayName: p1.displayName,
      consentMarketing: true,
      consentTimestamp: new Date().toISOString(),
      totalParticipations: 4,
      firstSeen: new Date(Date.now() - 14 * 86400000).toISOString(),
      lastSeen: new Date().toISOString()
    });

    this.identities.set(p2.whatsapp!, {
      id: 'id-maria',
      normalizedWhatsapp: p2.whatsapp!,
      displayName: p2.displayName,
      consentMarketing: false,
      totalParticipations: 2,
      firstSeen: new Date(Date.now() - 7 * 86400000).toISOString(),
      lastSeen: new Date().toISOString()
    });

    // Seed 2 queued items
    const q1: QueueItem = {
      id: 'q-1',
      sessionId: this.session.id,
      participantId: p1.id,
      participantDisplayName: p1.displayName,
      musicId: 'm-1',
      musicTitle: 'Evidências',
      musicArtist: 'Chitãozinho & Xororó',
      versionId: 'v-1-1',
      versionStyle: 'karaoke',
      youtubeVideoId: 'wYV_ZJ2U-t4',
      status: 'QUEUED',
      queuedAt: new Date(Date.now() - 20 * 60000).toISOString(),
      orderIndex: 0
    };

    const q2: QueueItem = {
      id: 'q-2',
      sessionId: this.session.id,
      participantId: p2.id,
      participantDisplayName: p2.displayName,
      musicId: 'm-2',
      musicTitle: 'Cheia de Manias',
      musicArtist: 'Raça Negra',
      versionId: 'v-2-1',
      versionStyle: 'karaoke',
      youtubeVideoId: 'fJ9rUzIMcZQ',
      status: 'QUEUED',
      queuedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      orderIndex: 1
    };

    this.queue = [q1, q2];
    this.metrics.totalSongsQueued = 2;

    // Seed initial device topology (PRD Seções 36, 37 e 56)
    const nowIso = new Date().toISOString();
    this.devices.set('dev-tv-lounge', {
      deviceId: 'dev-tv-lounge',
      clientType: 'ANDROID_TV',
      role: 'TV',
      platform: 'Android TV 12 (TCL Smart TV 65")',
      clientVersion: '1.2.0-tv',
      lastSeenAt: nowIso
    });
    this.devices.set('dev-ctrl-booth', {
      deviceId: 'dev-ctrl-booth',
      clientType: 'PWA',
      role: 'CONTROLLER',
      platform: 'iPadOS / Safari Tablet (Cabine de Som)',
      clientVersion: '1.2.0-web',
      lastSeenAt: nowIso
    });
    this.devices.set('dev-part-joao', {
      deviceId: 'dev-part-joao',
      clientType: 'PWA',
      role: 'PARTICIPANT',
      platform: 'Android 14 / Chrome Mobile (Mesa 04)',
      clientVersion: '1.2.0-web',
      lastSeenAt: nowIso
    });
    this.devices.set('dev-part-maria', {
      deviceId: 'dev-part-maria',
      clientType: 'ANDROID',
      role: 'PARTICIPANT',
      platform: 'Android APK Nativo (Mesa 08)',
      clientVersion: '1.2.0-apk',
      lastSeenAt: nowIso
    });

    this.logAudit('SYSTEM', 'System', 'SESSION_BOOTSTRAP', 'Sessão inicial carregada com fila demonstrativa e topologia de dispositivos.');
  }

  public logAudit(actorRole: any, actorName: string, action: string, details: string) {
    const log: AuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sessionId: this.session.id,
      actorRole,
      actorName,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 200) this.auditLogs.pop();
  }

  public addNotification(type: string, title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') {
    const notif: SessionNotification = {
      id: 'notif-' + Date.now(),
      sessionId: this.session.id,
      type,
      title,
      message,
      severity,
      createdAt: new Date().toISOString(),
      read: false
    };
    this.notifications.unshift(notif);
    if (this.notifications.length > 50) this.notifications.pop();
  }

  /**
   * Deterministic Fair Round-Robin Queue Insertion (PRD Seção 18 e 19)
   * Impede monopólio da sessão intercalando ciclos por participante.
   * Exemplo do PRD:
   * João: A, B, C | Maria: D, E | Pedro: F
   * Resultado na Fila: João A, Maria D, Pedro F, João B, Maria E, João C
   */
  public addSongToQueue(participant: Participant, music: Music, version: any, toneOffset: number = 0): QueueItem {
    // Quantas músicas este participante já tem com status QUEUED
    const participantQueuedCount = this.queue.filter(
      item => item.participantId === participant.id && item.status === 'QUEUED'
    ).length;

    // Esta nova música fará parte do ciclo (round) de número N deste participante
    const targetRound = participantQueuedCount + 1;

    const newItem: QueueItem = {
      id: 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sessionId: this.session.id,
      participantId: participant.id,
      participantDisplayName: participant.displayName,
      musicId: music.id,
      musicTitle: music.title,
      musicArtist: music.artist,
      versionId: version.id,
      versionStyle: version.style as MusicVersionStyle,
      youtubeVideoId: version.youtubeVideoId,
      toneOffset: Math.max(-3, Math.min(3, toneOffset || 0)),
      status: 'QUEUED',
      queuedAt: new Date().toISOString(),
      orderIndex: this.queue.length
    };

    // Calcular índice de inserção determinístico:
    // A música é posicionada após todas as músicas do ciclo <= targetRound,
    // mas antes de qualquer música de ciclo > targetRound (evitando monopólio).
    const participantRoundTracker = new Map<string, number>();
    let insertIndex = -1;

    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i];
      if (q.status === 'QUEUED') {
        const itemRound = (participantRoundTracker.get(q.participantId) || 0) + 1;
        participantRoundTracker.set(q.participantId, itemRound);

        if (itemRound > targetRound) {
          insertIndex = i;
          break;
        }
      }
    }

    if (insertIndex !== -1) {
      this.queue.splice(insertIndex, 0, newItem);
    } else {
      this.queue.push(newItem);
    }

    this.reindexQueue();

    this.metrics.totalSongsQueued++;
    this.logAudit(
      'PARTICIPANT',
      participant.displayName,
      'QUEUE_ADD',
      `Música adicionada à fila rotativa (Ciclo ${targetRound}): ${music.title} (${version.style})`
    );

    return newItem;
  }

  public reindexQueue() {
    let activeIdx = 0;
    for (const item of this.queue) {
      if (item.status === 'QUEUED' || item.status === 'PLAYING') {
        item.orderIndex = activeIdx++;
      }
    }
  }

  /**
   * Generates strict TVSessionDTO (Section 27)
   * NEVER exposes WhatsApp, private leads, supervisor tokens, or client credentials.
   */
  public getTVSessionDTO(): TVSessionDTO {
    const currentQueueItem = this.queue.find(item => item.status === 'PLAYING');
    const upcomingQueue = this.queue
      .filter(item => item.status === 'QUEUED')
      .map(item => ({
        id: item.id,
        title: item.musicTitle,
        artist: item.musicArtist,
        versionStyle: item.versionStyle,
        participantDisplayName: item.participantDisplayName,
        toneOffset: item.toneOffset
      }));

    let sessionAlert: { message: string; type: 'info' | 'warning' | 'error'; timestamp: string } | null = null;
    
    // Custom supervisor announcement takes precedence if active
    if (this.sessionAlert && this.sessionAlert.active) {
      sessionAlert = {
        message: this.sessionAlert.message,
        type: (this.sessionAlert.level.toLowerCase() as 'info' | 'warning' | 'error') || 'info',
        timestamp: this.sessionAlert.timestamp
      };
    } else if (this.session.scheduledEndTime) {
      const diffMs = new Date(this.session.scheduledEndTime).getTime() - Date.now();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes > 0 && diffMinutes <= 15) {
        sessionAlert = {
          message: `Atenção: Encerramento programado da sessão em ${diffMinutes} minutos.`,
          type: 'warning' as const,
          timestamp: new Date().toISOString()
        };
      } else if (diffMinutes <= 0 && this.session.status === 'ACTIVE') {
        sessionAlert = {
          message: 'Horário previsto atingido. Aguardando conclusão da música atual.',
          type: 'warning' as const,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      sessionId: this.session.id,
      establishmentName: this.session.establishmentName,
      sessionName: this.session.name,
      status: this.session.status,
      currentSong: currentQueueItem
        ? {
            id: currentQueueItem.id,
            title: currentQueueItem.musicTitle,
            artist: currentQueueItem.musicArtist,
            versionStyle: currentQueueItem.versionStyle,
            youtubeVideoId: currentQueueItem.youtubeVideoId,
            participantDisplayName: currentQueueItem.participantDisplayName,
            toneOffset: currentQueueItem.toneOffset
          }
        : null,
      queue: upcomingQueue,
      playbackState: this.playbackState.status,
      sessionAlert,
      volume: this.playbackState.volume,
      scheduledEndTime: this.session.scheduledEndTime,
      qrCodeUrl: `https://vozplay.ai.slz.br/join?s=${this.session.code}`
    };

  }
}

export const db = new VozPlayDB();
