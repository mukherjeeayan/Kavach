-- ====================================================================
-- UP MIGRATION
-- ====================================================================

-- 1. Create Trigger Function for auto-updating `updated_at`
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Create `parents` table
CREATE TABLE parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TRIGGER update_parents_modtime
    BEFORE UPDATE ON parents
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 3. Create `children` table
CREATE TABLE children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    birth_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_children_parent_id ON children(parent_id);

CREATE TRIGGER update_children_modtime
    BEFORE UPDATE ON children
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 4. Create `parental_consent` table (DPDP Act requirement)
CREATE TABLE parental_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT chk_consent_type CHECK (consent_type IN ('location', 'app_usage', 'communications', 'mental_health'))
);

CREATE INDEX idx_parental_consent_child_id ON parental_consent(child_id);

CREATE TRIGGER update_parental_consent_modtime
    BEFORE UPDATE ON parental_consent
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 5. Create `devices` table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    os_version VARCHAR(50),
    fcm_token VARCHAR(255),
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT chk_device_type CHECK (device_type IN ('android', 'ios', 'web'))
);

CREATE INDEX idx_devices_child_id ON devices(child_id);

CREATE TRIGGER update_devices_modtime
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 6. Create `app_block_rules` table
CREATE TABLE app_block_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    app_name VARCHAR(255),
    is_blocked BOOLEAN DEFAULT false,
    block_reason VARCHAR(500),
    unblock_requested BOOLEAN DEFAULT false,
    unblock_reason VARCHAR(500),
    daily_limit_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (device_id, package_name)
);

CREATE INDEX idx_app_block_rules_device_id ON app_block_rules(device_id);

CREATE TRIGGER update_app_block_rules_modtime
    BEFORE UPDATE ON app_block_rules
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 7. Create `screen_time_logs` table
CREATE TABLE screen_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    package_name VARCHAR(255) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    log_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (device_id, package_name, log_date)
);

CREATE INDEX idx_screen_time_logs_device_date ON screen_time_logs(device_id, log_date);

CREATE TRIGGER update_screen_time_logs_modtime
    BEFORE UPDATE ON screen_time_logs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 8. Create `location_logs` table
CREATE TABLE location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy_meters DECIMAL(8, 2),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_location_logs_device_recorded ON location_logs(device_id, recorded_at DESC);

CREATE TRIGGER update_location_logs_modtime
    BEFORE UPDATE ON location_logs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 9. Create `geofences` table
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL,
    alert_on_entry BOOLEAN DEFAULT true,
    alert_on_exit BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_geofences_device_id ON geofences(device_id);

CREATE TRIGGER update_geofences_modtime
    BEFORE UPDATE ON geofences
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 10. Create `scheduled_locks` table
CREATE TABLE scheduled_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days_of_week VARCHAR(21) NOT NULL, -- e.g., '1,2,3,4,5'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_scheduled_locks_device_id ON scheduled_locks(device_id);

CREATE TRIGGER update_scheduled_locks_modtime
    BEFORE UPDATE ON scheduled_locks
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 11. Create `contact_rules` table
CREATE TABLE contact_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    phone_number VARCHAR(50) NOT NULL,
    contact_name VARCHAR(255),
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_contact_rules_device_id ON contact_rules(device_id);

CREATE TRIGGER update_contact_rules_modtime
    BEFORE UPDATE ON contact_rules
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 12. Create `audit_logs` table (Critical for security & compliance)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL, 
    target_child_id UUID REFERENCES children(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target_child ON audit_logs(target_child_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);


-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS contact_rules CASCADE;
DROP TABLE IF EXISTS scheduled_locks CASCADE;
DROP TABLE IF EXISTS geofences CASCADE;
DROP TABLE IF EXISTS location_logs CASCADE;
DROP TABLE IF EXISTS screen_time_logs CASCADE;
DROP TABLE IF EXISTS app_block_rules CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS parental_consent CASCADE;
DROP TABLE IF EXISTS children CASCADE;
DROP TABLE IF EXISTS parents CASCADE;

DROP FUNCTION IF EXISTS update_modified_column() CASCADE;
*/
