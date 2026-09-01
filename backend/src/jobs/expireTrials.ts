// expireTrials.ts
// Background job: downgrades TRIAL users whose trial_expires_at has passed.
// Runs daily via the scheduler. Also runable directly: npx ts-node src/jobs/expireTrials.ts

import { query } from '../config/database';
import logger from '../utils/logger';

export const expireTrials = async (): Promise<number> => {
  const result = await query(
    `UPDATE parents
     SET subscription_tier = 'FREE',
         trial_expires_at = NULL,
         subscription_updated_at = now()
     WHERE subscription_tier = 'TRIAL'
       AND trial_expires_at IS NOT NULL
       AND trial_expires_at < now()`
  );
  const downgraded = (result as any).rowCount ?? 0;
  if (downgraded > 0) {
    logger.info(`[expireTrials] Downgraded ${downgraded} expired trial users to FREE`);
  }
  return downgraded;
};

// When run directly (not imported), execute once and exit.
if (require.main === module) {
  expireTrials()
    .then((n) => {
      logger.info(`Trial expiry complete: ${n} users downgraded`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Trial expiry job failed', err);
      process.exit(1);
    });
}
