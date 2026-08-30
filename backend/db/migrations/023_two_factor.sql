-- ====================================================================
-- 023_two_factor.sql
-- Persist TOTP secrets for parents so 2FA actually works server-side.
-- Before this migration the twoFactorSecret was generated but never
-- stored: the controller still defaulted to `verifyTotpToken -> true`,
-- and even the legitimate 2FA challenge at login could not be verified.
--
-- This migration:
--   * adds two_factor_secret (base32, RFC 6238, 160 bits) on parents
--   * adds two_factor_enabled (defaults FALSE — opt-in enrollment)
--   * adds two_factor_recovery_codes (JSON array, set during enable)
-- ====================================================================

ALTER TABLE parents
    ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS two_factor_recovery_codes TEXT;

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
ALTER TABLE parents
    DROP COLUMN IF EXISTS two_factor_recovery_codes,
    DROP COLUMN IF EXISTS two_factor_enabled,
    DROP COLUMN IF EXISTS two_factor_secret;
*/