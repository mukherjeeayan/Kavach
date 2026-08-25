-- ====================================================================
-- 012_phase3_features.sql
-- UP MIGRATION
--
-- Phase 3 (Wellness) feature tables:
--   - geofence_events       (entry/exit tracking)
--   - mood_logs             (daily mood tracking)
--   - self_harm_alerts      (critical self-harm detection)
--   - reward_points         (gamification)
--   - reward_redemptions    (reward catalog)
-- ====================================================================

-- Geofence entry/exit events (tracking state changes)
CREATE TABLE IF NOT EXISTS geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('ENTRY', 'EXIT')),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_device
    ON geofence_events(geofence_id, device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_events_child
    ON geofence_events(child_id, created_at DESC);

-- Mood tracking logs (child self-reports)
CREATE TABLE IF NOT EXISTS mood_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    mood_score SMALLINT NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    note VARCHAR(500),
    activities TEXT[],
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_child_time
    ON mood_logs(child_id, recorded_at DESC);

-- Self-harm alerts (critical, requires immediate attention)
CREATE TABLE IF NOT EXISTS self_harm_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('SMS', 'APP_TEXT', 'KEYBOARD', 'SEARCH')),
    detected_keywords TEXT[] NOT NULL,
    content_snippet VARCHAR(500),
    risk_level TEXT NOT NULL DEFAULT 'HIGH' CHECK (risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')),
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES parents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_self_harm_alerts_child
    ON self_harm_alerts(child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_harm_alerts_unack
    ON self_harm_alerts(child_id, is_acknowledged) WHERE is_acknowledged = FALSE;

-- Reward points (gamification for good behavior)
CREATE TABLE IF NOT EXISTS reward_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    points INTEGER NOT NULL DEFAULT 0,
    reason VARCHAR(255),
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_points_child
    ON reward_points(child_id, created_at DESC);

-- Reward catalog (items children can redeem)
CREATE TABLE IF NOT EXISTS reward_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    cost_points INTEGER NOT NULL CHECK (cost_points > 0),
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reward_catalog_parent
    ON reward_catalog(parent_id, is_active);

-- Reward redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES reward_catalog(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED')),
    parent_notes VARCHAR(500),
    redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_reward_redemptions_child
    ON reward_redemptions(child_id, redeemed_at DESC);

-- ====================================================================
-- Phase 4: Advanced features
-- ====================================================================

-- Behavior predictions (AI-generated risk assessments)
CREATE TABLE IF NOT EXISTS behavior_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('HIGH_RISK_TIME', 'SCREEN_TIME_TREND', 'APP_USAGE_PATTERN', 'SOCIAL_RISK')),
    confidence DECIMAL(3, 2) CHECK (confidence BETWEEN 0 AND 1),
    risk_score SMALLINT CHECK (risk_score BETWEEN 0 AND 100),
    prediction_data JSONB NOT NULL DEFAULT '{}',
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavior_predictions_child
    ON behavior_predictions(child_id, is_active, valid_until DESC);

-- Security scan results
CREATE TABLE IF NOT EXISTS security_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('ROOT', 'KEYLOGGER', 'WIFI', 'APP_INTEGRITY', 'FULL')),
    result JSONB NOT NULL DEFAULT '{}',
    threats_found SMALLINT DEFAULT 0,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_device
    ON security_scans(device_id, scanned_at DESC);

-- WiFi monitoring logs
CREATE TABLE IF NOT EXISTS wifi_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ssid VARCHAR(255),
    bssid VARCHAR(17),
    security_type VARCHAR(50),
    is_open BOOLEAN DEFAULT FALSE,
    is_known BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wifi_logs_device
    ON wifi_logs(device_id, recorded_at DESC);

-- Voice command logs
CREATE TABLE IF NOT EXISTS voice_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    command_text VARCHAR(500),
    intent VARCHAR(100),
    was_executed BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_commands_child
    ON voice_commands(child_id, recorded_at DESC);

-- Integration configs
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('SCHOOL_PORTAL', 'CALENDAR', 'HEALTH_APP', 'CUSTOM')),
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_parent
    ON integrations(parent_id, is_active);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS integrations CASCADE;
DROP TABLE IF EXISTS voice_commands CASCADE;
DROP TABLE IF EXISTS wifi_logs CASCADE;
DROP TABLE IF EXISTS security_scans CASCADE;
DROP TABLE IF EXISTS behavior_predictions CASCADE;
DROP TABLE IF EXISTS reward_redemptions CASCADE;
DROP TABLE IF EXISTS reward_catalog CASCADE;
DROP TABLE IF EXISTS reward_points CASCADE;
DROP TABLE IF EXISTS self_harm_alerts CASCADE;
DROP TABLE IF EXISTS mood_logs CASCADE;
DROP TABLE IF EXISTS geofence_events CASCADE;
*/
