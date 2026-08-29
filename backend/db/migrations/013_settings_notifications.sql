-- ====================================================================
-- 013_settings_notifications.sql
-- UP MIGRATION
--
-- Settings and Notifications feature tables:
--   - user_settings         (notification preferences, DND, etc.)
--   - notifications         (in-app notifications for parents)
-- ====================================================================

-- User settings (notification preferences, DND schedule, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE UNIQUE,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_digest_enabled BOOLEAN DEFAULT FALSE,
    digest_frequency TEXT DEFAULT 'DAILY' CHECK (digest_frequency IN ('DAILY', 'WEEKLY')),
    screen_time_alerts BOOLEAN DEFAULT TRUE,
    location_alerts BOOLEAN DEFAULT TRUE,
    communication_alerts BOOLEAN DEFAULT TRUE,
    sos_alerts BOOLEAN DEFAULT TRUE,
    self_harm_alerts BOOLEAN DEFAULT TRUE,
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start_time TIME,
    dnd_end_time TIME,
    push_token VARCHAR(500),
    push_device_type VARCHAR(20) DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user
    ON user_settings(user_id);

-- Notifications (in-app notifications for parents)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
*/
