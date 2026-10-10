-- Rollback 005_rls_fail_closed.sql
-- Restaura políticas permissivas anteriores (003) se estritamente necessário

DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_queue ON queue_items;
CREATE POLICY tenant_isolation_queue ON queue_items FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
CREATE POLICY tenant_isolation_leads ON leads FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_branding ON establishment_branding;
CREATE POLICY tenant_isolation_branding ON establishment_branding FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_maia_config ON maia_config;
CREATE POLICY tenant_isolation_maia_config ON maia_config FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_maia_credentials ON maia_credentials;
CREATE POLICY tenant_isolation_maia_credentials ON maia_credentials FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR establishment_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_maia_memories ON maia_memories;
CREATE POLICY tenant_isolation_maia_memories ON maia_memories FOR ALL
    USING (NULLIF(current_setting('app.current_establishment_id', true), '') IS NULL OR tenant_id = current_setting('app.current_establishment_id', true));

DROP POLICY IF EXISTS tenant_isolation_devices ON devices;
DROP POLICY IF EXISTS tenant_isolation_maia_usage ON maia_usage;
