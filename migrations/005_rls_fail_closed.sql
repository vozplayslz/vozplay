-- ==========================================================
-- VOZPLAY POSTGRESQL MIGRATION 005 - FAIL-CLOSED RLS & ISOLATION HARDENING
-- Dominio: vozplay.ai.slz.br
-- Transforma políticas RLS de fail-open para estritamente FAIL-CLOSED (Lote 1A).
-- Se o contexto estiver ausente, vazio ou não autorizado, NENHUMA linha é retornada.
-- Aplica FORCE ROW LEVEL SECURITY para impedir bypass por donos de tabela/roles padrão.
-- ==========================================================

-- 1. Funções de Gestão Segura de Contexto
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id VARCHAR) 
RETURNS void AS $$
BEGIN
    IF tenant_id IS NULL OR trim(tenant_id) = '' THEN
        PERFORM set_config('app.current_establishment_id', '', true);
    ELSE
        PERFORM set_config('app.current_establishment_id', trim(tenant_id), true);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION clear_tenant_context() 
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_establishment_id', '', false);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_tenant_id() 
RETURNS VARCHAR AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_establishment_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Habilitação e Imposição Rígida de RLS (FORCE ROW LEVEL SECURITY)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_items FORCE ROW LEVEL SECURITY;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE establishment_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment_branding FORCE ROW LEVEL SECURITY;

ALTER TABLE maia_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_config FORCE ROW LEVEL SECURITY;

ALTER TABLE maia_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_credentials FORCE ROW LEVEL SECURITY;

ALTER TABLE maia_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_memories FORCE ROW LEVEL SECURITY;

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;

ALTER TABLE maia_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE maia_usage FORCE ROW LEVEL SECURITY;

-- 3. Políticas Estritamente FAIL-CLOSED
-- Regra Inegociável: Sem contexto válido e não-vazio, NENHUM registro pode ser lido ou alterado.

-- 3.1 Sessions
DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.2 Queue Items
DROP POLICY IF EXISTS tenant_isolation_queue ON queue_items;
CREATE POLICY tenant_isolation_queue ON queue_items
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.3 Leads
DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.4 Users
DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.5 Establishment Branding
DROP POLICY IF EXISTS tenant_isolation_branding ON establishment_branding;
CREATE POLICY tenant_isolation_branding ON establishment_branding
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.6 MaIA Config
DROP POLICY IF EXISTS tenant_isolation_maia_config ON maia_config;
CREATE POLICY tenant_isolation_maia_config ON maia_config
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.7 MaIA Credentials
DROP POLICY IF EXISTS tenant_isolation_maia_credentials ON maia_credentials;
CREATE POLICY tenant_isolation_maia_credentials ON maia_credentials
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.8 MaIA Memories
DROP POLICY IF EXISTS tenant_isolation_maia_memories ON maia_memories;
CREATE POLICY tenant_isolation_maia_memories ON maia_memories
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND tenant_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND tenant_id = current_setting('app.current_establishment_id', true)
    );

-- 3.9 Devices
DROP POLICY IF EXISTS tenant_isolation_devices ON devices;
CREATE POLICY tenant_isolation_devices ON devices
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );

-- 3.10 MaIA Usage
DROP POLICY IF EXISTS tenant_isolation_maia_usage ON maia_usage;
CREATE POLICY tenant_isolation_maia_usage ON maia_usage
    FOR ALL
    USING (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    )
    WITH CHECK (
        NULLIF(current_setting('app.current_establishment_id', true), '') IS NOT NULL
        AND establishment_id = current_setting('app.current_establishment_id', true)
    );
