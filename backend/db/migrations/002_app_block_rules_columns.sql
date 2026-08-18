-- ====================================================================
-- 002: Add missing columns to `app_block_rules`
-- Fixes the mismatch between the migration and the repository/model
-- which queried unblock_requested / unblock_reason / block_reason
-- before they existed (caused "column does not exist" errors).
-- Idempotent: safe to run even if partially applied.
-- ====================================================================

ALTER TABLE app_block_rules
    ADD COLUMN IF NOT EXISTS block_reason VARCHAR(500),
    ADD COLUMN IF NOT EXISTS unblock_requested BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS unblock_reason VARCHAR(500);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
ALTER TABLE app_block_rules
    DROP COLUMN IF EXISTS block_reason,
    DROP COLUMN IF EXISTS unblock_requested,
    DROP COLUMN IF EXISTS unblock_reason;
*/
