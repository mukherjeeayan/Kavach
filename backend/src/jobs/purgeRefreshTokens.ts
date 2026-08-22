// purgeRefreshTokens.ts
// Deletes expired refresh tokens from the database.
// Run via: npx ts-node src/jobs/purgeRefreshTokens.ts
// Or schedule via cron: 0 2 * * * node -e "require('./src/jobs/purgeRefreshTokens')"

import { query } from '../config/database';
import logger from '../utils/logger';

export const purgeExpiredRefreshTokens = async (): Promise<number> => {
  const result = await query(
    `DELETE FROM refresh_tokens WHERE expires_at < now() OR revoked_at IS NOT NULL`
  );
  const deleted = (result as any).rowCount ?? 0;
  if (deleted > 0) {
    logger.info(`Purged ${deleted} expired refresh tokens`);
  }
  return deleted;
};

// When run directly (not imported), execute once and exit.
if (require.main === module) {
  purgeExpiredRefreshTokens()
    .then((n) => {
      logger.info(`Refresh token purge complete: ${n} deleted`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Refresh token purge failed', err);
      process.exit(1);
    });
}
