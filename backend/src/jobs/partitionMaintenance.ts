// partitionMaintenance.ts
// Automated partition lifecycle management for COPPA/GDPR-K compliance.
// Creates future partitions and drops expired ones (>30 days old).
// Runs daily via the scheduler (jobs/scheduler.ts).

import { query } from '../config/database';
import logger from '../utils/logger';

/**
 * Run all partition maintenance tasks:
 * 1. Create next month's partition (if not exists)
 * 2. Drop partitions older than retention period
 */
export const runPartitionMaintenance = async (): Promise<void> => {
  try {
    // Check if partitioned table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'location_logs_partitioned'
      ) AS exists`
    );

    if (!tableCheck.rows[0]?.exists) {
      logger.debug('Partitioned telemetry table not found, skipping maintenance');
      return;
    }

    // Run the maintenance procedure (creates next partition + drops old ones)
    await query(`CALL run_telemetry_maintenance()`);
    logger.info('Partition maintenance completed successfully');
  } catch (err: any) {
    // If pg_partman procedures don't exist, fall back to manual management
    if (err.code === '42704' || err.message?.includes('procedure')) {
      await runManualPartitionMaintenance();
    } else {
      throw err;
    }
  }
};

/**
 * Manual partition maintenance when pg_partman procedures are not available.
 * Creates partitions for the next 3 months and drops partitions older than 30 days.
 */
const runManualPartitionMaintenance = async (): Promise<void> => {
  // Create partitions for current month and next 3 months
  for (let i = 0; i < 4; i++) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() + i, 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const partitionName = `location_logs_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      await query(
        `CREATE TABLE IF NOT EXISTS ${partitionName}
         PARTITION OF location_logs_partitioned
         FOR VALUES FROM ($1) TO ($2)`,
        [startDate.toISOString(), endDate.toISOString()]
      );
    } catch (err: any) {
      // Partition already exists, skip
      if (!err.message?.includes('already exists')) {
        logger.warn(`Failed to create partition ${partitionName}: ${err.message}`);
      }
    }
  }

  // Drop partitions older than 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const partitions = await query(
    `SELECT tablename FROM pg_tables
     WHERE tablename LIKE 'location_logs_%'
     AND schemaname = 'public'`
  );

  for (const row of partitions.rows) {
    const tableName = row.tablename;
    const dateMatch = tableName.match(/location_logs_(\d{4})_(\d{2})$/);
    if (!dateMatch) continue;

    const partYear = parseInt(dateMatch[1], 10);
    const partMonth = parseInt(dateMatch[2], 10);
    const partDate = new Date(partYear, partMonth - 1, 1);

    if (partDate < cutoffDate) {
      try {
        await query(`DROP TABLE IF EXISTS ${tableName}`);
        logger.info(`Dropped expired partition: ${tableName}`);
      } catch (err: any) {
        logger.warn(`Failed to drop partition ${tableName}: ${err.message}`);
      }
    }
  }

  logger.info('Manual partition maintenance completed');
};

// When run directly (not imported), execute once and exit.
if (require.main === module) {
  runPartitionMaintenance()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
