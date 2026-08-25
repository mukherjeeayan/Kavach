-- ====================================================================
-- 011_phase2_features.sql
-- UP MIGRATION
--
-- Phase-2 (Advanced) feature tables:
--   - url_filter_rules     (website filtering)
--   - device_health_logs   (battery, storage, security telemetry)
--   - communication_logs   (SMS/call monitoring)
--   - emergency_sos_events (SOS alert triggers)
--   - analytics_reports    (pre-computed usage reports)
-- ====================================================================

-- Website filtering rules (URL block/allow per child)
CREATE TABLE IF NOT EXISTS url_filter_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    url_pattern VARCHAR(2048) NOT NULL,
    rule_type TEXT NOT NULL DEFAULT 'BLOCK' CHECK (rule_type IN ('ALLOW', 'BLOCK')),
    category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (child_id, url_pattern)
);

CREATE INDEX IF NOT EXISTS idx_url_filter_rules_child
    ON url_filter_rules(child_id);

CREATE TRIGGER update_url_filter_rules_modtime
    BEFORE UPDATE ON url_filter_rules
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Device health telemetry (battery, storage, security status)
CREATE TABLE IF NOT EXISTS device_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    battery_level SMALLINT CHECK (battery_level BETWEEN 0 AND 100),
    is_charging BOOLEAN,
    storage_total_mb INTEGER,
    storage_free_mb INTEGER,
    is_rooted BOOLEAN DEFAULT FALSE,
    is_developer_options BOOLEAN DEFAULT FALSE,
    is_usb_debugging BOOLEAN DEFAULT FALSE,
    os_version VARCHAR(50),
    app_version VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_health_device_time
    ON device_health_logs(device_id, recorded_at DESC);

-- Communication logs (SMS/Call monitoring)
CREATE TABLE IF NOT EXISTS communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    comm_type TEXT NOT NULL CHECK (comm_type IN ('SMS_IN', 'SMS_OUT', 'CALL_IN', 'CALL_OUT', 'CALL_MISSED')),
    contact_number VARCHAR(32),
    contact_name VARCHAR(255),
    content_snippet VARCHAR(500),
    duration_seconds INTEGER,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason VARCHAR(255),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_logs_device_time
    ON communication_logs(device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_logs_flagged
    ON communication_logs(device_id, is_flagged) WHERE is_flagged = TRUE;

CREATE TRIGGER update_communication_logs_modtime
    BEFORE UPDATE ON communication_logs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Emergency SOS events
CREATE TABLE IF NOT EXISTS emergency_sos_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    battery_level SMALLINT,
    trigger_method VARCHAR(50) NOT NULL DEFAULT 'BUTTON' CHECK (trigger_method IN ('BUTTON', 'WIDGET', 'VOICE', 'HARDWARE_KEY')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_events_child
    ON emergency_sos_events(child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sos_events_active
    ON emergency_sos_events(status) WHERE status = 'ACTIVE';

CREATE TRIGGER update_sos_events_modtime
    BEFORE UPDATE ON emergency_sos_events
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Cyberbullying / keyword detection alerts
CREATE TABLE IF NOT EXISTS keyword_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('SMS', 'NOTIFICATION', 'CLIPBOARD', 'APP_TEXT')),
    detected_keywords TEXT[] NOT NULL,
    severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    content_snippet VARCHAR(500),
    app_package VARCHAR(255),
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keyword_alerts_child
    ON keyword_alerts(child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keyword_alerts_unreviewed
    ON keyword_alerts(child_id, is_reviewed) WHERE is_reviewed = FALSE;

CREATE TRIGGER update_keyword_alerts_modtime
    BEFORE UPDATE ON keyword_alerts
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Keyword dictionary for cyberbullying / self-harm detection
CREATE TABLE IF NOT EXISTS keyword_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('CYBERBULLYING', 'SELF_HARM', 'PROFANITY', 'DRUGS', 'CUSTOM')),
    keyword VARCHAR(255) NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (category, keyword, language)
);

CREATE INDEX IF NOT EXISTS idx_keyword_dict_active
    ON keyword_dictionaries(category, is_active) WHERE is_active = TRUE;

-- Pre-computed analytics reports (weekly/monthly snapshots)
CREATE TABLE IF NOT EXISTS analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('WEEKLY', 'MONTHLY')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (child_id, report_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_analytics_reports_child
    ON analytics_reports(child_id, period_start DESC);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS analytics_reports CASCADE;
DROP TABLE IF EXISTS keyword_dictionaries CASCADE;
DROP TABLE IF EXISTS keyword_alerts CASCADE;
DROP TABLE IF EXISTS emergency_sos_events CASCADE;
DROP TABLE IF EXISTS communication_logs CASCADE;
DROP TABLE IF EXISTS device_health_logs CASCADE;
DROP TABLE IF EXISTS url_filter_rules CASCADE;
*/
