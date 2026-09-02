// seed.ts
// Seed development data for local testing and demo purposes.
// Usage: npm run db:seed
//
// Creates:
//   - 1 demo parent account
//   - 1 child profile linked to that parent
//   - 1 device registered for the child
//   - A few sample app block rules, scheduled locks, and contact rules
//
// This script is idempotent — it uses ON CONFLICT DO NOTHING so it can be
// re-run safely. Do NOT run in production.

import bcrypt from 'bcryptjs';
import { query } from '../config/database';
import pool from '../config/database';
import logger from '../utils/logger';

const DEMO_PARENT = {
  email: 'demo.parent@kavach.local',
  password: 'Demo1234!',
  name: 'Demo Parent',
  phone: '+919999999999',
};

const DEMO_CHILD = {
  name: 'Demo Child',
  age: 10,
};

const seed = async (): Promise<void> => {
  try {
    const passwordHash = await bcrypt.hash(DEMO_PARENT.password, 10);

    // 1. Demo parent (idempotent on email)
    const parentResult = await query(
      `INSERT INTO parents (email, password_hash, name, phone, email_verified, role)
       VALUES ($1, $2, $3, $4, true, 'parent')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [DEMO_PARENT.email, passwordHash, DEMO_PARENT.name, DEMO_PARENT.phone]
    );
    const parentId: string = parentResult.rows[0].id;
    logger.info(`Seeded parent: ${DEMO_PARENT.email} (id=${parentId})`);

    // 2. Demo child
    const childResult = await query(
      `INSERT INTO children (parent_id, name, age, device_model)
       VALUES ($1, $2, $3, 'Pixel 7')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [parentId, DEMO_CHILD.name, DEMO_CHILD.age]
    );
    const childId: string =
      childResult.rows[0]?.id ??
      (
        await query(`SELECT id FROM children WHERE parent_id = $1 LIMIT 1`, [
          parentId,
        ])
      ).rows[0]?.id;

    if (!childId) {
      throw new Error('Failed to seed or find child');
    }
    logger.info(`Seeded child: ${DEMO_CHILD.name} (id=${childId})`);

    // 3. Demo device
    await query(
      `INSERT INTO devices (child_id, device_id, name, platform, status)
       VALUES ($1, $2, 'Demo Device', 'android', 'active')
       ON CONFLICT (device_id) DO NOTHING`,
      [childId, 'demo-device-001']
    );
    logger.info('Seeded device: demo-device-001');

    // 4. A sample app block rule (idempotent)
    await query(
      `INSERT INTO app_block_rules (child_id, package_name, app_name, is_blocked)
       VALUES ($1, $2, $3, true)
       ON CONFLICT DO NOTHING`,
      [childId, 'com.example.blocked', 'Sample Blocked App']
    );

    // 5. A sample scheduled lock (idempotent)
    await query(
      `INSERT INTO scheduled_locks (child_id, day_of_week, start_time, end_time, is_active)
       VALUES ($1, 1, '21:00', '07:00', true)
       ON CONFLICT DO NOTHING`,
      [childId]
    );

    // 6. A sample contact rule (idempotent)
    await query(
      `INSERT INTO contact_rules (child_id, phone_number, contact_name, rule_type, is_active)
       VALUES ($1, '+911234567890', 'Demo Contact', 'block', true)
       ON CONFLICT DO NOTHING`,
      [childId]
    );

    logger.info('Seed complete. Demo credentials:');
    logger.info(`  Email:    ${DEMO_PARENT.email}`);
    logger.info(`  Password: ${DEMO_PARENT.password}`);
  } catch (err) {
    logger.error('Seed failed', err);
    throw err;
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seed;
