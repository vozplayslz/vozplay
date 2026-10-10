-- ==========================================================
-- VOZPLAY POSTGRESQL MIGRATION 003 - MULTI-TENANT ISOLATION & RLS
-- Dominio: vozplay.ai.slz.br
-- Implementa Row Level Security (RLS) e índices para isolamento
-- estrito multi-tenant (Fase 4 do Lote P0).
-- ==========================================================

-- 1. Coluna direta de establishment_id em queue_items para RLS atômico sem JOIN
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue_items' AND column_name = 'establishment_id'
    ) THEN
        ALTER TABLE queue_items ADD COLUMN establishment_id VARCHAR(64) REFERENCES establishments(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_queue_items_est ON queue_items(establishment_id);

-- 2. Função auxiliar para definir contexto de tenant na sessão do PostgreSQL
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id VARCHAR) 
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_establishment_id', tenant_id, true);
END;
$$ LANGUAGE plpgsql;

-- 3. Habilitação de Row Level Security (RLS) em tabelas multi-tenant
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_memories ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Isolamento por Tenant (RLS Policies)
-- Regra: Permite acesso irrestrito se 'app.current_establishment_id' for nulo/vazio (ex: bootstrap, migrations, admin master)
-- Caso definido, restringe estritamente as linhas ao tenant autenticado.

-- 4.1 Sessions
DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.2 Queue Items
DROP POLICY IF EXISTS tenant_isolation_queue ON queue_items;
CREATE POLICY tenant_isolation_queue ON queue_items
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
        OR establishment_id IS NULL
    );

-- 4.3 Leads
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.4 Users
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.5 Branding
DROP POLICY IF EXISTS tenant_isolation_branding ON establishment_branding;
CREATE POLICY tenant_isolation_branding ON establishment_branding
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.6 MaIA Config
DROP POLICY IF EXISTS tenant_isolation_maia_config ON maia_config;
CREATE POLICY tenant_isolation_maia_config ON maia_config
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.7 MaIA Credentials
DROP POLICY IF EXISTS tenant_isolation_maia_credentials ON maia_credentials;
CREATE POLICY tenant_isolation_maia_credentials ON maia_credentials
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 4.8 MaIA Memories
DROP POLICY IF EXISTS tenant_isolation_maia_memories ON maia_memories;
CREATE POLICY tenant_isolation_maia_memories ON maia_memories
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL
        OR tenant_id = current_setting('app.current_establishment_id', true)
    );
