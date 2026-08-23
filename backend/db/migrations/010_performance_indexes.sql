-- 010_performance_indexes.sql
-- Add performance indexes for common query patterns

-- Composite index for location queries by device and timestamp
CREATE INDEX IF NOT EXISTS idx_location_logs_device_recorded 
  ON location_logs (device_id, recorded_at DESC);

-- Composite index for screen time queries by device and date
CREATE INDEX IF NOT EXISTS idx_screen_time_logs_device_date 
  ON screen_time_logs (device_id, date_recorded DESC);

-- Index for screen time daily uploads
CREATE INDEX IF NOT EXISTS idx_screen_time_uploads_device 
  ON screen_time_uploads (device_id, created_at DESC);

-- Index for refresh token cleanup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry 
  ON refresh_tokens (expires_at, revoked_at);

-- Index for audit log queries by child and action
CREATE INDEX IF NOT EXISTS idx_audit_logs_child_action 
  ON audit_logs (target_child_id, action, created_at DESC);

-- Index for parental consent lookups
CREATE INDEX IF NOT EXISTS idx_parental_consent_child_type 
  ON parental_consent (child_id, consent_type, revoked_at);
