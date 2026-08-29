-- Migration 018: Push tokens for parent devices
-- Stores FCM registration tokens for parent mobile clients so the
-- backend can deliver push notifications (SOS, geofence, content
-- alerts, etc.) without going through APNs/FCM topics.

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
