-- ====================================================================
-- UP MIGRATION
-- ====================================================================

-- 1. Alert acknowledgement: parents can mark alerts as seen/handled.
ALTER TABLE audit_logs
    ADD COLUMN acknowledged_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_audit_logs_unacknowledged
    ON audit_logs(target_child_id, created_at DESC)
    WHERE acknowledged_at IS NULL;

-- 2. Screen-time upload idempotency: the Android app retries uploads on
--    flaky connections; without dedupe a retried batch double-counts
--    seconds. The device generates one batch_id per upload.
CREATE TABLE screen_time_uploads (
    batch_id UUID PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    entries INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_screen_time_uploads_device_created
    ON screen_time_uploads(device_id, created_at DESC);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS screen_time_uploads;
DROP INDEX IF EXISTS idx_audit_logs_unacknowledged;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS acknowledged_at;
*/
