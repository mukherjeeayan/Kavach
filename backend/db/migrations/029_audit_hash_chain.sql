-- 029_audit_hash_chain.sql
-- Adds cryptographic SHA-256 hash chaining to audit_logs so parental
-- actions cannot be retroactively modified or repudiated.

-- Add hash chain columns
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS sequence_number BIGINT,
  ADD COLUMN IF NOT EXISTS previous_hash TEXT,
  ADD COLUMN IF NOT EXISTS current_hash TEXT;

-- Unique index on (family_scope, sequence_number) for efficient chain traversal.
-- We use actor_id as the scope since the existing schema doesn't have family_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_hash_chain
  ON audit_logs (actor_id, sequence_number)
  WHERE sequence_number IS NOT NULL;

-- Index for chain verification queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash_previous
  ON audit_logs (actor_id, previous_hash)
  WHERE previous_hash IS NOT NULL;
