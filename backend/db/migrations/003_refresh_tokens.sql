-- ====================================================================
-- 003_refresh_tokens.sql
-- UP MIGRATION
--
-- Refresh-token rotation: every issued refresh token is persisted
-- (as a SHA-256 hash, never the raw token) so that:
--   * refresh tokens can be revoked / detected on reuse,
--   * a leaked database cannot be replayed into valid sessions.
-- ====================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_parent_id ON refresh_tokens(parent_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Cleanup job: purge expired tokens daily (can be invoked via
-- `psql -f jobs/...` or wired to the app's scheduler later).
CREATE OR REPLACE FUNCTION purge_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < now()
       OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP FUNCTION IF EXISTS purge_expired_refresh_tokens() CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
*/