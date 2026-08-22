-- ====================================================================
-- UP MIGRATION
-- ====================================================================

-- 1. PIN brute-force protection on parents
ALTER TABLE parents
    ADD COLUMN failed_pin_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN pin_locked_until TIMESTAMP WITH TIME ZONE;

-- 2. Refresh token families so reuse detection can revoke an entire
--    session lineage when a rotated token is replayed.
ALTER TABLE refresh_tokens
    ADD COLUMN family_id UUID;

CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);

-- 3. One-time password-reset tokens (hash persisted server-side).
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_parent_id ON password_reset_tokens(parent_id);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS password_reset_tokens;
DROP INDEX IF EXISTS idx_refresh_tokens_family_id;
ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS family_id;
ALTER TABLE parents
    DROP COLUMN IF EXISTS failed_pin_attempts,
    DROP COLUMN IF EXISTS pin_locked_until;
*/
