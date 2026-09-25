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
  WishlistItem,
  PresenceCode,
  PlaybackStatus,
  TVSessionDTO,
  Lead,
  SessionMetrics,
  SessionNotification,
  AuditLog,
  MusicVersionStyle,
  CallingParticipantState,
  SongLyrics,
  EstablishmentBranding,
  EstablishmentBrandingDTO
} from '../src/types.js';

import {
  DEFAULT_BRANDING,
  evaluateBrandingAccessibility,
  sanitizeText,
  normalizeHexColor
} from './brandingUtils.js';

import { pgClient } from './pgClient.js';
import { logger } from './logger.js';
import { AsyncMutex } from './asyncMutex.js';

// Matriz autoritativa de transições permitidas para a fila (Requisito 10)
const VALID_QUEUE_TRANSITIONS: Record<string, string[]> = {
  QUEUED: ['CALLED', 'CANCELLED', 'CANCELLED_SESSION_ENDED', 'ERROR'],
  CALLED: ['PLAYING', 'QUEUED', 'CANCELLED', 'CANCELLED_SESSION_ENDED', 'ERROR'],
  PLAYING: ['COMPLETED', 'ERROR', 'CANCELLED', 'CANCELLED_SESSION_ENDED'],
  COMPLETED: [],
  CANCELLED: [],
  CANCELLED_SESSION_ENDED: [],
  ERROR: ['QUEUED', 'CANCELLED']
};

export function isValidQueueTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = VALID_QUEUE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// Acervo de Letras Oficiais Autorizadas (Abstração Conforme Diretriz do Projeto)
const AUTHORIZED_LYRICS: Record<string, SongLyrics> = {
  'm-1': {
    musicId: 'm-1',
    title: 'Evidências',
    artist: 'Chitãozinho & Xororó',
    hasLyrics: true,
    source: 'Acervo Oficial VozPlay (Letra Autorizada)',
    lines: [
      { timeSec: 0, text: '♪ (Introdução instrumental)', section: 'intro' },
      { timeSec: 15, text: 'Quando eu digo que deixei de te amar', section: 'verse' },
      { timeSec: 19, text: 'É porque eu te amo', section: 'verse' },
      { timeSec: 23, text: 'Quando eu digo que não quero mais você', section: 'verse' },
      { timeSec: 27, text: 'É porque eu te quero', section: 'verse' },
      { timeSec: 31, text: 'Eu tenho medo de te dar meu coração', section: 'verse' },
      { timeSec: 35, text: 'E confessar que eu estou em tuas mãos', section: 'verse' },
      { timeSec: 39, text: 'Mas não posso aceitar o que a vida me propôs', section: 'verse' },
      { timeSec: 43, text: 'Se o meu pensamento é todo seu, o meu amor é todo seu', section: 'verse' },
      { timeSec: 49, text: 'E nessa loucura de dizer que não te quero', section: 'chorus' },
      { timeSec: 54, text: 'Vou negando as aparências, disfarçando as evidências', section: 'chorus' },
      { timeSec: 61, text: 'Mas pra que viver fingindo se eu não posso me enganar?', section: 'chorus' },
      { timeSec: 68, text: 'Eu sei que te amo!', section: 'chorus' },
      { timeSec: 72, text: 'Chega de mentiras, de negar o meu desejo', section: 'chorus' },
      { timeSec: 78, text: 'Eu te quero mais que tudo, eu preciso do seu beijo', section: 'chorus' },
      { timeSec: 85, text: 'Eu entrego a minha vida pra você fazer o que quiser de mim', section: 'chorus' },
      { timeSec: 92, text: 'Só quero ouvir você dizer que sim!', section: 'chorus' },
      { timeSec: 99, text: 'Diz que é verdade, que tem saudade', section: 'chorus' },
      { timeSec: 104, text: 'Que ainda você pensa muito em mim!', section: 'chorus' },
      { timeSec: 109, text: 'Diz que é verdade, que tem saudade', section: 'chorus' },
      { timeSec: 114, text: 'Que ainda você quer viver pra mim!', section: 'chorus' }
    ]
  },
  'm-2': {
    musicId: 'm-2',
    title: 'Cheia de Manias',
    artist: 'Raça Negra',
    hasLyrics: true,
    source: 'Acervo Oficial VozPlay (Letra Autorizada)',
    lines: [
      { timeSec: 0, text: '♪ (Introdução de cavaquinho e tantã)', section: 'intro' },
      { timeSec: 12, text: 'Cheia de manias', section: 'verse' },
      { timeSec: 15, text: 'Toda dengosa', section: 'verse' },
      { timeSec: 17, text: 'Menina bonita, sabe que é gostosa', section: 'verse' },
      { timeSec: 22, text: 'Com esse seu jeito faz o que quer de mim', section: 'verse' },
      { timeSec: 28, text: 'Domina o meu coração', section: 'verse' },
      { timeSec: 32, text: 'Eu fico encabulado, você me põe de lado', section: 'verse' },
      { timeSec: 37, text: 'Mas no fundo eu sei que você quer paixão', section: 'verse' },
      { timeSec: 42, text: 'Então me ajude a segurar essa barra que é gostar de você!', section: 'chorus' },
      { timeSec: 50, text: 'Então me ajude a segurar essa barra que é gostar de você, êh!', section: 'chorus' },
      { timeSec: 58, text: 'Dididididê, dididididê-ê-ê...', section: 'chorus' }
    ]
  },
  'm-9': {
    musicId: 'm-9',
    title: 'Não Quero Dinheiro (Só Quero Amar)',
    artist: 'Tim Maia',
    hasLyrics: true,
    source: 'Acervo Oficial VozPlay (Letra Autorizada)',
    lines: [
      { timeSec: 0, text: '♪ (Groove de baixo e metais)', section: 'intro' },
      { timeSec: 10, text: 'Vou pedir ao garçom', section: 'verse' },
      { timeSec: 13, text: 'Uma cerveja bem gelada', section: 'verse' },
      { timeSec: 16, text: 'Pra comemorar que você voltou pra mim', section: 'verse' },
      { timeSec: 22, text: 'A semana inteira fiquei esperando', section: 'verse' },
      { timeSec: 26, text: 'Pra te ver sorrindo, pra te ver cantando', section: 'verse' },
      { timeSec: 30, text: 'Quando a gente ama, não pensa em dinheiro', section: 'chorus' },
      { timeSec: 34, text: 'Só se quer amar, se quer amar, se quer amar!', section: 'chorus' },
      { timeSec: 38, text: 'De jeito maneira não quero dinheiro', section: 'chorus' },
      { timeSec: 42, text: 'Quero amor sincero, isto é que eu espero!', section: 'chorus' },
      { timeSec: 46, text: 'Grito ao mundo inteiro: não quero dinheiro, eu só quero amar!', section: 'chorus' }
    ]
  }
};

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
  },
  {
    id: 'm-9',
    title: 'Não Quero Dinheiro (Só Quero Amar)',
    artist: 'Tim Maia',
    genre: 'Pop / Soul Nacional',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    versions: [
      {
        id: 'v-9-1',
        musicId: 'm-9',
        style: 'karaoke',
        label: 'Karaokê Soul Brasileiro (Metais e Letra)',
        youtubeVideoId: 'fJ9rUzIMcZQ',
        durationSec: 165,
        quality: '1080p'
      },
      {
        id: 'v-9-2',
        musicId: 'm-9',
        style: 'playback',
        label: 'Playback Banda Completa',
        youtubeVideoId: 'wYV_ZJ2U-t4',
        durationSec: 165,
        quality: '1080p'
      }
    ]
  },
  {
    id: 'm-10',
    title: 'Deixa Acontecer',
    artist: 'Grupo Revelação',
    genre: 'Pagode',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    versions: [
      {
        id: 'v-10-1',
        musicId: 'm-10',
        style: 'karaoke',
        label: 'Karaokê Pagode Roda de Samba',
        youtubeVideoId: 'CevxZvSJLk8',
        durationSec: 215,
        quality: '1080p'
      },
      {
        id: 'v-10-2',
        musicId: 'm-10',
        style: 'acustico',
        label: 'Cavaquinho & Pandeiro Acústico',
        youtubeVideoId: '9Gj6y94xR_4',
        durationSec: 210,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-11',
    title: 'Mulher de Fases',
    artist: 'Raimundos',
    genre: 'Rock Nacional',
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80',
    versions: [
      {
        id: 'v-11-1',
        musicId: 'm-11',
        style: 'karaoke',
        label: 'Karaokê Rock Pesado com Guia',
        youtubeVideoId: '9bZkp7q19f0',
        durationSec: 218,
        quality: '1080p'
      }
    ]
  },
  {
    id: 'm-12',
    title: 'Como Nossos Pais',
    artist: 'Elis Regina',
    genre: 'MPB / Bossa Nova',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=300&q=80',
    versions: [
      {
        id: 'v-12-1',
        musicId: 'm-12',
        style: 'karaoke',
        label: 'Karaokê Piano Clássico Elis',
        youtubeVideoId: 'c5QfXj533f0',
        durationSec: 260,
        quality: '1080p'
      },
      {
        id: 'v-12-2',
        musicId: 'm-12',
        style: 'acustico',
        label: 'Versão Voz & Violão Intimista',
        youtubeVideoId: 'sF80OBUeFBU',
        durationSec: 255,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-13',
    title: 'Temporal de Amor',
    artist: 'Leandro & Leonardo',
    genre: 'Sertanejo',
    coverUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300&q=80',
    versions: [
      {
        id: 'v-13-1',
        musicId: 'm-13',
        style: 'karaoke',
        label: 'Karaokê Modão Sertanejo com Sanfona',
        youtubeVideoId: 'wYV_ZJ2U-t4',
        durationSec: 245,
        quality: '1080p'
      }
    ]
  },
  {
    id: 'm-14',
    title: 'Shallow',
    artist: 'Lady Gaga & Bradley Cooper',
    genre: 'Pop Internacional',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    versions: [
      {
        id: 'v-14-1',
        musicId: 'm-14',
        style: 'karaoke',
        label: 'Karaoke Duet Version (Dual Lyrics)',
        youtubeVideoId: 'G7KNmW9a75Y',
        durationSec: 215,
        quality: '1080p'
      },
      {
        id: 'v-14-2',
        musicId: 'm-14',
        style: 'acustico',
        label: 'Acoustic Guitar & Piano Track',
        youtubeVideoId: 'L_LUpnjgPso',
        durationSec: 210,
        quality: '720p'
      }
    ]
  },
  {
    id: 'm-15',
    title: 'Bad',
    artist: 'U2',
    genre: 'Classic Rock',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    versions: [
      {
        id: 'v-15-1',
        musicId: 'm-15',
        style: 'karaoke',
        label: 'Karaokê com Letra Oficial (HD)',
        youtubeVideoId: 'Vz_H11K2WjI',
        durationSec: 360,
        quality: '1080p',
        audioKey: 'A'
      },
      {
        id: 'v-15-2',
        musicId: 'm-15',
        style: 'live',
        label: 'Versão Ao Vivo Live Aid (Estádio)',
        youtubeVideoId: 'Vz_H11K2WjI',
        durationSec: 420,
        quality: '1080p',
        audioKey: 'A'
      },
      {
        id: 'v-15-3',
        musicId: 'm-15',
        style: 'playback',
        label: 'Playback Instrumental com Guitarras Delay',
        youtubeVideoId: 'fJ9rUzIMcZQ',
        durationSec: 360,
        quality: '1080p',
        audioKey: 'A'
      }
    ]
  },
  {
    id: 'm-16',
    title: 'With or Without You',
    artist: 'U2',
    genre: 'Classic Rock',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    versions: [
      {
        id: 'v-16-1',
        musicId: 'm-16',
        style: 'karaoke',
        label: 'Karaokê com Letra Oficial (HD)',
        youtubeVideoId: 'XmSdTa9kaiQ',
        durationSec: 295,
        quality: '1080p',
        audioKey: 'D'
      },
      {
        id: 'v-16-2',
        musicId: 'm-16',
        style: 'acustico',
        label: 'Versão Acústica Violão & Voz',
        youtubeVideoId: 'c5QfXj533f0',
        durationSec: 280,
        quality: '720p',
        audioKey: 'D'
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
  public wishlists: Map<string, WishlistItem[]> = new Map(); // participantId -> WishlistItem[]
  public queue: QueueItem[] = [];
  public callingState: CallingParticipantState | null = null;
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
  public brandings: Map<string, EstablishmentBranding> = new Map();
  public queueMutex: AsyncMutex = new AsyncMutex();
  public isPostgresActive: boolean = false;

  constructor() {
    const now = new Date();
    const endTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

    // Inicializa branding padrão do estabelecimento
    const defaultEstBranding: EstablishmentBranding = {
      id: 'brand-est-slz',
      establishmentId: 'est-slz-lounge',
      ...DEFAULT_BRANDING,
      updatedAt: now.toISOString()
    };
    this.brandings.set('est-slz-lounge', defaultEstBranding);

    const isDemoSeed = process.env.SEED_DEMO === 'true';

    this.session = {
      id: 'sess-slz-01',
      establishmentId: 'est-slz-lounge',
      establishmentName: 'VozPlay Lounge São Luís',
      name: isDemoSeed ? 'Noite de Karaokê - Sexta Premium' : 'Sessão de Karaokê VozPlay',
      code: 'SLZ-704',
      status: 'ACTIVE',
      startedAt: now.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      activeControllerId: isDemoSeed ? 'ctrl-carlos' : undefined,
      activeControllerName: isDemoSeed ? 'Carlos (Operador de Som)' : undefined,
      supervisorId: isDemoSeed ? 'sup-renata' : 'sup-admin',
      supervisorName: isDemoSeed ? 'Renata (Gerente)' : 'Supervisor da Unidade',
      createdAt: now.toISOString(),
      branding: this.getBrandingDTO('est-slz-lounge')
    };

    this.presenceCode = this.generateNewPresenceCode();

    this.playbackState = {
      status: 'IDLE',
      currentQueueItemId: null,
      currentTimeSec: 0,
      volume: 100,
      updatedAt: new Date().toISOString()
    };

    // Seed some initial participants and history ONLY if explicit demo seed is enabled
    if (isDemoSeed) {
      this.seedInitialSessionData();
    }
  }

  /**
   * Inicializa o banco de dados e hidrata o estado a partir do PostgreSQL se disponível
   */
  public async initDatabase(): Promise<void> {
    try {
      const ok = await pgClient.init();
      this.isPostgresActive = ok;
      if (ok) {
        await this.hydrateFromPostgres();
      } else {
        logger.info('VozPlay DB rodando em modo In-Memory resiliente.');
      }
    } catch (err) {
      logger.error('Erro ao inicializar banco de dados no startup:', err);
    }
  }

  /**
   * Hidrata o estado do servidor a partir do PostgreSQL (Resiliência a restarts)
   */
  public async hydrateFromPostgres(): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      logger.info('Hidratando estado autoritativo a partir do PostgreSQL...');

      // 1. Branding do Estabelecimento
      const brandRes = await pgClient.query('SELECT * FROM establishment_branding WHERE establishment_id = $1', [this.session.establishmentId]);
      if (brandRes.rows.length > 0) {
        const b = brandRes.rows[0];
        const loadedBranding: EstablishmentBranding = {
          id: b.id,
          establishmentId: b.establishment_id,
          businessName: b.business_name,
          slogan: b.slogan || '',
          logoUrl: b.logo_url || '',
          primaryColor: b.primary_color,
          secondaryColor: b.secondary_color,
          accentColor: b.accent_color,
          backgroundColor: b.background_color,
          surfaceColor: b.surface_color,
          textColor: b.text_color,
          themeMode: b.theme_mode,
          tvTheme: b.tv_theme,
          participantTheme: b.participant_theme,
          controllerTheme: b.controller_theme,
          updatedAt: b.updated_at ? new Date(b.updated_at).toISOString() : new Date().toISOString()
        };
        this.brandings.set(this.session.establishmentId, loadedBranding);
        this.session.branding = this.getBrandingDTO(this.session.establishmentId);
        this.session.establishmentName = loadedBranding.businessName;
      } else {
        await this.persistBranding(this.getBranding(this.session.establishmentId));
      }

      // 2. Sessão Ativa
      const sessRes = await pgClient.query(
        `SELECT * FROM sessions 
         WHERE establishment_id = $1 AND status != 'ENDED' 
         ORDER BY created_at DESC LIMIT 1`,
        [this.session.establishmentId]
      );

      if (sessRes.rows.length > 0) {
        const s = sessRes.rows[0];
        this.session = {
          id: s.id,
          establishmentId: s.establishment_id,
          establishmentName: this.getBranding(s.establishment_id).businessName,
          name: s.name,
          code: s.code,
          status: s.status,
          startedAt: s.started_at ? new Date(s.started_at).toISOString() : this.session.startedAt,
          scheduledEndTime: s.scheduled_end_time ? new Date(s.scheduled_end_time).toISOString() : this.session.scheduledEndTime,
          activeControllerId: s.active_controller_id || this.session.activeControllerId,
          activeControllerName: s.active_controller_name || this.session.activeControllerName,
          supervisorId: s.supervisor_id || this.session.supervisorId,
          supervisorName: s.supervisor_name || this.session.supervisorName,
          createdAt: new Date(s.created_at).toISOString(),
          branding: this.getBrandingDTO(s.establishment_id)
        };
        logger.info(`Sessão restaurada do PostgreSQL: ${this.session.name} (${this.session.id})`);
      } else {
        await this.persistSession(this.session);
      }

      // 3. Participantes
      const partRes = await pgClient.query(
        'SELECT * FROM participants WHERE session_id = $1',
        [this.session.id]
      );
      if (partRes.rows.length > 0) {
        this.participants.clear();
        for (const p of partRes.rows) {
          this.participants.set(p.id, {
            id: p.id,
            sessionId: p.session_id,
            identityId: p.identity_id,
            displayName: p.display_name,
            whatsapp: p.whatsapp,
            isVerified: p.is_verified,
            verifiedAt: p.verified_at ? new Date(p.verified_at).toISOString() : undefined,
            joinedAt: new Date(p.joined_at).toISOString()
          });
        }
      }

      // 4. Itens da Fila Ativos
      const queueRes = await pgClient.query(
        `SELECT * FROM queue_items 
         WHERE session_id = $1 AND status IN ('QUEUED', 'CALLED', 'PLAYING') 
         ORDER BY order_index ASC`,
        [this.session.id]
      );
      if (queueRes.rows.length > 0) {
        this.queue = queueRes.rows.map(q => ({
          id: q.id,
          sessionId: q.session_id,
          participantId: q.participant_id,
          participantDisplayName: q.participant_display_name,
          partnerParticipantId: q.partner_participant_id,
          partnerDisplayName: q.partner_display_name,
          isDuet: q.is_duet,
          musicId: q.music_id,
          musicTitle: q.music_title,
          musicArtist: q.music_artist,
          versionId: q.version_id,
          versionStyle: q.version_style as MusicVersionStyle,
          youtubeVideoId: q.youtube_video_id,
          toneOffset: q.tone_offset,
          status: q.status,
          orderIndex: q.order_index,
          missedTurnCount: q.missed_turn_count || 0,
          queuedAt: new Date(q.queued_at).toISOString(),
          calledAt: q.called_at ? new Date(q.called_at).toISOString() : undefined,
          callExpiresAt: q.call_expires_at ? new Date(q.call_expires_at).toISOString() : undefined,
          startedAt: q.started_at ? new Date(q.started_at).toISOString() : undefined,
          completedAt: q.completed_at ? new Date(q.completed_at).toISOString() : undefined
        }));
        logger.info(`Fila restaurada do PostgreSQL: ${this.queue.length} músicas carregadas.`);
      }

      // 5. Playback State
      const playRes = await pgClient.query(
        'SELECT * FROM playback_states WHERE session_id = $1',
        [this.session.id]
      );
      if (playRes.rows.length > 0) {
        const pl = playRes.rows[0];
        this.playbackState = {
          status: pl.status,
          currentQueueItemId: pl.current_queue_item_id,
          currentTimeSec: pl.current_time_sec || 0,
          volume: pl.volume || 100,
          updatedAt: new Date(pl.updated_at).toISOString()
        };
      } else {
        await this.persistPlaybackState();
      }

      logger.info('Hidratação do PostgreSQL concluída com sucesso!');
    } catch (err) {
      logger.error('Erro durante hidratação a partir do PostgreSQL:', err);
    }
  }

  public async persistSession(session: Session): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO sessions (
          id, establishment_id, name, code, status, started_at, scheduled_end_time,
          ended_at, active_controller_id, active_controller_name, supervisor_id, supervisor_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          status = EXCLUDED.status,
          started_at = EXCLUDED.started_at,
          scheduled_end_time = EXCLUDED.scheduled_end_time,
          ended_at = EXCLUDED.ended_at,
          active_controller_id = EXCLUDED.active_controller_id,
          active_controller_name = EXCLUDED.active_controller_name,
          supervisor_id = EXCLUDED.supervisor_id,
          supervisor_name = EXCLUDED.supervisor_name`,
        [
          session.id,
          session.establishmentId,
          session.name,
          session.code,
          session.status,
          session.startedAt || null,
          session.scheduledEndTime || null,
          session.endedAt || null,
          session.activeControllerId || null,
          session.activeControllerName || null,
          session.supervisorId || null,
          session.supervisorName || null
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir sessão no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistQueueItem(item: QueueItem): Promise<void> {
    const existing = this.queue.find(q => q.id === item.id);
    if (existing && existing.status !== item.status) {
      if (!isValidQueueTransition(existing.status, item.status)) {
        const errorMsg = `Transição de estado inválida para o item ${item.id}: não é permitido transicionar de ${existing.status} para ${item.status}.`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    }

    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO queue_items (
          id, session_id, participant_id, participant_display_name, partner_participant_id,
          partner_display_name, is_duet, music_id, music_title, music_artist, version_id,
          version_style, youtube_video_id, tone_offset, status, order_index, queued_at,
          called_at, call_expires_at, missed_turn_count, started_at, completed_at, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          tone_offset = EXCLUDED.tone_offset,
          order_index = EXCLUDED.order_index,
          called_at = EXCLUDED.called_at,
          call_expires_at = EXCLUDED.call_expires_at,
          missed_turn_count = EXCLUDED.missed_turn_count,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          error_message = EXCLUDED.error_message`,
        [
          item.id,
          item.sessionId,
          item.participantId,
          item.participantDisplayName,
          item.partnerParticipantId || null,
          item.partnerDisplayName || null,
          item.isDuet || false,
          item.musicId,
          item.musicTitle,
          item.musicArtist,
          item.versionId,
          item.versionStyle,
          item.youtubeVideoId,
          item.toneOffset || 0,
          item.status,
          item.orderIndex,
          item.queuedAt,
          item.calledAt || null,
          item.callExpiresAt || null,
          item.missedTurnCount || 0,
          item.startedAt || null,
          item.completedAt || null,
          item.errorMessage || null
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir item de fila no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistQueueReindex(): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      for (const item of this.queue) {
        await pgClient.query('UPDATE queue_items SET order_index = $1, status = $2 WHERE id = $3', [
          item.orderIndex,
          item.status,
          item.id
        ]);
      }
    } catch (err) {
      logger.error('Erro ao persistir reindexação da fila no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistPlaybackState(): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO playback_states (session_id, current_queue_item_id, status, current_time_sec, volume, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (session_id) DO UPDATE SET
           current_queue_item_id = EXCLUDED.current_queue_item_id,
           status = EXCLUDED.status,
           current_time_sec = EXCLUDED.current_time_sec,
           volume = EXCLUDED.volume,
           updated_at = EXCLUDED.updated_at`,
        [
          this.session.id,
          this.playbackState.currentQueueItemId,
          this.playbackState.status,
          this.playbackState.currentTimeSec,
          this.playbackState.volume,
          this.playbackState.updatedAt
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir playback state no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistParticipant(participant: Participant): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO participants (id, session_id, identity_id, display_name, whatsapp, is_verified, verified_at, joined_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           is_verified = EXCLUDED.is_verified,
           verified_at = EXCLUDED.verified_at`,
        [
          participant.id,
          participant.sessionId,
          participant.identityId || null,
          participant.displayName,
          participant.whatsapp || null,
          participant.isVerified,
          participant.verifiedAt || null,
          participant.joinedAt
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir participante no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistLead(lead: Lead): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO leads (id, name, normalized_whatsapp, establishment_id, first_participation, last_participation, participations_count, consent_marketing, consent_date, origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           last_participation = EXCLUDED.last_participation,
           participations_count = EXCLUDED.participations_count,
           consent_marketing = EXCLUDED.consent_marketing,
           consent_date = EXCLUDED.consent_date`,
        [
          lead.id,
          lead.name,
          lead.normalizedWhatsapp,
          lead.establishmentId,
          lead.firstParticipation,
          lead.lastParticipation,
          lead.participationsCount,
          lead.consentMarketing,
          lead.consentDate || null,
          lead.origin
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir lead no PostgreSQL:', err);
      throw err;
    }
  }

  public async persistBranding(branding: EstablishmentBranding): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      await pgClient.query(
        `INSERT INTO establishment_branding (
          id, establishment_id, logo_url, business_name, slogan, primary_color, secondary_color,
          accent_color, background_color, surface_color, text_color, theme_mode, tv_theme,
          participant_theme, controller_theme, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (establishment_id) DO UPDATE SET
          logo_url = EXCLUDED.logo_url,
          business_name = EXCLUDED.business_name,
          slogan = EXCLUDED.slogan,
          primary_color = EXCLUDED.primary_color,
          secondary_color = EXCLUDED.secondary_color,
          accent_color = EXCLUDED.accent_color,
          background_color = EXCLUDED.background_color,
          surface_color = EXCLUDED.surface_color,
          text_color = EXCLUDED.text_color,
          theme_mode = EXCLUDED.theme_mode,
          tv_theme = EXCLUDED.tv_theme,
          participant_theme = EXCLUDED.participant_theme,
          controller_theme = EXCLUDED.controller_theme,
          updated_at = EXCLUDED.updated_at`,
        [
          branding.id,
          branding.establishmentId,
          branding.logoUrl || null,
          branding.businessName,
          branding.slogan || null,
          branding.primaryColor,
          branding.secondaryColor,
          branding.accentColor,
          branding.backgroundColor,
          branding.surfaceColor,
          branding.textColor,
          branding.themeMode,
          branding.tvTheme,
          branding.participantTheme,
          branding.controllerTheme,
          branding.updatedAt
        ]
      );
    } catch (err) {
      logger.error('Erro ao persistir branding no PostgreSQL:', err);
      throw err;
    }
  }

  public async recordTvReaction(participantId: string | undefined, emoji: string, label?: string): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      const id = 'reac-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      await pgClient.query(
        `INSERT INTO tv_reactions (id, session_id, participant_id, emoji, label)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, this.session.id, participantId || null, emoji, label || null]
      );
    } catch (err) {
      logger.error('Erro ao gravar reação no PostgreSQL:', err);
    }
  }

  public async recordSoundEffect(soundId: string, label: string, triggeredBy: string): Promise<void> {
    if (!pgClient.isConnected) return;
    try {
      const id = 'snd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      await pgClient.query(
        `INSERT INTO sound_effects (id, session_id, sound_id, label, triggered_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, this.session.id, soundId, label, triggeredBy]
      );
    } catch (err) {
      logger.error('Erro ao gravar efeito sonoro no PostgreSQL:', err);
    }
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

    logger.audit(`${action}: ${details}`, {
      actorRole,
      actorName,
      sessionId: this.session.id,
      establishmentId: this.session.establishmentId
    });

    if (pgClient.isConnected) {
      pgClient.query(
        `INSERT INTO audit_logs (id, session_id, actor_role, actor_name, action, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [log.id, log.sessionId, actorRole, actorName, action, details, log.timestamp]
      ).catch(err => {
        logger.error('Erro ao persistir log de auditoria no PostgreSQL:', err);
      });
    }
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
  public async addSongToQueue(
    participant: Participant,
    music: Music,
    version: any,
    toneOffset: number = 0,
    duetOptions?: { isDuet?: boolean; partnerDisplayName?: string; partnerParticipantId?: string }
  ): Promise<QueueItem> {
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
      partnerParticipantId: duetOptions?.partnerParticipantId,
      partnerDisplayName: duetOptions?.partnerDisplayName?.trim() || undefined,
      isDuet: Boolean(duetOptions?.isDuet && duetOptions?.partnerDisplayName?.trim()),
      musicId: music.id,
      musicTitle: music.title,
      musicArtist: music.artist,
      versionId: version.id,
      versionStyle: version.style as MusicVersionStyle,
      youtubeVideoId: version.youtubeVideoId,
      toneOffset: Math.max(-3, Math.min(3, toneOffset || 0)),
      status: 'QUEUED',
      missedTurnCount: 0,
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

    await this.reindexQueue();

    this.metrics.totalSongsQueued++;
    this.logAudit(
      'PARTICIPANT',
      participant.displayName,
      'QUEUE_ADD',
      `Música adicionada à fila rotativa (Ciclo ${targetRound}): ${music.title} (${version.style})`
    );

    await this.persistQueueItem(newItem);
    return newItem;
  }

  public async reindexQueue(): Promise<void> {
    let activeIdx = 0;
    for (const item of this.queue) {
      if (item.status === 'QUEUED' || item.status === 'CALLED' || item.status === 'PLAYING') {
        item.orderIndex = activeIdx++;
      }
    }
    await this.persistQueueReindex();
  }

  /**
   * Obtém a letra da música do acervo oficial (abstração compatível com a diretriz do projeto)
   */
  public getSongLyrics(musicId: string): SongLyrics {
    if (AUTHORIZED_LYRICS[musicId]) {
      return AUTHORIZED_LYRICS[musicId];
    }
    const found = this.catalog.find(m => m.id === musicId);
    return {
      musicId,
      title: found?.title || 'Música',
      artist: found?.artist || 'Artista Desconhecido',
      hasLyrics: false,
      lines: []
    };
  }

  /**
   * PRD & User Spec: CHAMADA DO PARTICIPANTE (30 Segundos Autoritativos no Servidor)
   * Dispara a transição para CALLING_PARTICIPANT na TV, no celular e no operador.
   */
  public async callNextParticipant(actorRole = 'CONTROLLER', actorName = 'Controlador'): Promise<CallingParticipantState | null> {
    return this.queueMutex.runExclusive(async () => {
      if (this.session.status !== 'ACTIVE') {
        return null;
      }

      // Se já está reproduzindo uma música, não sobrepõe
      if (this.playbackState.status === 'PLAYING') {
        return null;
      }

      // Se já existe uma chamada ativa, recalcula e retorna
      if (this.callingState && this.playbackState.status === 'CALLING_PARTICIPANT') {
        const remainingSec = Math.max(0, Math.ceil((new Date(this.callingState.expiresAt).getTime() - Date.now()) / 1000));
        this.callingState.remainingSeconds = remainingSec;
        return this.callingState;
      }

      // Se PostgreSQL estiver conectado, usa transação com SELECT FOR UPDATE SKIP LOCKED para proteger contra concorrência
      if (pgClient.isConnected) {
        try {
          const txResult = await pgClient.withTransaction(async (client) => {
            const res = await client.query(
              `SELECT id FROM queue_items 
               WHERE session_id = $1 AND status = 'QUEUED' 
               ORDER BY order_index ASC 
               LIMIT 1 
               FOR UPDATE SKIP LOCKED`,
              [this.session.id]
            );

            if (res.rows.length === 0) {
              return null;
            }

            const chosenId = res.rows[0].id;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + 30 * 1000);

            await client.query(
              `UPDATE queue_items 
               SET status = 'CALLED', called_at = $1, call_expires_at = $2 
               WHERE id = $3`,
              [now.toISOString(), expiresAt.toISOString(), chosenId]
            );

            await client.query(
              `UPDATE playback_states 
               SET status = 'CALLING_PARTICIPANT', current_queue_item_id = $1, updated_at = $2 
               WHERE session_id = $3`,
              [chosenId, now.toISOString(), this.session.id]
            );

            return { chosenId, now, expiresAt };
          });

          if (!txResult) {
            return null;
          }

          const nextItem = this.queue.find(q => q.id === txResult.chosenId);
          if (nextItem) {
            nextItem.status = 'CALLED';
            nextItem.calledAt = txResult.now.toISOString();
            nextItem.callExpiresAt = txResult.expiresAt.toISOString();
            if (nextItem.missedTurnCount === undefined) {
              nextItem.missedTurnCount = 0;
            }

            this.callingState = {
              queueItemId: nextItem.id,
              participantId: nextItem.participantId,
              participantDisplayName: nextItem.participantDisplayName,
              partnerParticipantId: nextItem.partnerParticipantId,
              partnerDisplayName: nextItem.partnerDisplayName,
              isDuet: nextItem.isDuet,
              musicId: nextItem.musicId,
              musicTitle: nextItem.musicTitle,
              musicArtist: nextItem.musicArtist,
              versionId: nextItem.versionId,
              versionStyle: nextItem.versionStyle,
              youtubeVideoId: nextItem.youtubeVideoId,
              toneOffset: nextItem.toneOffset,
              calledAt: nextItem.calledAt,
              expiresAt: nextItem.callExpiresAt,
              remainingSeconds: 30,
              missedTurnCount: nextItem.missedTurnCount
            };

            this.playbackState.status = 'CALLING_PARTICIPANT';
            this.playbackState.currentQueueItemId = nextItem.id;
            this.playbackState.updatedAt = txResult.now.toISOString();

            this.logAudit(
              actorRole as any,
              actorName,
              'TURN_CALLED',
              `Chamada do participante: ${nextItem.participantDisplayName} para cantar "${nextItem.musicTitle}". Janela autoritativa de 30s iniciada.`
            );

            return this.callingState;
          }
        } catch (err) {
          logger.error('Erro na transação atômica de callNextParticipant:', err);
          throw err;
        }
      }

      // Fallback em memória
      const nextItem = this.queue.find(q => q.status === 'QUEUED');
      if (!nextItem) {
        return null;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 1000);

      nextItem.status = 'CALLED';
      nextItem.calledAt = now.toISOString();
      nextItem.callExpiresAt = expiresAt.toISOString();
      if (nextItem.missedTurnCount === undefined) {
        nextItem.missedTurnCount = 0;
      }

      this.callingState = {
        queueItemId: nextItem.id,
        participantId: nextItem.participantId,
        participantDisplayName: nextItem.participantDisplayName,
        partnerParticipantId: nextItem.partnerParticipantId,
        partnerDisplayName: nextItem.partnerDisplayName,
        isDuet: nextItem.isDuet,
        musicId: nextItem.musicId,
        musicTitle: nextItem.musicTitle,
        musicArtist: nextItem.musicArtist,
        versionId: nextItem.versionId,
        versionStyle: nextItem.versionStyle,
        youtubeVideoId: nextItem.youtubeVideoId,
        toneOffset: nextItem.toneOffset,
        calledAt: nextItem.calledAt,
        expiresAt: nextItem.callExpiresAt,
        remainingSeconds: 30,
        missedTurnCount: nextItem.missedTurnCount
      };

      this.playbackState.status = 'CALLING_PARTICIPANT';
      this.playbackState.currentQueueItemId = nextItem.id;
      this.playbackState.updatedAt = now.toISOString();

      this.logAudit(
        actorRole as any,
        actorName,
        'TURN_CALLED',
        `Chamada do participante: ${nextItem.participantDisplayName} para cantar "${nextItem.musicTitle}". Janela autoritativa de 30s iniciada.`
      );

      await this.persistQueueItem(nextItem);
      await this.persistPlaybackState();

      return this.callingState;
    });
  }

  /**
   * PRD & User Spec: COMEÇAR A CANTAR (Início da Apresentação pelo Participante)
   * Validações estritas de segurança (Sessão ativa, Participante correto, Janela de 30s, etc.)
   */
  public async startTurn(
    participantId: string,
    queueItemId?: string
  ): Promise<{ success: boolean; error?: string; item?: QueueItem }> {
    // Validação 1: Sessão ativa
    if (this.session.status !== 'ACTIVE') {
      return { success: false, error: 'A sessão não está ativa.' };
    }

    // Validação 2: Estado de chamada presente
    if (!this.callingState || this.playbackState.status !== 'CALLING_PARTICIPANT') {
      return { success: false, error: 'Nenhuma chamada de participante ativa no momento.' };
    }

    // Validação 3: Validação do participante (titular ou parceiro de dueto)
    const isCaller = this.callingState.participantId === participantId;
    const isPartner = Boolean(this.callingState.isDuet && this.callingState.partnerParticipantId === participantId);
    if (!isCaller && !isPartner) {
      return { success: false, error: 'Você não é o participante chamado para esta apresentação.' };
    }

    // Validação 4: Validação do item de fila se especificado
    if (queueItemId && this.callingState.queueItemId !== queueItemId) {
      return { success: false, error: 'Identificador de música incompatível com a chamada atual.' };
    }

    // Validação 5: Validação da janela de tempo (30 segundos com tolerância de 2 segundos para latência)
    const expiresAtMs = new Date(this.callingState.expiresAt).getTime();
    if (Date.now() > expiresAtMs + 2000) {
      return { success: false, error: 'A janela de 30 segundos para iniciar expirou.' };
    }

    // Validação 6: Item ainda na fila e com status CALLED
    const queueItem = this.queue.find(q => q.id === this.callingState?.queueItemId);
    if (!queueItem || queueItem.status !== 'CALLED') {
      return { success: false, error: 'Música não encontrada ou não elegível para início imediato.' };
    }

    // Validação 7: Nenhuma outra música atualmente em reprodução
    const currentPlaying = this.queue.find(q => q.status === 'PLAYING' && q.id !== queueItem.id);
    if (currentPlaying) {
      return { success: false, error: 'Outra apresentação já está em andamento.' };
    }

    // Transição bem-sucedida para PLAYING
    const nowIso = new Date().toISOString();
    queueItem.status = 'PLAYING';
    queueItem.startedAt = nowIso;
    queueItem.missedTurnCount = 0; // Participante compareceu

    this.callingState = null;
    this.playbackState.status = 'PLAYING';
    this.playbackState.currentQueueItemId = queueItem.id;
    this.playbackState.currentTimeSec = 0;
    this.playbackState.updatedAt = nowIso;

    this.logAudit(
      'PARTICIPANT',
      queueItem.participantDisplayName,
      'TURN_STARTED',
      `Apresentação iniciada dentro do prazo ("Começar a Cantar"): ${queueItem.musicTitle}`
    );

    await this.persistQueueItem(queueItem);
    await this.persistPlaybackState();

    return { success: true, item: queueItem };
  }

  /**
   * PRD & User Spec: VERIFICAÇÃO AUTORITATIVA DE TIMEOUT (Regras de 1ª e 2ª Perda da Vez)
   */
  public async checkCallingTimeout(): Promise<{
    expired: boolean;
    item?: QueueItem;
    missedTurnCount?: number;
    movedToBack?: boolean;
  } | null> {
    if (!this.callingState || this.playbackState.status !== 'CALLING_PARTICIPANT') {
      return null;
    }

    const now = Date.now();
    const expiresAtMs = new Date(this.callingState.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
    this.callingState.remainingSeconds = remainingSeconds;

    if (now < expiresAtMs) {
      return null; // Ainda dentro do prazo de 30 segundos
    }

    // TEMPO ESGOTADO (30 segundos expirados sem início do participante)
    const queueItemId = this.callingState.queueItemId;
    const item = this.queue.find(q => q.id === queueItemId);

    if (!item) {
      this.callingState = null;
      this.playbackState.status = 'IDLE';
      this.playbackState.currentQueueItemId = null;
      return null;
    }

    const currentMisses = item.missedTurnCount || 0;

    if (currentMisses === 0) {
      // 1ª OCORRÊNCIA:
      // O participante não perde a vaga na fila, permanece elegível como próximo
      // Não marca como COMPLETED. Não contabiliza em totalSongsPlayed.
      item.missedTurnCount = 1;
      item.status = 'QUEUED';
      item.calledAt = undefined;
      item.callExpiresAt = undefined;

      this.callingState = null;
      this.playbackState.status = 'IDLE';
      this.playbackState.currentQueueItemId = null;
      this.playbackState.updatedAt = new Date().toISOString();

      this.logAudit(
        'SYSTEM',
        'TurnManager',
        'TURN_MISSED',
        `Primeira perda de vez: ${item.participantDisplayName} não iniciou a música "${item.musicTitle}" em 30s. Mantido na fila como próximo elegível.`
      );

      await this.persistQueueItem(item);
      await this.persistPlaybackState();

      return {
        expired: true,
        item,
        missedTurnCount: 1,
        movedToBack: false
      };
    } else {
      // 2ª OCORRÊNCIA CONSECUTIVA:
      // Participante chamado novamente e não compareceu.
      // Move o item para o FINAL da fila rotativa. O participante NÃO perde sua playlist pessoal.
      const itemIdx = this.queue.findIndex(q => q.id === item.id);
      if (itemIdx !== -1) {
        this.queue.splice(itemIdx, 1);
        this.queue.push(item);
      }

      item.status = 'QUEUED';
      item.missedTurnCount = 0; // Reset para os próximos ciclos
      item.calledAt = undefined;
      item.callExpiresAt = undefined;
      await this.reindexQueue();

      this.callingState = null;
      this.playbackState.status = 'IDLE';
      this.playbackState.currentQueueItemId = null;
      this.playbackState.updatedAt = new Date().toISOString();

      this.logAudit(
        'SYSTEM',
        'TurnManager',
        'TURN_MISSED_SECOND_TIME',
        `Segunda perda de vez consecutiva: ${item.participantDisplayName}. Música "${item.musicTitle}" movida para o final da fila.`
      );
      this.logAudit(
        'SYSTEM',
        'TurnManager',
        'QUEUE_ITEM_MOVED_TO_BACK',
        `Item ${item.id} reposicionado ao fim da fila rotativa da sessão.`
      );

      await this.persistQueueItem(item);
      await this.persistPlaybackState();

      return {
        expired: true,
        item,
        missedTurnCount: 2,
        movedToBack: true
      };
    }
  }

  /**
   * Cancelamento manual da chamada pelo operador ou supervisor
   */
  public async cancelCall(reason = 'Cancelado pelo operador', actorRole = 'CONTROLLER', actorName = 'Controlador'): Promise<boolean> {
    if (!this.callingState || this.playbackState.status !== 'CALLING_PARTICIPANT') {
      return false;
    }

    const item = this.queue.find(q => q.id === this.callingState?.queueItemId);
    if (item && item.status === 'CALLED') {
      item.status = 'QUEUED';
      item.calledAt = undefined;
      item.callExpiresAt = undefined;
      await this.persistQueueItem(item);
    }

    this.callingState = null;
    this.playbackState.status = 'IDLE';
    this.playbackState.currentQueueItemId = null;
    this.playbackState.updatedAt = new Date().toISOString();
    await this.persistPlaybackState();

    this.logAudit(
      actorRole as any,
      actorName,
      'CALL_CANCELLED',
      `Chamada de participante cancelada: ${reason}`
    );

    return true;
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
        partnerDisplayName: item.partnerDisplayName,
        isDuet: item.isDuet,
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
            partnerDisplayName: currentQueueItem.partnerDisplayName,
            isDuet: currentQueueItem.isDuet,
            toneOffset: currentQueueItem.toneOffset
          }
        : null,
      queue: upcomingQueue,
      playbackState: this.playbackState.status,
      sessionAlert,
      volume: this.playbackState.volume,
      scheduledEndTime: this.session.scheduledEndTime,
      qrCodeUrl: `https://vozplay.ai.slz.br/join?s=${this.session.code}`,
      callingState: this.callingState
        ? {
            queueItemId: this.callingState.queueItemId,
            participantId: this.callingState.participantId,
            participantDisplayName: this.callingState.participantDisplayName,
            partnerParticipantId: this.callingState.partnerParticipantId,
            partnerDisplayName: this.callingState.partnerDisplayName,
            isDuet: this.callingState.isDuet,
            musicId: this.callingState.musicId,
            musicTitle: this.callingState.musicTitle,
            musicArtist: this.callingState.musicArtist,
            versionId: this.callingState.versionId,
            versionStyle: this.callingState.versionStyle,
            youtubeVideoId: this.callingState.youtubeVideoId,
            toneOffset: this.callingState.toneOffset,
            calledAt: this.callingState.calledAt,
            expiresAt: this.callingState.expiresAt,
            remainingSeconds: this.callingState.remainingSeconds,
            missedTurnCount: this.callingState.missedTurnCount
          }
        : null,
      branding: this.getBrandingDTO(this.session.establishmentId)
    };

  }

  /**
   * Obtém a Identidade Visual do Estabelecimento (Seção 20 - Resolução via session -> establishment)
   */
  public getBranding(establishmentId: string): EstablishmentBranding {
    let branding = this.brandings.get(establishmentId);
    if (!branding) {
      branding = {
        id: 'brand-' + establishmentId,
        establishmentId,
        ...DEFAULT_BRANDING,
        businessName: this.session.establishmentId === establishmentId ? this.session.establishmentName : DEFAULT_BRANDING.businessName,
        updatedAt: new Date().toISOString()
      };
      this.brandings.set(establishmentId, branding);
    }
    return branding;
  }

  /**
   * Obtém DTO seguro de Branding para consumo em TV, Participant e Controller
   */
  public getBrandingDTO(establishmentId: string): EstablishmentBrandingDTO {
    const branding = this.getBranding(establishmentId);
    const { id, ...dto } = branding;
    return dto;
  }

  /**
   * Atualiza a Identidade Visual com sanitização estrita e validação de acessibilidade WCAG
   */
  public updateBranding(
    establishmentId: string,
    payload: Partial<EstablishmentBranding>
  ): { success: boolean; branding: EstablishmentBranding; accessibility: any; error?: string } {
    const current = this.getBranding(establishmentId);

    const businessName = payload.businessName !== undefined
      ? sanitizeText(payload.businessName, 100)
      : current.businessName;

    if (!businessName) {
      return { success: false, branding: current, accessibility: null, error: 'O nome comercial do estabelecimento é obrigatório.' };
    }

    const slogan = payload.slogan !== undefined ? sanitizeText(payload.slogan, 160) : current.slogan;
    const primaryColor = payload.primaryColor ? normalizeHexColor(payload.primaryColor, current.primaryColor) : current.primaryColor;
    const secondaryColor = payload.secondaryColor ? normalizeHexColor(payload.secondaryColor, current.secondaryColor) : current.secondaryColor;
    const accentColor = payload.accentColor ? normalizeHexColor(payload.accentColor, current.accentColor) : current.accentColor;
    const backgroundColor = payload.backgroundColor ? normalizeHexColor(payload.backgroundColor, current.backgroundColor) : current.backgroundColor;
    const surfaceColor = payload.surfaceColor ? normalizeHexColor(payload.surfaceColor, current.surfaceColor) : current.surfaceColor;
    const textColor = payload.textColor ? normalizeHexColor(payload.textColor, current.textColor) : current.textColor;

    const themeMode = (['DARK', 'LIGHT', 'AUTO'].includes(payload.themeMode as string) ? payload.themeMode : current.themeMode) as any;
    const tvTheme = (['DARK', 'LIGHT', 'AUTO'].includes(payload.tvTheme as string) ? payload.tvTheme : current.tvTheme) as any;
    const participantTheme = (['DARK', 'LIGHT', 'AUTO'].includes(payload.participantTheme as string) ? payload.participantTheme : current.participantTheme) as any;
    const controllerTheme = (['DARK', 'LIGHT', 'AUTO'].includes(payload.controllerTheme as string) ? payload.controllerTheme : current.controllerTheme) as any;

    let logoUrl = current.logoUrl;
    if (payload.logoUrl !== undefined) {
      logoUrl = payload.logoUrl ? payload.logoUrl.trim() : '';
    }

    // Avaliação de acessibilidade WCAG 2.1
    const accessibility = evaluateBrandingAccessibility(backgroundColor, surfaceColor, textColor, primaryColor);

    const updatedBranding: EstablishmentBranding = {
      ...current,
      businessName,
      slogan,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
      surfaceColor,
      textColor,
      themeMode,
      tvTheme,
      participantTheme,
      controllerTheme,
      updatedAt: new Date().toISOString()
    };

    this.brandings.set(establishmentId, updatedBranding);

    // Se este estabelecimento for o da sessão ativa, atualiza o nome do estabelecimento e o branding da sessão
    if (this.session.establishmentId === establishmentId) {
      this.session.establishmentName = businessName;
      this.session.branding = this.getBrandingDTO(establishmentId);
    }

    this.logAudit(
      'SUPERVISOR',
      'Administrador',
      'BRANDING_UPDATED',
      `Identidade visual do estabelecimento "${businessName}" atualizada. WCAG Compliant: ${accessibility.compliant}`
    );

    this.persistBranding(updatedBranding);

    return {
      success: true,
      branding: updatedBranding,
      accessibility
    };
  }

  /**
   * Restaura o Branding para a Identidade Padrão do VozPlay (Seção 26 do Requisito)
   */
  public resetBranding(establishmentId: string): EstablishmentBranding {
    const resetBranding: EstablishmentBranding = {
      id: 'brand-' + establishmentId,
      establishmentId,
      ...DEFAULT_BRANDING,
      businessName: 'VozPlay Lounge São Luís',
      updatedAt: new Date().toISOString()
    };

    this.brandings.set(establishmentId, resetBranding);

    if (this.session.establishmentId === establishmentId) {
      this.session.establishmentName = resetBranding.businessName;
      this.session.branding = this.getBrandingDTO(establishmentId);
    }

    this.logAudit(
      'SUPERVISOR',
      'Administrador',
      'BRANDING_RESET',
      `Identidade visual do estabelecimento restaurada para o padrão oficial do VozPlay.`
    );

    this.persistBranding(resetBranding);

    return resetBranding;
  }
}

export const db = new VozPlayDB();
