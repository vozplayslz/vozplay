-- ==========================================================
-- VOZPLAY BETA - PostgreSQL DDL Schema
-- Dominio: vozplay.ai.slz.br
-- Entidades definidas na Seção 47 do PRD
-- ==========================================================

-- 1. Estabelecimentos
CREATE TABLE IF NOT EXISTS establishments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL DEFAULT 'vozplay.ai.slz.br',
    unit_code VARCHAR(32) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1.1 Identidade Visual & Branding do Estabelecimento (White-Label)
CREATE TABLE IF NOT EXISTS establishment_branding (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) UNIQUE NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    logo_url TEXT,
    business_name VARCHAR(100) NOT NULL,
    slogan VARCHAR(160),
    primary_color VARCHAR(16) NOT NULL DEFAULT '#7C3AED',
    secondary_color VARCHAR(16) NOT NULL DEFAULT '#EC4899',
    accent_color VARCHAR(16) NOT NULL DEFAULT '#F59E0B',
    background_color VARCHAR(16) NOT NULL DEFAULT '#060811',
    surface_color VARCHAR(16) NOT NULL DEFAULT '#0E1322',
    text_color VARCHAR(16) NOT NULL DEFAULT '#F8FAFC',
    theme_mode VARCHAR(16) NOT NULL DEFAULT 'DARK', -- 'DARK', 'LIGHT', 'AUTO'
    tv_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
    participant_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
    controller_theme VARCHAR(16) NOT NULL DEFAULT 'DARK',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_establishment_branding_est ON establishment_branding(establishment_id);

-- 2. Dispositivos e Clientes
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
    device_type VARCHAR(32) NOT NULL, -- 'PARTICIPANT_DEVICE', 'CONTROLLER_DEVICE', 'SUPERVISOR_DEVICE', 'TV_DEVICE'
    platform VARCHAR(32) NOT NULL, -- 'PWA', 'ANDROID', 'ANDROID_TV'
    client_version VARCHAR(32) NOT NULL,
    last_ip VARCHAR(64),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Usuários Operacionais
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(32) NOT NULL, -- 'PARTICIPANT', 'CONTROLLER', 'SUPERVISOR', 'SYSTEM_ADMIN'
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sessões
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'ACTIVE', 'PAUSED', 'ENDED', 'EXPIRED'
    started_at TIMESTAMP WITH TIME ZONE,
    scheduled_end_time TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    active_controller_id VARCHAR(64),
    supervisor_id VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- 5. Códigos de Presença (4 dígitos, expiração em 60s)
CREATE TABLE IF NOT EXISTS presence_codes (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    controller_id VARCHAR(64),
    code VARCHAR(4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_presence_codes_session ON presence_codes(session_id, expires_at);

-- 6. Identidades Persistentes de Participantes (WhatsApp normalizado)
CREATE TABLE IF NOT EXISTS participant_identities (
    id VARCHAR(64) PRIMARY KEY,
    normalized_whatsapp VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    total_participations INTEGER NOT NULL DEFAULT 1,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_identities_wa ON participant_identities(normalized_whatsapp);

-- 7. Participantes da Sessão
CREATE TABLE IF NOT EXISTS participants (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    identity_id VARCHAR(64) REFERENCES participant_identities(id) ON DELETE SET NULL,
    display_name VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(32),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);

-- 8. Catálogo Musical e Versões
CREATE TABLE IF NOT EXISTS music (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    genre VARCHAR(64) NOT NULL,
    cover_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_music_search ON music(title, artist, genre);

CREATE TABLE IF NOT EXISTS music_versions (
    id VARCHAR(64) PRIMARY KEY,
    music_id VARCHAR(64) REFERENCES music(id) ON DELETE CASCADE,
    style VARCHAR(64) NOT NULL, -- 'karaoke', 'playback', 'acustico', 'original', 'instrumental', 'cover', 'live', 'Estilo não identificado'
    label VARCHAR(255) NOT NULL,
    youtube_video_id VARCHAR(64) NOT NULL,
    duration_sec INTEGER NOT NULL DEFAULT 180,
    quality VARCHAR(32) DEFAULT '1080p',
    audio_key VARCHAR(16)
);

CREATE INDEX IF NOT EXISTS idx_versions_music ON music_versions(music_id);

-- 9. Playlists Pessoais dos Participantes
CREATE TABLE IF NOT EXISTS playlist_items (
    id VARCHAR(64) PRIMARY KEY,
    participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE CASCADE,
    music_id VARCHAR(64) REFERENCES music(id) ON DELETE CASCADE,
    version_id VARCHAR(64) REFERENCES music_versions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'QUEUED', 'SUNG', 'CANCELLED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Fila da Sessão (Transacional e Determinística)
CREATE TABLE IF NOT EXISTS queue_items (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE CASCADE,
    partner_participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE SET NULL,
    partner_display_name VARCHAR(255),
    is_duet BOOLEAN NOT NULL DEFAULT FALSE,
    music_id VARCHAR(64) REFERENCES music(id) ON DELETE CASCADE,
    version_id VARCHAR(64) REFERENCES music_versions(id) ON DELETE CASCADE,
    tone_offset INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'CALLED', 'PLAYING', 'COMPLETED', 'CANCELLED', 'CANCELLED_SESSION_ENDED', 'ERROR'
    order_index INTEGER NOT NULL,
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    called_at TIMESTAMP WITH TIME ZONE,
    call_expires_at TIMESTAMP WITH TIME ZONE,
    missed_turn_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_session_status ON queue_items(session_id, status, order_index);

-- 10.1 Convites de Dueto (Apresentação Compartilhada)
CREATE TABLE IF NOT EXISTS duet_invitations (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    sender_participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE CASCADE,
    target_participant_id VARCHAR(64) REFERENCES participants(id) ON DELETE CASCADE,
    music_id VARCHAR(64) REFERENCES music(id) ON DELETE CASCADE,
    version_id VARCHAR(64) REFERENCES music_versions(id) ON DELETE CASCADE,
    tone_offset INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_duet_invitations ON duet_invitations(session_id, target_participant_id, status);

-- 11. Estados de Reprodução da TV
CREATE TABLE IF NOT EXISTS playback_states (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    current_queue_item_id VARCHAR(64) REFERENCES queue_items(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IDLE', -- 'IDLE', 'LOADING', 'PLAYING', 'PAUSED', 'ERROR', 'COMPLETED'
    current_time_sec INTEGER NOT NULL DEFAULT 0,
    volume INTEGER NOT NULL DEFAULT 100,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Atribuições de Controladores
CREATE TABLE IF NOT EXISTS controller_assignments (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    controller_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- 13. Leads e Consentimentos (Privacidade e LGPD)
CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_whatsapp VARCHAR(32) NOT NULL,
    establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
    first_participation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_participation TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    participations_count INTEGER NOT NULL DEFAULT 1,
    consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    consent_date TIMESTAMP WITH TIME ZONE,
    origin VARCHAR(32) NOT NULL DEFAULT 'PARTICIPANTE'
);

-- 14. Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
    actor_role VARCHAR(32) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(64) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_logs(session_id, created_at DESC);
