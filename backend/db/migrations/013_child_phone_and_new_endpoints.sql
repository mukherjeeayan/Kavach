-- ====================================================================
-- 013_child_phone_and_new_endpoints.sql
-- UP MIGRATION
--
-- Add phone column to children table and update geofences to support
-- child_id with optional device_id and zone_type.
-- ====================================================================

-- Add phone number to children
ALTER TABLE children ADD COLUMN IF NOT EXISTS phone VARCHAR(32);

-- Update geofences table to support child_id and zone_type
-- (service code already expects these columns)
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS child_id UUID REFERENCES children(id) ON DELETE CASCADE;
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS zone_type VARCHAR(50) DEFAULT 'CUSTOM';

-- Make device_id optional in geofences (was NOT NULL in 001)
ALTER TABLE geofences ALTER COLUMN device_id DROP NOT NULL;

-- Index for geofences by child
CREATE INDEX IF NOT EXISTS idx_geofences_child_id ON geofences(child_id);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
ALTER TABLE geofences DROP COLUMN IF EXISTS zone_type;
ALTER TABLE geofences DROP COLUMN IF EXISTS child_id;
ALTER TABLE geofences ALTER COLUMN device_id SET NOT NULL;
DROP INDEX IF EXISTS idx_geofences_child_id;
ALTER TABLE children DROP COLUMN IF EXISTS phone;
*/
