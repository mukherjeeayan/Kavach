-- ====================================================================
-- 004_phase1_features.sql
-- UP MIGRATION
--
-- Phase-1 (MVP) feature tables + parental PIN.
--
-- NOTE ON RECONCILIATION: 001 initially shipped older shapes for
-- screen_time_logs / scheduled_locks / location_logs / contact_rules
-- (package_name+duration_minutes, days_of_week, accuracy_meters, ...)
-- which did not match the services. 001 now carries the final shapes,
-- but databases that already applied the old 001 need this migration
-- to drop and recreate the four tables with the correct schema.
-- Applying this file more than once is harmless (DROP + CREATE IF
-- NOT EXISTS).
-- ====================================================================

-- Parental authentication (PIN)
ALTER TABLE parents ADD COLUMN IF NOT EXISTS parental_pin_hash VARCHAR(255);

-- Screen-time tracking (per-app usage in seconds)
DROP TABLE IF EXISTS screen_time_logs CASCADE;
CREATE TABLE IF NOT EXISTS screen_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    app_package VARCHAR(255) NOT NULL,
    app_category VARCHAR(50),
    seconds INTEGER NOT NULL DEFAULT 0,
    date_recorded DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (device_id, app_package, date_recorded)
);

CREATE INDEX IF NOT EXISTS idx_screen_time_device_date
    ON screen_time_logs(device_id, date_recorded);

-- Scheduled lock windows (day_of_week NULL = every day)
DROP TABLE IF EXISTS scheduled_locks CASCADE;
CREATE TABLE IF NOT EXISTS scheduled_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    day_of_week SMALLINT CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_locks_child
    ON scheduled_locks(child_id);

-- Location pings
DROP TABLE IF EXISTS location_logs CASCADE;
CREATE TABLE IF NOT EXISTS location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    accuracy_m DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_location_device_time
    ON location_logs(device_id, recorded_at);

-- Contact allow/block rules
DROP TABLE IF EXISTS contact_rules CASCADE;
CREATE TABLE IF NOT EXISTS contact_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    phone_number VARCHAR(32) NOT NULL,
    contact_name VARCHAR(255),
    rule_type TEXT NOT NULL DEFAULT 'BLOCK' CHECK (rule_type IN ('ALLOW', 'BLOCK')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (child_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_contact_rules_child
    ON contact_rules(child_id);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS contact_rules CASCADE;
DROP TABLE IF EXISTS location_logs CASCADE;
DROP TABLE IF EXISTS scheduled_locks CASCADE;
DROP TABLE IF EXISTS screen_time_logs CASCADE;
ALTER TABLE parents DROP COLUMN IF EXISTS parental_pin_hash;
*/