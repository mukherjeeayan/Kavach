-- 014_login_lockout.sql
-- Add login lockout columns to parents table for brute-force protection.

ALTER TABLE parents ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS login_locked_until TIMESTAMPTZ;

-- Index for checking lockout status
CREATE INDEX IF NOT EXISTS idx_parents_login_locked ON parents(login_locked_until) WHERE login_locked_until IS NOT NULL;
