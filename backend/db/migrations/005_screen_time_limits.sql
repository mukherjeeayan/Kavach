-- ====================================================================
-- 005_screen_time_limits.sql
-- UP MIGRATION
--
-- Per-child daily screen-time limit (minutes). When a child's total
-- usage for the day crosses the limit, the backend records a
-- SCREEN_TIME_LIMIT_REACHED audit alert which the parent portal
-- surfaces. NULL = no limit enforced.
-- ====================================================================

ALTER TABLE children ADD COLUMN IF NOT EXISTS daily_screen_time_limit_minutes INTEGER
    CHECK (daily_screen_time_limit_minutes IS NULL OR daily_screen_time_limit_minutes >= 0);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
ALTER TABLE children DROP COLUMN IF EXISTS daily_screen_time_limit_minutes;
*/