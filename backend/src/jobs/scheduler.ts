// scheduler.ts
// In-process scheduler for periodic jobs. Previously the purge jobs
// existed but nothing invoked them — they only ran if ops wired an
// external crontab. Now the server runs them on a fixed interval.

import { runAllRetentionPurges } from './dataRetention';
import { purgeExpiredRefreshTokens } from './purgeRefreshTokens';
import { expireTrials } from './expireTrials';
import logger from '../utils/logger';

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

let timer: ReturnType<typeof setInterval> | null = null;

export const startScheduler = (): void => {
  if (timer) return;
  timer = setInterval(async () => {
    await purgeExpiredRefreshTokens().catch((err) =>
      logger.error('Scheduled refresh-token purge failed', err)
    );
    await expireTrials().catch((err) =>
      logger.error('Scheduled trial expiry failed', err)
    );
    await runAllRetentionPurges();
  }, RUN_INTERVAL_MS);
  // Never keep the process alive just for the scheduler.
  timer.unref();
  logger.info('Background job scheduler started (daily interval)');
};

export const stopScheduler = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
