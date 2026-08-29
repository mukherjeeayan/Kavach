-- 019_integration_sync_status.sql
-- Adds sync_status / sync_error tracking columns to integrations
-- so the sync pipeline can report per-integration health.

ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20)
        CHECK (sync_status IN ('success', 'error', 'pending')),
    ADD COLUMN IF NOT EXISTS sync_error TEXT;
