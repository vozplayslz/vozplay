-- ==========================================================
-- VOZPLAY POSTGRESQL MIGRATION 004 - QUEUE CONCURRENCY INTEGRITY
-- Dominio: vozplay.ai.slz.br
-- Garante integridade transacional da máquina de estados da fila
-- e previne múltiplos cantores PLAYING/CALLED simultaneamente (Fase 6 e 9).
-- ==========================================================

-- 1. Índice parcial exclusivo: Garante no máximo 1 item PLAYING por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_playing_per_session 
ON queue_items (session_id) 
WHERE status = 'PLAYING';

-- 2. Índice parcial exclusivo: Garante no máximo 1 item CALLED por sessão
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_called_per_session 
ON queue_items (session_id) 
WHERE status = 'CALLED';

-- 3. Índice otimizado para operações concorrentes com FOR UPDATE
CREATE INDEX IF NOT EXISTS idx_queue_items_concurrency 
ON queue_items (session_id, status, order_index);
