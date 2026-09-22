/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Versioned REST API Router (/api/v1/*)
 * Section 34 of PRD: Fully Decoupled Multi-Client API
 */

import { Router } from 'express';
import { db } from './db.js';
import { wsServer } from './wsServer.js';
import QRCode from 'qrcode';

export const apiRouter = Router();

// ==========================================
// 1. SESSÃO (/api/v1/session)
// ==========================================
apiRouter.get('/session', (req, res) => {
  res.json({
    success: true,
    data: {
      ...db.session,
      participantsCount: db.participants.size,
      queuedCount: db.queue.filter(q => q.status === 'QUEUED').length,
      tvConnected: db.tvConnected,
      playbackStatus: db.playbackState.status
    }
  });
});

apiRouter.post('/session/start', (req, res) => {
  db.session.status = 'ACTIVE';
  db.session.startedAt = new Date().toISOString();
  db.logAudit('SUPERVISOR', db.session.supervisorName, 'SESSION_START', 'Sessão iniciada.');
  wsServer.broadcast('session.started', { session: db.session });
  res.json({ success: true, session: db.session });
});

apiRouter.post('/session/pause', (req, res) => {
  db.session.status = 'PAUSED';
  db.logAudit('SUPERVISOR', db.session.supervisorName, 'SESSION_PAUSE', 'Sessão pausada temporariamente.');
  wsServer.broadcast('session.updated', { session: db.session });
  res.json({ success: true, session: db.session });
});

apiRouter.post('/session/resume', (req, res) => {
  db.session.status = 'ACTIVE';
  db.logAudit('SUPERVISOR', db.session.supervisorName, 'SESSION_RESUME', 'Sessão retomada.');
  wsServer.broadcast('session.updated', { session: db.session });
  res.json({ success: true, session: db.session });
});

apiRouter.post('/session/extend', (req, res) => {
  const { minutes } = req.body;
  const extendMinutes = Number(minutes) || 15;
  const currentEnd = db.session.scheduledEndTime ? new Date(db.session.scheduledEndTime).getTime() : Date.now();
  const newEnd = new Date(Math.max(Date.now(), currentEnd) + extendMinutes * 60000);
  db.session.scheduledEndTime = newEnd.toISOString();

  db.logAudit(
    'SUPERVISOR',
    db.session.supervisorName,
    'SESSION_EXTEND',
    `Sessão estendida em +${extendMinutes} minutos. Novo término: ${newEnd.toLocaleTimeString('pt-BR')}`
  );

  db.addNotification('session_extended', 'Sessão Estendida', `O encerramento foi postergado em +${extendMinutes} min.`, 'info');
  wsServer.broadcast('session.updated', { session: db.session });
  res.json({ success: true, scheduledEndTime: db.session.scheduledEndTime });
});

apiRouter.post('/session/end', (req, res) => {
  db.session.status = 'ENDED';
  db.session.endedAt = new Date().toISOString();

  // Any remaining queued songs are marked as CANCELLED_SESSION_ENDED (not sung)
  for (const item of db.queue) {
    if (item.status === 'QUEUED') {
      item.status = 'CANCELLED_SESSION_ENDED';
    }
  }

  db.playbackState.status = 'IDLE';
  db.playbackState.currentQueueItemId = null;

  db.logAudit('SUPERVISOR', db.session.supervisorName, 'SESSION_END', 'Sessão finalizada pelo Supervisor.');
  wsServer.broadcast('session.ended', { session: db.session });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, session: db.session });
});

// ==========================================
// 2. PARTICIPANTES (/api/v1/participants)
// ==========================================
apiRouter.post('/participants/register', (req, res) => {
  const { displayName, whatsapp, consentMarketing } = req.body;

  if (!displayName || !displayName.trim()) {
    return res.status(400).json({ error: 'O nome do participante é obrigatório.' });
  }

  const pId = 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
  const normalizedWa = whatsapp ? db.normalizeWhatsapp(whatsapp) : undefined;

  let identityId = undefined;
  let pastHistory = null;

  if (normalizedWa) {
    let identity = db.identities.get(normalizedWa);
    if (identity) {
      identity.totalParticipations++;
      identity.lastSeen = new Date().toISOString();
      if (consentMarketing !== undefined) {
        identity.consentMarketing = Boolean(consentMarketing);
      }
    } else {
      identity = {
        id: 'id-' + Date.now(),
        normalizedWhatsapp: normalizedWa,
        displayName: displayName.trim(),
        consentMarketing: Boolean(consentMarketing),
        consentTimestamp: consentMarketing ? new Date().toISOString() : undefined,
        totalParticipations: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };
      db.identities.set(normalizedWa, identity);
    }
    identityId = identity.id;

    // Register or update lead
    db.leads.set(normalizedWa, {
      id: identity.id,
      name: displayName.trim(),
      normalizedWhatsapp: normalizedWa,
      establishmentId: db.session.establishmentId,
      firstParticipation: identity.firstSeen,
      lastParticipation: identity.lastSeen,
      participationsCount: identity.totalParticipations,
      consentMarketing: identity.consentMarketing,
      consentDate: identity.consentTimestamp,
      origin: 'PARTICIPANTE'
    });

    pastHistory = {
      totalParticipations: identity.totalParticipations,
      firstSeen: identity.firstSeen
    };
  }

  const participant = {
    id: pId,
    sessionId: db.session.id,
    displayName: displayName.trim(),
    whatsapp: normalizedWa,
    isVerified: false,
    identityId,
    joinedAt: new Date().toISOString()
  };

  db.participants.set(pId, participant);
  db.playlists.set(pId, []);
  db.metrics.totalParticipants = db.participants.size;

  db.logAudit('PARTICIPANT', participant.displayName, 'PARTICIPANT_JOIN', 'Participante entrou na sessão.');
  wsServer.broadcast('participant.joined', { participant: { id: participant.id, displayName: participant.displayName } });

  res.json({
    success: true,
    participant,
    history: pastHistory
  });
});

apiRouter.post('/participants/verify-presence', (req, res) => {
  const { participantId, code } = req.body;
  const participant = db.participants.get(participantId);

  if (!participant) {
    return res.status(404).json({ error: 'Participante não encontrado na sessão.' });
  }

  // Rate Limiting Protection against 4-digit code enumeration (Section 13)
  const ipKey = req.ip || participantId;
  const attempts = db.presenceFailedAttempts.get(ipKey) || { count: 0, lastAttempt: Date.now() };

  // Reset if last attempt was > 60 seconds ago
  if (Date.now() - attempts.lastAttempt > 60000) {
    attempts.count = 0;
  }

  if (attempts.count >= 5) {
    return res.status(429).json({
      error: 'Muitas tentativas incorretas. Aguarde 60 segundos antes de tentar novamente.'
    });
  }

  const currentPresence = db.getPresenceCode();

  if (code !== currentPresence.code) {
    attempts.count++;
    attempts.lastAttempt = Date.now();
    db.presenceFailedAttempts.set(ipKey, attempts);
    return res.status(400).json({
      error: 'Código de presença inválido ou expirado. Verifique com o Controlador.',
      remainingAttempts: 5 - attempts.count
    });
  }

  // Validated! Reset failed attempts
  db.presenceFailedAttempts.delete(ipKey);
  participant.isVerified = true;
  participant.verifiedAt = new Date().toISOString();

  db.logAudit('PARTICIPANT', participant.displayName, 'PRESENCE_VERIFIED', 'Presença física validada com sucesso.');
  wsServer.broadcast('participant.verified', { participantId: participant.id, displayName: participant.displayName });

  res.json({
    success: true,
    message: 'Presença validada! Agora você está autorizado a entrar na fila musical.',
    participant
  });
});

apiRouter.get('/participants/:id/history', (req, res) => {
  const participant = db.participants.get(req.params.id);
  if (!participant || !participant.whatsapp) {
    return res.json({
      hasPersistentIdentity: false,
      historyItems: []
    });
  }

  // Calculate history based on normalized whatsapp (PRD Seção 41)
  const sungSongs = db.queue.filter(
    q => q.participantId === participant.id && q.status === 'COMPLETED'
  );

  const versionFrequency: Record<string, number> = {};
  for (const s of sungSongs) {
    const key = `${s.musicTitle}::${s.versionStyle}`;
    versionFrequency[key] = (versionFrequency[key] || 0) + 1;
  }

  const identity = db.identities.get(participant.whatsapp);

  res.json({
    hasPersistentIdentity: true,
    totalSung: sungSongs.length,
    totalParticipations: identity?.totalParticipations || 1,
    firstSeen: identity?.firstSeen,
    historyItems: sungSongs.map(s => {
      const key = `${s.musicTitle}::${s.versionStyle}`;
      const count = versionFrequency[key] || 1;
      return {
        musicTitle: s.musicTitle,
        musicArtist: s.musicArtist,
        versionStyle: s.versionStyle,
        completedAt: s.completedAt,
        sungCount: count,
        badgeText: count > 1 ? `Você já cantou esta versão ${count} vezes` : 'Primeira vez cantada'
      };
    })
  });
});

// ==========================================
// 3. CATÁLOGO MUSICAL (/api/v1/music)
// ==========================================
apiRouter.get('/music', (req, res) => {
  const q = ((req.query.q as string) || '').toLowerCase().trim();
  const genre = ((req.query.genre as string) || '').trim();

  let results = db.catalog;

  if (genre && genre !== 'Todos') {
    results = results.filter(m => m.genre.toLowerCase() === genre.toLowerCase());
  }

  if (q) {
    db.metrics.totalSongsSearched++;
    results = results.filter(
      m =>
        m.title.toLowerCase().includes(q) ||
        m.artist.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    total: results.length,
    genres: ['Todos', 'Sertanejo', 'Pagode', 'Rock Nacional', 'Pop Internacional', 'MPB / Bossa Nova', 'Classic Rock'],
    data: results
  });
});

apiRouter.post('/music/custom-request', (req, res) => {
  const { title, artist, genre, youtubeVideoId, style } = req.body;

  if (!title || !title.trim() || !artist || !artist.trim()) {
    return res.status(400).json({ error: 'Título e artista são obrigatórios.' });
  }

  // Extract clean YouTube video ID if URL provided
  let cleanYtId = (youtubeVideoId || '').trim();
  if (cleanYtId.includes('youtube.com/watch?v=')) {
    const match = cleanYtId.match(/v=([a-zA-Z0-9_-]{11})/);
    if (match) cleanYtId = match[1];
  } else if (cleanYtId.includes('youtu.be/')) {
    const match = cleanYtId.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) cleanYtId = match[1];
  } else if (!cleanYtId) {
    // Default fallback popular backing track
    cleanYtId = 'dQw4w9WgXcQ';
  }

  const musicId = 'm-' + Date.now();
  const versionId = 'v-' + Date.now();

  const newMusic = {
    id: musicId,
    title: title.trim(),
    artist: artist.trim(),
    genre: genre?.trim() || 'Pop',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&q=80',
    versions: [
      {
        id: versionId,
        musicId: musicId,
        style: style || 'Karaokê',
        label: `${style || 'Karaokê'} HD Especial`,
        youtubeVideoId: cleanYtId,
        durationSec: 210,
        quality: '1080p'
      }
    ]
  };

  db.catalog.unshift(newMusic);
  db.logAudit('PARTICIPANT', 'SISTEMA', 'MUSIC_REQUEST_ADDED', `Nova música solicitada: ${newMusic.title} (${newMusic.artist})`);

  res.json({
    success: true,
    message: `Música "${newMusic.title}" adicionada com sucesso ao catálogo!`,
    music: newMusic,
    version: newMusic.versions[0]
  });
});


// ==========================================
// 4. PLAYLIST PESSOAL (/api/v1/playlists)
// ==========================================
apiRouter.get('/playlists/:participantId', (req, res) => {
  const items = db.playlists.get(req.params.participantId) || [];
  res.json({ success: true, items });
});

apiRouter.post('/playlists/add', (req, res) => {
  const { participantId, musicId, versionId } = req.body;
  const participant = db.participants.get(participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participante não encontrado.' });
  }

  const music = db.catalog.find(m => m.id === musicId);
  if (!music) {
    return res.status(404).json({ error: 'Música não encontrada.' });
  }

  const version = music.versions.find(v => v.id === versionId) || music.versions[0];
  const { toneOffset } = req.body;

  const playlistItem = {
    id: 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    participantId,
    musicId: music.id,
    versionId: version.id,
    musicTitle: music.title,
    musicArtist: music.artist,
    versionStyle: version.style,
    youtubeVideoId: version.youtubeVideoId,
    toneOffset: Math.max(-3, Math.min(3, Number(toneOffset) || 0)),
    status: 'DRAFT' as const,
    createdAt: new Date().toISOString()
  };

  const userList = db.playlists.get(participantId) || [];
  userList.push(playlistItem);
  db.playlists.set(participantId, userList);

  res.json({ success: true, item: playlistItem });
});

apiRouter.delete('/playlists/:participantId/:itemId', (req, res) => {
  const { participantId, itemId } = req.params;
  const userList = db.playlists.get(participantId) || [];
  const filtered = userList.filter(i => i.id !== itemId);
  db.playlists.set(participantId, filtered);
  res.json({ success: true, items: filtered });
});

// ==========================================
// 5. FILA DA SESSÃO (/api/v1/queue)
// ==========================================
apiRouter.get('/queue', (req, res) => {
  res.json({
    success: true,
    queue: db.queue,
    playingItem: db.queue.find(q => q.status === 'PLAYING') || null,
    totalQueued: db.queue.filter(q => q.status === 'QUEUED').length
  });
});

apiRouter.post('/queue/add', (req, res) => {
  const { participantId, musicId, versionId, playlistItemId, toneOffset } = req.body;

  if (db.session.status !== 'ACTIVE') {
    return res.status(400).json({ error: 'A sessão não está ativa para novas músicas no momento.' });
  }

  // PRD Seção 29: Encerramento Programado - bloquear novas músicas quando atingir o horário
  if (db.session.scheduledEndTime) {
    const isPastScheduledEnd = Date.now() >= new Date(db.session.scheduledEndTime).getTime();
    if (isPastScheduledEnd) {
      return res.status(403).json({
        error: 'O horário limite da sessão foi atingido. Novas músicas estão bloqueadas aguardando prorrogação pelo Supervisor.'
      });
    }
  }

  const participant = db.participants.get(participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participante não cadastrado na sessão.' });
  }

  if (!participant.isVerified) {
    return res.status(403).json({
      error: 'Você precisa validar o Código de Presença de 4 dígitos com o Controlador antes de entrar na fila.'
    });
  }

  const music = db.catalog.find(m => m.id === musicId);
  if (!music) {
    return res.status(404).json({ error: 'Música não encontrada no catálogo.' });
  }

  const version = music.versions.find(v => v.id === versionId) || music.versions[0];

  const queueItem = db.addSongToQueue(participant, music, version, Number(toneOffset) || 0);

  // If added from personal playlist, update playlist status
  if (playlistItemId) {
    const userList = db.playlists.get(participantId) || [];
    const found = userList.find(i => i.id === playlistItemId);
    if (found) found.status = 'QUEUED';
  }

  // If player is idle and nothing is playing, can auto-play if controller allows or wait
  wsServer.broadcast('queue.added', { item: queueItem });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    queueItem,
    message: `Música "${music.title}" adicionada com sucesso na fila rotativa!`
  });
});

apiRouter.post('/queue/tune', (req, res) => {
  const { queueItemId, toneOffset } = req.body;
  const item = db.queue.find(q => q.id === queueItemId);
  if (!item) {
    return res.status(404).json({ error: 'Item não encontrado na fila.' });
  }
  item.toneOffset = Math.max(-3, Math.min(3, Number(toneOffset) || 0));
  wsServer.broadcast('queue.updated', { item });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, item });
});


apiRouter.post('/queue/cancel', (req, res) => {
  const { queueItemId, participantId } = req.body;
  const item = db.queue.find(q => q.id === queueItemId);

  if (!item) {
    return res.status(404).json({ error: 'Item da fila não encontrado.' });
  }

  // A participant can only cancel their own song
  if (participantId && item.participantId !== participantId) {
    return res.status(403).json({ error: 'Você só pode cancelar suas próprias músicas.' });
  }

  // Section 20: If already PLAYING, only controller/supervisor can cancel
  if (item.status === 'PLAYING') {
    return res.status(400).json({
      error: 'Esta música já está sendo reproduzida na TV. Solicite ao Controlador ou Supervisor para pular.'
    });
  }

  if (item.status !== 'QUEUED') {
    return res.status(400).json({ error: 'Apenas músicas na fila de espera podem ser canceladas.' });
  }

  item.status = 'CANCELLED';
  db.metrics.totalCancellations++;
  db.reindexQueue();

  db.logAudit(
    'PARTICIPANT',
    item.participantDisplayName,
    'QUEUE_CANCEL',
    `Música cancelada pelo participante: ${item.musicTitle}`
  );

  wsServer.broadcast('queue.cancelled', { queueItemId });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    message: 'Música cancelada com sucesso.'
  });
});

// Section 43: Compartilhar Minha Vez (SEM vazar WhatsApp)
apiRouter.get('/queue/share/:queueItemId', (req, res) => {
  const item = db.queue.find(q => q.id === req.params.queueItemId);
  if (!item) {
    return res.status(404).json({ error: 'Item não encontrado.' });
  }

  const queuedBefore = db.queue
    .filter(q => q.status === 'QUEUED' && q.orderIndex < item.orderIndex)
    .length;

  res.json({
    success: true,
    data: {
      id: item.id,
      participantDisplayName: item.participantDisplayName,
      musicTitle: item.musicTitle,
      musicArtist: item.musicArtist,
      versionStyle: item.versionStyle,
      toneOffset: item.toneOffset || 0,
      status: item.status,
      positionInQueue: item.status === 'PLAYING' ? 'Cantando Agora!' : queuedBefore + 1,
      estimatedWaitMinutes: item.status === 'PLAYING' ? 0 : (queuedBefore + 1) * 4,
      establishmentName: db.session.establishmentName,
      sessionStatus: db.session.status,
      domain: 'vozplay.ai.slz.br'
    }
  });
});

// ==========================================
// 6. CONTROLADOR (/api/v1/controller)
// ==========================================
apiRouter.get('/controller/presence-code', (req, res) => {
  const code = db.getPresenceCode();
  res.json({ success: true, presenceCode: code });
});

apiRouter.post('/controller/play', (req, res) => {
  let item = db.queue.find(q => q.status === 'PLAYING');

  if (!item) {
    // Pick the next queued item
    item = db.queue.find(q => q.status === 'QUEUED');
    if (item) {
      item.status = 'PLAYING';
      item.startedAt = new Date().toISOString();
      db.playbackState.currentQueueItemId = item.id;
    }
  }

  if (!item) {
    return res.status(400).json({ error: 'Não há músicas na fila para reproduzir.' });
  }

  db.playbackState.status = 'PLAYING';
  db.playbackState.updatedAt = new Date().toISOString();

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'PLAYER_PLAY',
    `Iniciada reprodução: ${item.musicTitle} (${item.participantDisplayName})`
  );

  wsServer.broadcast('player.play', { item });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, item, playbackState: db.playbackState });
});

apiRouter.post('/controller/pause', (req, res) => {
  db.playbackState.status = 'PAUSED';
  db.playbackState.updatedAt = new Date().toISOString();

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'PLAYER_PAUSE',
    'Reprodução pausada pelo controlador.'
  );

  wsServer.broadcast('player.pause', {});
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, playbackState: db.playbackState });
});

apiRouter.post('/controller/next', (req, res) => {
  const currentItem = db.queue.find(q => q.status === 'PLAYING');
  if (currentItem) {
    currentItem.status = 'COMPLETED';
    currentItem.completedAt = new Date().toISOString();
    db.metrics.totalSkips++;
    db.logAudit(
      'CONTROLLER',
      db.session.activeControllerName || 'Controlador',
      'PLAYER_SKIP',
      `Música pulada/avançada: ${currentItem.musicTitle}`
    );
  }

  // Advance to next queued item
  const nextItem = db.queue.find(q => q.status === 'QUEUED');
  if (nextItem && db.session.status === 'ACTIVE') {
    nextItem.status = 'PLAYING';
    nextItem.startedAt = new Date().toISOString();
    db.playbackState.currentQueueItemId = nextItem.id;
    db.playbackState.status = 'PLAYING';
    wsServer.broadcast('player.play', { item: nextItem });
  } else {
    db.playbackState.currentQueueItemId = null;
    db.playbackState.status = 'IDLE';
    wsServer.broadcast('queue.completed', { item: currentItem });
  }

  db.playbackState.updatedAt = new Date().toISOString();
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, nextItem: nextItem || null });
});

apiRouter.post('/controller/report-error', (req, res) => {
  const { errorReason } = req.body;
  const currentItem = db.queue.find(q => q.status === 'PLAYING');

  if (currentItem) {
    currentItem.status = 'ERROR';
    currentItem.errorMessage = errorReason || 'Erro reportado pelo controlador';
  }

  db.playbackState.status = 'ERROR';
  db.metrics.playbackErrors++;

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'PLAYBACK_ERROR',
    `Erro registrado: ${errorReason || 'Falha de reprodução'}`
  );

  db.addNotification(
    'playback_error',
    'Falha de Reprodução',
    `Erro na música "${currentItem?.musicTitle || ''}": ${errorReason}`,
    'error'
  );

  wsServer.broadcast('player.error', { error: errorReason, item: currentItem });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, currentItem });
});

// PRD Seção 25: Erro de Reprodução - Reenfileirar com prioridade sem punir o participante
apiRouter.post('/controller/requeue-error', (req, res) => {
  const currentItem = db.queue.find(q => q.status === 'ERROR' || q.status === 'PLAYING');
  if (!currentItem) {
    return res.status(404).json({ error: 'Nenhuma música com erro ou em reprodução para reenfileirar.' });
  }

  currentItem.status = 'QUEUED';
  currentItem.errorMessage = undefined;

  // Move to the front of queued items
  const activeQueued = db.queue.filter(q => q.id !== currentItem.id && q.status === 'QUEUED');
  const otherItems = db.queue.filter(q => q.id !== currentItem.id && q.status !== 'QUEUED');
  db.queue = [...otherItems, currentItem, ...activeQueued];
  db.reindexQueue();

  db.playbackState.status = 'IDLE';
  db.playbackState.currentQueueItemId = null;

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'REQUEUE_ERROR',
    `Música reenfileirada no topo da fila após falha técnica: ${currentItem.musicTitle} (${currentItem.participantDisplayName})`
  );

  wsServer.broadcast('queue.updated', { item: currentItem });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, message: 'Música reenfileirada com prioridade!', item: currentItem });
});

// PRD Seção 20 & 24: Operador - Promover música para o topo da fila (Próxima a Tocar)
apiRouter.post('/controller/queue/promote', (req, res) => {
  const { queueItemId } = req.body;
  const itemIndex = db.queue.findIndex(q => q.id === queueItemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: 'Item não encontrado na fila.' });
  }

  const item = db.queue[itemIndex];
  if (item.status !== 'QUEUED') {
    return res.status(400).json({ error: 'Apenas músicas na fila podem ser promovidas.' });
  }

  // Remove from current position
  db.queue.splice(itemIndex, 1);

  // Insert right at the first position among queued items
  const firstQueuedIndex = db.queue.findIndex(q => q.status === 'QUEUED');
  if (firstQueuedIndex === -1) {
    db.queue.push(item);
  } else {
    db.queue.splice(firstQueuedIndex, 0, item);
  }

  db.reindexQueue();

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'QUEUE_PROMOTE',
    `Música promovida para o topo da fila: ${item.musicTitle} (${item.participantDisplayName})`
  );

  wsServer.broadcast('queue.updated', { item });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    message: `"${item.musicTitle}" movida para o topo da fila!`,
    queue: db.queue
  });
});

// PRD Seção 20 & 24: Operador - Remover música da fila (desistência ou ausência de participante)
apiRouter.post('/controller/queue/remove', (req, res) => {
  const { queueItemId, reason } = req.body;
  const item = db.queue.find(q => q.id === queueItemId);
  if (!item) {
    return res.status(404).json({ error: 'Item não encontrado na fila.' });
  }

  if (item.status === 'PLAYING') {
    return res.status(400).json({ error: 'A música está tocando agora. Use a opção de Pular no player.' });
  }

  item.status = 'CANCELLED';
  db.reindexQueue();

  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Controlador',
    'QUEUE_REMOVE',
    `Música removida pelo operador (${reason || 'Participante ausente'}): ${item.musicTitle} (${item.participantDisplayName})`
  );

  wsServer.broadcast('queue.cancelled', { queueItemId });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    message: `Música removida da fila.`,
    queue: db.queue
  });
});

apiRouter.post('/controller/volume', (req, res) => {
  const { volume, muted } = req.body;
  if (typeof volume === 'number') {
    db.playbackState.volume = Math.max(0, Math.min(100, Math.round(volume)));
  }
  wsServer.broadcast('player.volume', { volume: db.playbackState.volume, muted: Boolean(muted) });
  res.json({ success: true, volume: db.playbackState.volume });
});

// Section 47: DJ Soundboard Trigger (Mesa do Operador)
apiRouter.post('/controller/soundboard', (req, res) => {
  const { soundType, label } = req.body;
  const payload = {
    id: 'sb-' + Date.now(),
    soundType: soundType || 'applause',
    label: label || 'Efeito DJ',
    timestamp: new Date().toISOString()
  };
  db.logAudit(
    'CONTROLLER',
    db.session.activeControllerName || 'Operador',
    'SOUNDBOARD_TRIGGER',
    `Efeito sonoro acionado: ${payload.label}`
  );
  wsServer.broadcast('soundboard.play', payload);
  res.json({ success: true, payload });
});

// Section 48: Interação da Plateia em Tempo Real (Reações ao Vivo)
apiRouter.post('/reactions', (req, res) => {
  const { participantName, emoji, label } = req.body;
  const reaction = {
    id: 'rx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    participantName: (participantName || 'Alguém na plateia').trim(),
    emoji: emoji || '👏',
    label: label || 'Aplausos',
    timestamp: new Date().toISOString()
  };
  wsServer.broadcast('reaction.sent', reaction);
  res.json({ success: true, reaction });
});

// ==========================================
// 7. SUPERVISOR / CAIXA (/api/v1/supervisor)
// ==========================================
apiRouter.post('/supervisor/broadcast-alert', (req, res) => {
  const { message, level } = req.body;
  if (!message || !message.trim()) {
    db.sessionAlert = null;
  } else {
    db.sessionAlert = {
      message: message.trim(),
      level: level || 'INFO',
      active: true,
      timestamp: new Date().toISOString()
    };
  }

  db.logAudit('SUPERVISOR', db.session.supervisorName, 'BROADCAST_ALERT', `Aviso transmitido à TV: ${message || 'Alerta limpo'}`);
  wsServer.broadcast('session.alert', { sessionAlert: db.sessionAlert });
  wsServer.broadcastAuthoritativeState();
  res.json({ success: true, sessionAlert: db.sessionAlert });
});

apiRouter.get('/analytics', (req, res) => {
  const genreCount: Record<string, number> = {};
  for (const m of db.catalog) {
    genreCount[m.genre] = (genreCount[m.genre] || 0) + 1;
  }

  const genrePopularity = Object.entries(genreCount).map(([genre, count]) => ({ genre, count }));

  const topSongs = db.catalog.slice(0, 5).map(m => ({
    title: m.title,
    artist: m.artist,
    genre: m.genre,
    playCount: db.queue.filter(q => q.musicTitle === m.title && q.status === 'COMPLETED').length + 2
  })).sort((a, b) => b.playCount - a.playCount);

  res.json({
    success: true,
    analytics: {
      metrics: db.metrics,
      genrePopularity,
      topSongs,
      averageWaitMinutes: Math.max(4, db.queue.filter(q => q.status === 'QUEUED').length * 4),
      peakHours: [
        { hour: '19:00', requests: 4 },
        { hour: '20:00', requests: 9 },
        { hour: '21:00', requests: 18 },
        { hour: '22:00', requests: 24 },
        { hour: '23:00', requests: 14 }
      ]
    }
  });
});

// Section 31: Emergency Takeover
apiRouter.post('/supervisor/takeover', (req, res) => {
  const oldController = db.session.activeControllerName;
  db.session.activeControllerId = 'supervisor-emergency';
  db.session.activeControllerName = `${db.session.supervisorName} (Controle de Emergência)`;

  // Old presence code is invalidated; new presence code generated immediately
  const newCode = db.generateNewPresenceCode();

  db.logAudit(
    'SUPERVISOR',
    db.session.supervisorName,
    'EMERGENCY_TAKEOVER',
    `Supervisor assumiu o controle emergencial. Controlador anterior (${oldController}) revogado.`
  );

  db.addNotification(
    'emergency_takeover',
    'Controle Emergencial Assumido',
    `O Supervisor assumiu o controle direto da sessão. O código de presença foi renovado.`,
    'warning'
  );

  wsServer.broadcast('controller.revoked', { message: 'Controlador revogado pelo Supervisor' });
  wsServer.broadcast('controller.assigned', {
    controllerId: db.session.activeControllerId,
    controllerName: db.session.activeControllerName
  });
  wsServer.broadcast('presence.renewed', { code: newCode });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    message: 'Controle emergencial assumido com sucesso.',
    session: db.session,
    presenceCode: newCode
  });
});

apiRouter.post('/supervisor/authorize-controller', (req, res) => {
  const { controllerName } = req.body;
  if (!controllerName || !controllerName.trim()) {
    return res.status(400).json({ error: 'Nome do controlador é obrigatório.' });
  }

  const oldController = db.session.activeControllerName;
  db.session.activeControllerId = 'ctrl-' + Date.now();
  db.session.activeControllerName = controllerName.trim();

  // Invalidate old presence code and generate fresh one
  const newCode = db.generateNewPresenceCode();

  db.logAudit(
    'SUPERVISOR',
    db.session.supervisorName,
    'CONTROLLER_ASSIGN',
    `Novo controlador autorizado: ${controllerName.trim()}. Anterior: ${oldController || 'Nenhum'}`
  );

  wsServer.broadcast('controller.changed', {
    controllerId: db.session.activeControllerId,
    controllerName: db.session.activeControllerName
  });
  wsServer.broadcast('presence.renewed', { code: newCode });
  wsServer.broadcastAuthoritativeState();

  res.json({
    success: true,
    session: db.session,
    presenceCode: newCode
  });
});

apiRouter.post('/supervisor/revoke-controller', (req, res) => {
  const oldName = db.session.activeControllerName;
  db.session.activeControllerId = undefined;
  db.session.activeControllerName = undefined;

  // Invalidate code
  db.generateNewPresenceCode();

  db.logAudit(
    'SUPERVISOR',
    db.session.supervisorName,
    'CONTROLLER_REVOKE',
    `Controlador revogado: ${oldName}`
  );

  wsServer.broadcast('controller.revoked', { message: 'Controlador revogado.' });
  wsServer.broadcastAuthoritativeState();

  res.json({ success: true, message: 'Controlador revogado com sucesso.' });
});

apiRouter.get('/supervisor/audit-logs', (req, res) => {
  res.json({ success: true, logs: db.auditLogs });
});

apiRouter.get('/supervisor/notifications', (req, res) => {
  res.json({ success: true, notifications: db.notifications });
});

// Section 12: QR Code Público da Unidade
apiRouter.get('/supervisor/qrcode', async (req, res) => {
  try {
    const targetUrl = `https://vozplay.ai.slz.br/join?s=${db.session.code}`;
    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff'
      }
    });
    res.json({ success: true, qrDataUrl, targetUrl, sessionCode: db.session.code });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar QR Code' });
  }
});

// ==========================================
// 8. TV CLIENT (/api/v1/tv)
// ==========================================
// Section 27: Strict TVSessionDTO
apiRouter.get('/tv/session', (req, res) => {
  const dto = db.getTVSessionDTO();
  res.json({ success: true, data: dto });
});

apiRouter.post('/tv/heartbeat', (req, res) => {
  db.tvConnected = true;
  db.lastTvHeartbeat = Date.now();
  res.json({ success: true });
});

// ==========================================
// 9. LEADS (/api/v1/leads)
// ==========================================
apiRouter.get('/leads', (req, res) => {
  const leadsArray = Array.from(db.leads.values());
  res.json({
    success: true,
    total: leadsArray.length,
    leads: leadsArray
  });
});

// ==========================================
// 10. MÉTRICAS (/api/v1/metrics)
// ==========================================
apiRouter.get('/metrics', (req, res) => {
  res.json({
    success: true,
    metrics: {
      ...db.metrics,
      activeParticipants: db.participants.size,
      queueLength: db.queue.filter(q => q.status === 'QUEUED').length
    }
  });
});

// ==========================================
// 11. DISPOSITIVOS & HANDSHAKE MULTI-CLIENT (/api/v1/devices)
// PRD Seções 33, 36, 37, 56 e 61: Registro de clientes desacoplados
// ==========================================
apiRouter.post('/devices/handshake', (req, res) => {
  const { deviceId, clientType, role, platform, clientVersion } = req.body;
  const cleanId = (deviceId || 'dev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)).trim();

  const info = {
    deviceId: cleanId,
    clientType: clientType || 'PWA',
    role: role || 'PARTICIPANT',
    platform: platform || 'Web/Browser',
    clientVersion: clientVersion || '1.0.0-beta',
    lastSeenAt: new Date().toISOString()
  };

  db.devices.set(cleanId, info);

  db.logAudit(
    'SYSTEM',
    'DeviceHandshake',
    'DEVICE_CONNECT',
    `Cliente conectado: ${cleanId} [${info.clientType} / ${info.role} / ${info.platform}]`
  );

  res.json({
    success: true,
    device: info,
    serverTime: new Date().toISOString(),
    sessionStatus: db.session.status,
    scheduledEndTime: db.session.scheduledEndTime
  });
});

apiRouter.get('/devices', (req, res) => {
  res.json({
    success: true,
    total: db.devices.size,
    devices: Array.from(db.devices.values())
  });
});
