-- ====================================================================
-- 026_keyword_alert_false_positive.sql
-- UP MIGRATION
--
-- Adds an `is_false_positive` flag to keyword_alerts so the parent can
-- mark a flagged message as not actually concerning. Two side effects:
--   1. The dashboard can hide it from the unreviewed feed.
--   2. The matched keyword's severity can be demoted via the service
--      layer (no DDL change for severity — that already exists).
--
-- Without this column the dashboard could only acknowledge alerts
-- but never tell the system "this is fine, stop alarming me about it".
-- ====================================================================

ALTER TABLE keyword_alerts
    ADD COLUMN IF NOT EXISTS is_false_positive BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE keyword_alerts
    ADD COLUMN IF NOT EXISTS marked_false_positive_at TIMESTAMPTZ;

-- Backfill the existing index so unreviewed alerts (the default filter
-- used by the parent dashboard) still skip rows the parent has already
-- dismissed as a false positive.
DROP INDEX IF EXISTS idx_keyword_alerts_unreviewed;
CREATE INDEX IF NOT EXISTS idx_keyword_alerts_unreviewed
    ON keyword_alerts(child_id, is_reviewed)
    WHERE is_reviewed = FALSE AND is_false_positive = FALSE;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP INDEX IF EXISTS idx_keyword_alerts_unreviewed;
CREATE INDEX IF NOT EXISTS idx_keyword_alerts_unreviewed
    ON keyword_alerts(child_id, is_reviewed) WHERE is_reviewed = FALSE;
ALTER TABLE keyword_alerts DROP COLUMN IF EXISTS marked_false_positive_at;
ALTER TABLE keyword_alerts DROP COLUMN IF EXISTS is_false_positive;
*/