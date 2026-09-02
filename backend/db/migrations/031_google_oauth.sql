-- 031_google_oauth.sql
-- Adds Google OAuth support columns to parents table

ALTER TABLE parents ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
CREATE INDEX IF NOT EXISTS idx_parents_google_id ON parents(google_id);
