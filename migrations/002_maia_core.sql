-- ==========================================================
-- VOZPLAY POSTGRESQL MIGRATION 002 - MAIA CORE INTELLIGENCE
-- Dominio: vozplay.ai.slz.br
-- Entidades de IA: Configurações, Credenciais Cifradas,
-- Quotas, Provedores, Fallback, Auditoria de IA e Memória Persistente.
-- ==========================================================

-- 18.1 Configuração Persistente da MaIA por Estabelecimento
CREATE TABLE IF NOT EXISTS maia_config (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) UNIQUE NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    active_provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
    cost_tier VARCHAR(32) NOT NULL DEFAULT 'BALANCEADO',
    models JSONB NOT NULL,
    voice JSONB NOT NULL,
    limits JSONB NOT NULL,
    announce_queue_calls BOOLEAN NOT NULL DEFAULT TRUE,
    announce_absences BOOLEAN NOT NULL DEFAULT TRUE,
    announce_duets BOOLEAN NOT NULL DEFAULT TRUE,
    tv_audio_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    fallback_chain JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maia_config_est ON maia_config(establishment_id);

-- 18.2 Credenciais e Projetos de IA (Cofre Cifrado AES-256-GCM)
CREATE TABLE IF NOT EXISTS maia_credentials (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    credential_type VARCHAR(32) NOT NULL,
    secret_reference TEXT NOT NULL,
    project_id VARCHAR(128),
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    allowed_tasks JSONB,
    allowed_models JSONB,
    priority INTEGER NOT NULL DEFAULT 1,
    masked_key VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_validated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_maia_cred_est ON maia_credentials(establishment_id, provider);

-- 18.3 Histórico de Uso e Métricas de Chamadas
CREATE TABLE IF NOT EXISTS maia_usage (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    task VARCHAR(32) NOT NULL,
    model VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    tokens_input INTEGER NOT NULL DEFAULT 0,
    tokens_output INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
    is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maia_usage_est_date ON maia_usage(establishment_id, date);

-- 18.4 Quotas e Semáforo de Capacidade
CREATE TABLE IF NOT EXISTS maia_quota (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    daily_usd_limit NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    monthly_usd_limit NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    max_rpm INTEGER NOT NULL DEFAULT 60,
    warning_threshold INTEGER NOT NULL DEFAULT 70,
    critical_threshold INTEGER NOT NULL DEFAULT 85,
    exhausted_threshold INTEGER NOT NULL DEFAULT 95,
    current_status VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maia_quota_est ON maia_quota(establishment_id, provider);

-- 18.5 Configurações de Provedores e Gateways
CREATE TABLE IF NOT EXISTS maia_provider_config (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    endpoint_url TEXT,
    timeout_ms INTEGER NOT NULL DEFAULT 10000,
    headers JSONB,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18.6 Política de Fallback Resiliente
CREATE TABLE IF NOT EXISTS maia_fallback_config (
    id VARCHAR(64) PRIMARY KEY,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    provider_chain JSONB NOT NULL,
    auto_recover BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18.7 Auditoria de Eventos de IA e Decisões
CREATE TABLE IF NOT EXISTS maia_ai_audit_events (
    id VARCHAR(64) PRIMARY KEY,
    actor VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    establishment_id VARCHAR(64) NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    model VARCHAR(64),
    reason TEXT,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maia_audit_est ON maia_ai_audit_events(establishment_id, timestamp DESC);

-- 18.8 Memória da MaIA (Camada Persistente Postgres)
CREATE TABLE IF NOT EXISTS maia_memories (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    scope VARCHAR(32) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE,
    user_id VARCHAR(64),
    session_id VARCHAR(64),
    content JSONB NOT NULL,
    summary TEXT,
    source VARCHAR(32) NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 1.00,
    importance INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    previous_version_id VARCHAR(64),
    updated_by VARCHAR(64),
    metadata JSONB,
    tags TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_maia_memories_tenant ON maia_memories(tenant_id, type, scope);
CREATE INDEX IF NOT EXISTS idx_maia_memories_session ON maia_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_maia_memories_user ON maia_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_maia_memories_expires ON maia_memories(expires_at);

-- ==========================================================
-- SEED INICIAL DE SEGURANÇA E ESTABELECIMENTO PADRÃO
-- ==========================================================
INSERT INTO establishments (id, name, domain, unit_code, active)
VALUES ('est-slz-lounge', 'VozPlay Lounge São Luís', 'vozplay.ai.slz.br', 'SLZ01', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO establishment_branding (
    id, establishment_id, business_name, slogan,
    primary_color, secondary_color, accent_color, background_color, surface_color, text_color,
    theme_mode, tv_theme, participant_theme, controller_theme
)
VALUES (
    'brand-est-slz', 'est-slz-lounge', 'VozPlay Lounge São Luís', 'O palco do seu melhor momento',
    '#7C3AED', '#EC4899', '#F59E0B', '#060811', '#0E1322', '#F8FAFC',
    'DARK', 'DARK', 'DARK', 'DARK'
)
ON CONFLICT (establishment_id) DO NOTHING;
