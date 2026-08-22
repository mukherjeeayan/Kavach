-- ====================================================================
-- 006_device_admin_status.sql
-- UP MIGRATION
--
-- Whether the child's device has SafeGuard active as a device admin
-- (and is therefore protected against uninstall / launcher hiding).
-- The Android app reports this on enable/disable; the parent dashboard
-- surfaces it as the "protected" badge on each device.
-- ====================================================================

ALTER TABLE devices ADD COLUMN IF NOT EXISTS admin_active BOOLEAN NOT NULL DEFAULT false;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
ALTER TABLE devices DROP COLUMN IF EXISTS admin_active;
*/
