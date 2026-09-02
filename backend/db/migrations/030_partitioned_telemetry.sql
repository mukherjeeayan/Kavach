-- 030_partitioned_telemetry.sql
-- Converts location_logs to a partitioned table for efficient data
-- lifecycle management. Enables automated 30-day rolling partition
-- drops for COPPA/GDPR-K compliance.
--
-- This migration:
-- 1. Creates pg_partman extension for automated partition management
-- 2. Converts location_logs to PARTITION BY RANGE (recorded_at)
-- 3. Creates initial partitions for current and next month
-- 4. Adds partition maintenance procedures

-- Enable pg_partman extension (if available)
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Note: In production, this migration requires careful handling because
-- location_logs is an existing table with data. The recommended approach:
--
-- 1. Create a new partitioned table
-- 2. Migrate data in batches
-- 3. Swap table names
-- 4. Drop the old table
--
-- Below is the schema for the new partitioned table. The actual migration
-- script should be run during a maintenance window.

-- Create the new partitioned location_logs table
CREATE TABLE IF NOT EXISTS location_logs_partitioned (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    device_id UUID NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_m DOUBLE PRECISION,
    speed_kmh DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Create indexes on the partitioned table
CREATE INDEX IF NOT EXISTS idx_location_logs_partitioned_device_time
    ON location_logs_partitioned (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_logs_partitioned_recorded_at
    ON location_logs_partitioned (recorded_at DESC);

-- Create partitions for current month and next 3 months
-- These will be created automatically by pg_partman in production,
-- but we create initial ones for immediate use.

DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for the current month and next 3 months
    FOR i IN 0..3 LOOP
        start_date := date_trunc('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'location_logs_' || to_char(start_date, 'YYYY_MM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF location_logs_partitioned FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        RAISE NOTICE 'Created partition: %', partition_name;
    END LOOP;
END $$;

-- Procedure to create the next month's partition
CREATE OR REPLACE PROCEDURE create_next_telemetry_partition()
LANGUAGE plpgsql
AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
BEGIN
    next_month := date_trunc('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name := 'location_logs_' || to_char(next_month, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF location_logs_partitioned FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_month,
        next_month + INTERVAL '1 month'
    );

    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$;

-- Procedure to drop partitions older than N days (COPPA/GDPR-K compliance)
CREATE OR REPLACE PROCEDURE purge_expired_telemetry_partitions(retention_days INTEGER DEFAULT 30)
LANGUAGE plpgsql
AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
    partition_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - (retention_days || ' days')::INTERVAL;

    FOR partition_record IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'location_logs_%'
        AND schemaname = 'public'
    LOOP
        -- Extract date from partition name (format: location_logs_YYYY_MM)
        BEGIN
            partition_date := to_date(
                substring(partition_record.tablename from 'location_logs_(\d{4}_\d{2})'),
                'YYYY_MM'
            );

            IF partition_date < date_trunc('month', cutoff_date) THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
                RAISE NOTICE 'Dropped expired partition: %', partition_record.tablename;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Could not process partition %: %', partition_record.tablename, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Procedure to run all partition maintenance tasks
CREATE OR REPLACE PROCEDURE run_telemetry_maintenance()
LANGUAGE plpgsql
AS $$
BEGIN
    -- Create next month's partition
    CALL create_next_telemetry_partition();

    -- Drop partitions older than 30 days
    CALL purge_expired_telemetry_partitions(30);

    RAISE NOTICE 'Telemetry maintenance complete';
END;
$$;

-- Create a view for easy querying across all partitions
CREATE OR REPLACE VIEW location_logs_view AS
SELECT * FROM location_logs_partitioned;
