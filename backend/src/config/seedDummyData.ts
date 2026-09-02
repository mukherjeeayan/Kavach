import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from './database';
import logger from '../utils/logger';

export async function seedComprehensiveDummyData(): Promise<void> {
  try {
    logger.info('Starting comprehensive dummy data population for Kavach Parental Platform...');

    const defaultPassword = 'Demo1234!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const pinHash = await bcrypt.hash('1234', 10);

    // 1. Seed Parent User (Aarav Sharma)
    const parentRes = await query(
      `INSERT INTO parents (email, password_hash, name, email_verified, role, subscription_tier, parental_pin_hash, created_at, updated_at)
       VALUES ($1, $2, $3, true, 'parent', 'PREMIUM', $4, NOW() - INTERVAL '30 days', NOW())
       ON CONFLICT (email) DO UPDATE SET 
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         subscription_tier = EXCLUDED.subscription_tier,
         parental_pin_hash = EXCLUDED.parental_pin_hash,
         email_verified = true
       RETURNING id`,
      ['demo.parent@kavach.local', passwordHash, 'Aarav Sharma', pinHash]
    );
    const parentId = parentRes.rows[0]?.id;
    if (!parentId) {
      logger.warn('Failed to obtain parentId for demo parent');
      return;
    }

    // 2. Seed Admin User (admin@kavach.local)
    const adminPasswordHash = await bcrypt.hash('Admin1234!', 10);
    await query(
      `INSERT INTO parents (email, password_hash, name, email_verified, role, subscription_tier, created_at, updated_at)
       VALUES ($1, $2, $3, true, 'admin', 'PREMIUM', NOW() - INTERVAL '60 days', NOW())
       ON CONFLICT (email) DO UPDATE SET 
         name = EXCLUDED.name,
         role = 'admin',
         subscription_tier = 'PREMIUM',
         email_verified = true
       RETURNING id`,
      ['admin@kavach.local', adminPasswordHash, 'System Administrator']
    ).catch(() => {});

    // 3. Seed Co-Guardian (Priya Sharma)
    const coGuardianRes = await query(
      `INSERT INTO parents (email, password_hash, name, email_verified, role, subscription_tier, created_at, updated_at)
       VALUES ($1, $2, $3, true, 'parent', 'PREMIUM', NOW() - INTERVAL '25 days', NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['priya.sharma@kavach.local', passwordHash, 'Priya Sharma']
    ).catch(() => ({ rows: [] }));
    const coGuardianId = coGuardianRes.rows[0]?.id;

    // 4. Seed User Settings for Parent
    await query(
      `INSERT INTO user_settings (
         user_id, notifications_enabled, email_digest_enabled, digest_frequency,
         screen_time_alerts, location_alerts, communication_alerts, sos_alerts,
         self_harm_alerts, dnd_enabled, push_device_type, created_at, updated_at
       ) VALUES ($1, true, true, 'WEEKLY', true, true, true, true, true, false, 'android', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET 
         notifications_enabled = true,
         screen_time_alerts = true,
         location_alerts = true`,
      [parentId]
    ).catch(() => {});

    // 5. Seed Children (Rohan and Ananya)
    // Child 1: Rohan Sharma (11 yrs)
    let rohanRes = await query(
      `SELECT id FROM children WHERE parent_id = $1 AND name = $2 LIMIT 1`,
      [parentId, 'Rohan Sharma']
    ).catch(() => ({ rows: [] }));

    let rohanId: string;
    if (rohanRes.rows.length === 0) {
      const insertRohan = await query(
        `INSERT INTO children (parent_id, name, birth_date, daily_screen_time_limit_minutes, phone, created_at, updated_at)
         VALUES ($1, 'Rohan Sharma', '2013-05-14', 120, '+919876543201', NOW() - INTERVAL '30 days', NOW())
         RETURNING id`,
        [parentId]
      );
      rohanId = insertRohan.rows[0]?.id;
    } else {
      rohanId = rohanRes.rows[0].id;
      await query(
        `UPDATE children SET daily_screen_time_limit_minutes = 120, phone = '+919876543201' WHERE id = $1`,
        [rohanId]
      ).catch(() => {});
    }

    // Child 2: Ananya Sharma (14 yrs)
    let ananyaRes = await query(
      `SELECT id FROM children WHERE parent_id = $1 AND name = $2 LIMIT 1`,
      [parentId, 'Ananya Sharma']
    ).catch(() => ({ rows: [] }));

    let ananyaId: string;
    if (ananyaRes.rows.length === 0) {
      const insertAnanya = await query(
        `INSERT INTO children (parent_id, name, birth_date, daily_screen_time_limit_minutes, phone, created_at, updated_at)
         VALUES ($1, 'Ananya Sharma', '2010-09-22', 180, '+919876543202', NOW() - INTERVAL '30 days', NOW())
         RETURNING id`,
        [parentId]
      );
      ananyaId = insertAnanya.rows[0]?.id;
    } else {
      ananyaId = ananyaRes.rows[0].id;
      await query(
        `UPDATE children SET daily_screen_time_limit_minutes = 180, phone = '+919876543202' WHERE id = $1`,
        [ananyaId]
      ).catch(() => {});
    }

    // Clean up generic "Demo Child" if it exists without device
    await query(`DELETE FROM children WHERE parent_id = $1 AND name = 'Demo Child'`, [parentId]).catch(() => {});

    // 6. Seed Co-Guardian links
    if (coGuardianId && rohanId && ananyaId) {
      await query(
        `INSERT INTO child_guardians (child_id, parent_id, role) VALUES ($1, $2, 'guardian') ON CONFLICT DO NOTHING`,
        [rohanId, coGuardianId]
      ).catch(() => {});
      await query(
        `INSERT INTO child_guardians (child_id, parent_id, role) VALUES ($1, $2, 'guardian') ON CONFLICT DO NOTHING`,
        [ananyaId, coGuardianId]
      ).catch(() => {});
    }

    // 7. Seed DPDP Consent Records
    for (const childId of [rohanId, ananyaId]) {
      if (!childId) continue;
      for (const consentType of ['location', 'app_usage', 'communications', 'mental_health']) {
        await query(
          `INSERT INTO parental_consent (parent_id, child_id, consent_type, granted_at, ip_address, created_at)
           VALUES ($1, $2, $3, NOW() - INTERVAL '30 days', '192.168.1.100', NOW() - INTERVAL '30 days')
           ON CONFLICT DO NOTHING`,
          [parentId, childId, consentType]
        ).catch(() => {});
      }
    }

    // 8. Seed Devices
    // Device 1: Rohan's Galaxy S21
    let rohanDev1Res = await query(
      `SELECT id FROM devices WHERE child_id = $1 AND device_name = $2 LIMIT 1`,
      [rohanId, "Rohan's Galaxy S21"]
    ).catch(() => ({ rows: [] }));
    let rohanDeviceId: string;
    if (rohanDev1Res.rows.length === 0) {
      const devInsert = await query(
        `INSERT INTO devices (child_id, device_name, device_type, os_version, fcm_token, last_active, created_at)
         VALUES ($1, $2, 'android', 'Android 14 (OneUI 6.0)', 'fcm_rohan_s21_demo_token', NOW(), NOW() - INTERVAL '30 days')
         RETURNING id`,
        [rohanId, "Rohan's Galaxy S21"]
      );
      rohanDeviceId = devInsert.rows[0]?.id;
    } else {
      rohanDeviceId = rohanDev1Res.rows[0].id;
    }

    // Device 2: Rohan's Study Tab
    let rohanTabRes = await query(
      `SELECT id FROM devices WHERE child_id = $1 AND device_name = $2 LIMIT 1`,
      [rohanId, "Rohan's Study Tablet"]
    ).catch(() => ({ rows: [] }));
    let rohanTabId: string;
    if (rohanTabRes.rows.length === 0) {
      const devInsert = await query(
        `INSERT INTO devices (child_id, device_name, device_type, os_version, fcm_token, last_active, created_at)
         VALUES ($1, $2, 'android', 'Android 13', 'fcm_rohan_tab_demo_token', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '20 days')
         RETURNING id`,
        [rohanId, "Rohan's Study Tablet"]
      );
      rohanTabId = devInsert.rows[0]?.id;
    } else {
      rohanTabId = rohanTabRes.rows[0].id;
    }

    // Device 3: Ananya's Pixel 8
    let ananyaDevRes = await query(
      `SELECT id FROM devices WHERE child_id = $1 AND device_name = $2 LIMIT 1`,
      [ananyaId, "Ananya's Pixel 8"]
    ).catch(() => ({ rows: [] }));
    let ananyaDeviceId: string;
    if (ananyaDevRes.rows.length === 0) {
      const devInsert = await query(
        `INSERT INTO devices (child_id, device_name, device_type, os_version, fcm_token, last_active, created_at)
         VALUES ($1, $2, 'android', 'Android 14', 'fcm_ananya_p8_demo_token', NOW(), NOW() - INTERVAL '30 days')
         RETURNING id`,
        [ananyaId, "Ananya's Pixel 8"]
      );
      ananyaDeviceId = devInsert.rows[0]?.id;
    } else {
      ananyaDeviceId = ananyaDevRes.rows[0].id;
    }

    // Clean up generic "Demo Android Device" if it exists
    await query(`DELETE FROM devices WHERE device_name = 'Demo Android Device'`).catch(() => {});

    // 9. Seed Device Health Logs (Telemetry snapshots)
    if (rohanDeviceId) {
      await query(
        `INSERT INTO device_health_logs (
           device_id, battery_level, is_charging, storage_total_mb, storage_free_mb,
           is_rooted, is_developer_options, is_usb_debugging, os_version, app_version, recorded_at, created_at
         ) VALUES ($1, 78, false, 128000, 45200, false, false, false, 'Android 14', 'v2.4.1', NOW(), NOW())`,
        [rohanDeviceId]
      ).catch(() => {});
    }

    if (ananyaDeviceId) {
      await query(
        `INSERT INTO device_health_logs (
           device_id, battery_level, is_charging, storage_total_mb, storage_free_mb,
           is_rooted, is_developer_options, is_usb_debugging, os_version, app_version, recorded_at, created_at
         ) VALUES ($1, 64, true, 256000, 142000, false, false, false, 'Android 14', 'v2.4.1', NOW(), NOW())`,
        [ananyaDeviceId]
      ).catch(() => {});
    }

    // 10. Seed App Block Rules
    const rohanAppRules = [
      { pkg: 'com.zhiliaoapp.musically', name: 'TikTok', blocked: true, reason: 'Restricted by school policy and parental guideline', unblockReq: false, unblockReason: null, limit: null },
      { pkg: 'com.riotgames.league.wildrift', name: 'Wild Rift', blocked: true, reason: 'Exam revision week', unblockReq: true, unblockReason: 'Finished all math and science homework! Can I play 1 match?', limit: 45 },
      { pkg: 'com.roblox.client', name: 'Roblox', blocked: false, reason: null, unblockReq: false, unblockReason: null, limit: 60 },
      { pkg: 'com.google.android.youtube', name: 'YouTube', blocked: false, reason: null, unblockReq: false, unblockReason: null, limit: 90 },
      { pkg: 'com.instagram.android', name: 'Instagram', blocked: true, reason: 'Age requirement minimum 13+', unblockReq: false, unblockReason: null, limit: null },
      { pkg: 'org.khanacademy.android', name: 'Khan Academy', blocked: false, reason: null, unblockReq: false, unblockReason: null, limit: 0 },
      { pkg: 'com.duolingo', name: 'Duolingo', blocked: false, reason: null, unblockReq: false, unblockReason: null, limit: 0 },
      { pkg: 'com.whatsapp', name: 'WhatsApp', blocked: false, reason: null, unblockReq: false, unblockReason: null, limit: 45 },
    ];

    for (const rule of rohanAppRules) {
      if (!rohanDeviceId) break;
      await query(
        `INSERT INTO app_block_rules (device_id, package_name, app_name, is_blocked, block_reason, unblock_requested, unblock_reason, daily_limit_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - INTERVAL '15 days', NOW())
         ON CONFLICT (device_id, package_name) DO UPDATE SET
           is_blocked = EXCLUDED.is_blocked,
           block_reason = EXCLUDED.block_reason,
           unblock_requested = EXCLUDED.unblock_requested,
           unblock_reason = EXCLUDED.unblock_reason,
           daily_limit_minutes = EXCLUDED.daily_limit_minutes`,
        [rohanDeviceId, rule.pkg, rule.name, rule.blocked, rule.reason, rule.unblockReq, rule.unblockReason, rule.limit]
      ).catch(() => {});
    }

    const ananyaAppRules = [
      { pkg: 'com.snapchat.android', name: 'Snapchat', blocked: true, reason: 'Bedtime safety rule', limit: 30 },
      { pkg: 'com.instagram.android', name: 'Instagram', blocked: false, reason: null, limit: 60 },
      { pkg: 'com.spotify.music', name: 'Spotify Music', blocked: false, reason: null, limit: 120 },
      { pkg: 'com.pinterest', name: 'Pinterest', blocked: false, reason: null, limit: 45 },
      { pkg: 'com.discord', name: 'Discord', blocked: false, reason: null, limit: 45 },
      { pkg: 'com.google.android.youtube', name: 'YouTube', blocked: false, reason: null, limit: 90 },
      { pkg: 'org.khanacademy.android', name: 'Khan Academy', blocked: false, reason: null, limit: 0 },
    ];

    for (const rule of ananyaAppRules) {
      if (!ananyaDeviceId) break;
      await query(
        `INSERT INTO app_block_rules (device_id, package_name, app_name, is_blocked, block_reason, daily_limit_minutes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '15 days', NOW())
         ON CONFLICT (device_id, package_name) DO UPDATE SET
           is_blocked = EXCLUDED.is_blocked,
           daily_limit_minutes = EXCLUDED.daily_limit_minutes`,
        [ananyaDeviceId, rule.pkg, rule.name, rule.blocked, rule.reason, rule.limit]
      ).catch(() => {});
    }

    // 11. Seed Screen Time Logs (Past 7 Days of realistic usage in seconds)
    const appsList = [
      { pkg: 'org.khanacademy.android', cat: 'Education', secMin: 1200, secMax: 3600 },
      { pkg: 'com.duolingo', cat: 'Education', secMin: 600, secMax: 1800 },
      { pkg: 'com.google.android.youtube', cat: 'Entertainment', secMin: 1800, secMax: 4200 },
      { pkg: 'com.roblox.client', cat: 'Games', secMin: 900, secMax: 3000 },
      { pkg: 'com.whatsapp', cat: 'Communication', secMin: 600, secMax: 1800 },
      { pkg: 'com.spotify.music', cat: 'Music', secMin: 1200, secMax: 3600 },
    ];

    for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
      const dateStr = new Date(Date.now() - dayOffset * 86400000).toISOString().split('T')[0];
      
      if (rohanDeviceId) {
        for (const app of appsList) {
          const randomSeconds = Math.floor(Math.random() * (app.secMax - app.secMin + 1)) + app.secMin;
          await query(
            `INSERT INTO screen_time_logs (device_id, app_package, app_category, seconds, date_recorded, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (device_id, app_package, date_recorded) DO UPDATE SET seconds = EXCLUDED.seconds`,
            [rohanDeviceId, app.pkg, app.cat, randomSeconds, dateStr]
          ).catch(() => {});
        }
      }

      if (ananyaDeviceId) {
        for (const app of appsList) {
          const randomSeconds = Math.floor(Math.random() * (app.secMax - app.secMin + 1)) + app.secMin;
          await query(
            `INSERT INTO screen_time_logs (device_id, app_package, app_category, seconds, date_recorded, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (device_id, app_package, date_recorded) DO UPDATE SET seconds = EXCLUDED.seconds`,
            [ananyaDeviceId, app.pkg, app.cat, randomSeconds, dateStr]
          ).catch(() => {});
        }
      }
    }

    // 12. Seed Geofences
    if (rohanId) {
      await query(
        `INSERT INTO geofences (child_id, device_id, name, latitude, longitude, radius_meters, alert_on_entry, alert_on_exit, is_active, zone_type, created_at, updated_at)
         VALUES 
           ($1, $2, 'Home Safe Zone', 12.97160000, 77.59460000, 300, true, true, true, 'HOME', NOW() - INTERVAL '20 days', NOW()),
           ($1, $2, 'St. Xavier High School', 12.98500000, 77.60500000, 450, true, true, true, 'SCHOOL', NOW() - INTERVAL '20 days', NOW()),
           ($1, $2, 'National Sports Arena', 12.96200000, 77.58500000, 350, true, true, true, 'ACTIVITY', NOW() - INTERVAL '15 days', NOW())
         ON CONFLICT DO NOTHING`,
        [rohanId, rohanDeviceId]
      ).catch(() => {});
    }

    if (ananyaId) {
      await query(
        `INSERT INTO geofences (child_id, device_id, name, latitude, longitude, radius_meters, alert_on_entry, alert_on_exit, is_active, zone_type, created_at, updated_at)
         VALUES 
           ($1, $2, 'Home Safe Zone', 12.97160000, 77.59460000, 300, true, true, true, 'HOME', NOW() - INTERVAL '20 days', NOW()),
           ($1, $2, 'Delhi Public School Campus', 12.98200000, 77.61500000, 400, true, true, true, 'SCHOOL', NOW() - INTERVAL '20 days', NOW())
         ON CONFLICT DO NOTHING`,
        [ananyaId, ananyaDeviceId]
      ).catch(() => {});
    }

    // 13. Seed Location Logs (Recent GPS trace points)
    const rohanPoints = [
      { lat: 12.9716, lng: 77.5946, speed: 0, acc: 8.5, minsAgo: 5 },
      { lat: 12.9735, lng: 77.5960, speed: 18.5, acc: 10.0, minsAgo: 25 },
      { lat: 12.9780, lng: 77.6010, speed: 24.0, acc: 9.2, minsAgo: 45 },
      { lat: 12.9850, lng: 77.6050, speed: 0, acc: 5.0, minsAgo: 90 },
      { lat: 12.9780, lng: 77.6100, speed: 5.2, acc: 7.0, minsAgo: 180 },
      { lat: 12.9620, lng: 77.5850, speed: 0, acc: 6.4, minsAgo: 300 },
    ];

    if (rohanDeviceId) {
      for (const pt of rohanPoints) {
        await query(
          `INSERT INTO location_logs (device_id, latitude, longitude, accuracy_m, speed_kmh, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' minutes')::INTERVAL, NOW())`,
          [rohanDeviceId, pt.lat, pt.lng, pt.acc, pt.speed, pt.minsAgo.toString()]
        ).catch(() => {});
      }
    }

    if (ananyaDeviceId) {
      await query(
        `INSERT INTO location_logs (device_id, latitude, longitude, accuracy_m, speed_kmh, recorded_at, created_at)
         VALUES 
           ($1, 12.9716, 77.5946, 6.2, 0, NOW() - INTERVAL '10 minutes', NOW()),
           ($1, 12.9820, 77.6150, 5.0, 0, NOW() - INTERVAL '120 minutes', NOW())`,
        [ananyaDeviceId]
      ).catch(() => {});
    }

    // 14. Seed Scheduled Locks
    if (rohanId) {
      await query(
        `INSERT INTO scheduled_locks (child_id, device_id, day_of_week, start_time, end_time, is_active, created_at)
         VALUES 
           ($1, $2, 1, '08:30:00', '15:30:00', true, NOW() - INTERVAL '10 days'),
           ($1, $2, 2, '08:30:00', '15:30:00', true, NOW() - INTERVAL '10 days'),
           ($1, $2, 3, '08:30:00', '15:30:00', true, NOW() - INTERVAL '10 days'),
           ($1, $2, 4, '08:30:00', '15:30:00', true, NOW() - INTERVAL '10 days'),
           ($1, $2, 5, '08:30:00', '15:30:00', true, NOW() - INTERVAL '10 days'),
           ($1, $2, NULL, '21:30:00', '06:30:00', true, NOW() - INTERVAL '10 days')
         ON CONFLICT DO NOTHING`,
        [rohanId, rohanDeviceId]
      ).catch(() => {});
    }

    // 15. Seed Contact Rules
    if (rohanId) {
      const contacts = [
        { phone: '+919876543210', name: 'Dad (Aarav)', type: 'ALLOW' },
        { phone: '+919876543211', name: 'Mom (Priya)', type: 'ALLOW' },
        { phone: '+919876543212', name: 'Grandma Sunita', type: 'ALLOW' },
        { phone: '+919876543213', name: 'School Bus Coordinator', type: 'ALLOW' },
        { phone: '+918000998877', name: 'Unknown Loan Spammer', type: 'BLOCK' },
        { phone: '+919123456780', name: 'Unidentified Caller', type: 'BLOCK' },
      ];

      for (const c of contacts) {
        await query(
          `INSERT INTO contact_rules (child_id, device_id, phone_number, contact_name, rule_type, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW() - INTERVAL '15 days')
           ON CONFLICT (child_id, phone_number) DO UPDATE SET contact_name = EXCLUDED.contact_name, rule_type = EXCLUDED.rule_type`,
          [rohanId, rohanDeviceId, c.phone, c.name, c.type]
        ).catch(() => {});
      }
    }

    // 16. Seed Communication Logs
    if (rohanDeviceId) {
      await query(
        `INSERT INTO communication_logs (device_id, comm_type, contact_number, contact_name, content_snippet, duration_seconds, is_flagged, flag_reason, recorded_at, created_at)
         VALUES 
           ($1, 'CALL_IN', '+919876543210', 'Dad (Aarav)', NULL, 145, false, null, NOW() - INTERVAL '1 hour', NOW()),
           ($1, 'SMS_IN', '+919876543211', 'Mom (Priya)', 'Dont forget to drink water and pack your science project!', NULL, false, null, NOW() - INTERVAL '3 hours', NOW()),
           ($1, 'SMS_OUT', '+919876543211', 'Mom (Priya)', 'Done mom, boarding the bus now!', NULL, false, null, NOW() - INTERVAL '2 hours', NOW()),
           ($1, 'CALL_MISSED', '+918000998877', 'Unknown Loan Spammer', NULL, 0, false, null, NOW() - INTERVAL '5 hours', NOW()),
           ($1, 'SMS_IN', '+919999000111', 'Unknown Promo', 'You won a lottery of 50,000! Click here bit.ly/spam-win to claim now', NULL, true, 'Suspicious phishing URL pattern', NOW() - INTERVAL '6 hours', NOW())`,
        [rohanDeviceId]
      ).catch(() => {});
    }

    // 17. Seed Keyword Alerts
    if (rohanId && rohanDeviceId) {
      await query(
        `INSERT INTO keyword_alerts (
           device_id, child_id, source_type, detected_keywords, severity,
           content_snippet, app_package, is_reviewed, is_false_positive, created_at
         ) VALUES 
           ($1, $2, 'SMS', ARRAY['loser', 'hate you'], 'HIGH', 'Why are you acting like such a loser? Everyone hates you.', 'com.whatsapp', false, false, NOW() - INTERVAL '4 hours'),
           ($1, $2, 'APP_TEXT', ARRAY['idiot'], 'MEDIUM', 'Stop lagging you idiot get out of our team', 'com.roblox.client', true, false, NOW() - INTERVAL '1 day'),
           ($1, $2, 'CLIPBOARD', ARRAY['freak'], 'LOW', 'copied text: you weird freak', 'com.android.chrome', true, true, NOW() - INTERVAL '2 days')`,
        [rohanDeviceId, rohanId]
      ).catch(() => {});
    }

    // 18. Seed Self-Harm Alerts
    if (rohanId && rohanDeviceId) {
      await query(
        `INSERT INTO self_harm_alerts (
           child_id, device_id, source_type, detected_keywords, content_snippet,
           risk_level, is_acknowledged, acknowledged_at, acknowledged_by, created_at
         ) VALUES 
           ($1, $2, 'SEARCH', ARRAY['feel invisible', 'want to disappear'], 'Search query: how to deal with feeling completely alone and wanting to disappear', 'HIGH', true, NOW() - INTERVAL '1 hour', $3, NOW() - INTERVAL '2 hours')`,
        [rohanId, rohanDeviceId, parentId]
      ).catch(() => {});
    }

    // 19. Seed Daily Mood Logs (Last 7 Days)
    if (rohanId) {
      const rohanMoods = [
        { score: 5, note: 'Scored top marks in Robotics competition!', activities: ['robotics', 'homework', 'friends'], daysAgo: 0 },
        { score: 4, note: 'Had fun playing football after class', activities: ['sports', 'music'], daysAgo: 1 },
        { score: 3, note: 'Feeling a bit tired after science revision', activities: ['homework', 'reading'], daysAgo: 2 },
        { score: 5, note: 'Weekend family hike and pizza treat', activities: ['family', 'outdoors', 'food'], daysAgo: 3 },
        { score: 4, note: 'Built a cool Lego castle', activities: ['creativity', 'games'], daysAgo: 4 },
        { score: 4, note: 'Good productive day at school', activities: ['school', 'friends'], daysAgo: 5 },
        { score: 5, note: 'Cycle ride in the neighborhood park', activities: ['cycling', 'sports'], daysAgo: 6 },
      ];

      for (const m of rohanMoods) {
        await query(
          `INSERT INTO mood_logs (child_id, device_id, mood_score, note, activities, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' days')::INTERVAL, NOW() - ($6 || ' days')::INTERVAL)`,
          [rohanId, rohanDeviceId, m.score, m.note, m.activities, m.daysAgo.toString()]
        ).catch(() => {});
      }
    }

    if (ananyaId) {
      const ananyaMoods = [
        { score: 4, note: 'Finished art project presentation', activities: ['art', 'friends'], daysAgo: 0 },
        { score: 5, note: 'Dance practice went super well!', activities: ['dance', 'music'], daysAgo: 1 },
        { score: 4, note: 'Studied for history exam', activities: ['homework', 'reading'], daysAgo: 2 },
        { score: 5, note: 'Went to the library with classmates', activities: ['reading', 'friends'], daysAgo: 3 },
      ];

      for (const m of ananyaMoods) {
        await query(
          `INSERT INTO mood_logs (child_id, device_id, mood_score, note, activities, recorded_at, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' days')::INTERVAL, NOW() - ($6 || ' days')::INTERVAL)`,
          [ananyaId, ananyaDeviceId, m.score, m.note, m.activities, m.daysAgo.toString()]
        ).catch(() => {});
      }
    }

    // 20. Seed Rewards Catalog & Redemptions
    const rewardCatalogItems = [
      { name: '30 Mins Extra Gaming Time', desc: 'Enjoy 30 additional minutes of gaming during the weekend', cost: 100, icon: 'Gamepad' },
      { name: 'Choose Weekend Family Movie', desc: 'Pick the Friday night family movie with popcorn', cost: 150, icon: 'Film' },
      { name: 'New Graphic Novel / Story Book', desc: 'Order a new book or manga of your choice', cost: 250, icon: 'BookOpen' },
      { name: 'Visit to VR Gaming Arcade', desc: '2-hour weekend pass to the VR gaming arena', cost: 450, icon: 'Sparkles' },
      { name: 'Ice Cream Party with Friends', desc: 'Treat your school buddies to an ice cream parlor visit', cost: 500, icon: 'Gift' },
    ];

    const catalogIds: string[] = [];
    for (const item of rewardCatalogItems) {
      const catRes = await query(
        `INSERT INTO reward_catalog (parent_id, name, description, cost_points, icon, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW() - INTERVAL '20 days')
         RETURNING id`,
        [parentId, item.name, item.desc, item.cost, item.icon]
      ).catch(async () => {
        return await query(`SELECT id FROM reward_catalog WHERE parent_id = $1 AND name = $2 LIMIT 1`, [parentId, item.name]);
      });
      if (catRes.rows[0]?.id) {
        catalogIds.push(catRes.rows[0].id);
      }
    }

    // Seed Reward Points for Rohan (Total balance 350 pts)
    if (rohanId) {
      await query(
        `INSERT INTO reward_points (child_id, points, reason, source, created_at)
         VALUES 
           ($1, 100, 'Maintained 5-day continuous screen limit streak', 'STREAK', NOW() - INTERVAL '10 days'),
           ($1, 75, 'Scored A+ in Science and Math quizzes', 'ACADEMIC', NOW() - INTERVAL '7 days'),
           ($1, 50, 'Kept study desk and bedroom organized', 'CHORE', NOW() - INTERVAL '4 days'),
           ($1, 75, '7-day streak on Duolingo French', 'LEARNING', NOW() - INTERVAL '2 days'),
           ($1, 50, 'Helped prepare evening dinner', 'FAMILY', NOW() - INTERVAL '1 day')`,
        [rohanId]
      ).catch(() => {});

      // Seed 2 Redemptions
      if (catalogIds.length >= 2) {
        await query(
          `INSERT INTO reward_redemptions (child_id, reward_id, points_spent, status, parent_notes, redeemed_at, resolved_at)
           VALUES 
             ($1, $2, 100, 'APPROVED', 'Great work on science project this week!', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
             ($1, $3, 150, 'PENDING', 'Awaiting Friday night movie review', NOW() - INTERVAL '4 hours', NULL)`,
          [rohanId, catalogIds[0], catalogIds[1]]
        ).catch(() => {});
      }
    }

    // 21. Seed URL Filtering Rules
    if (rohanId) {
      const urlRules = [
        { pattern: '*.gambling.com', type: 'BLOCK', cat: 'Gambling' },
        { pattern: '*.adult-site.net', type: 'BLOCK', cat: 'Adult Content' },
        { pattern: '*.free-robux-scam.xyz', type: 'BLOCK', cat: 'Phishing & Scams' },
        { pattern: '*.khanacademy.org', type: 'ALLOW', cat: 'Education' },
        { pattern: '*.wikipedia.org', type: 'ALLOW', cat: 'Encyclopedia' },
        { pattern: '*.scratch.mit.edu', type: 'ALLOW', cat: 'Coding & Learning' },
      ];

      for (const r of urlRules) {
        await query(
          `INSERT INTO url_filter_rules (child_id, url_pattern, rule_type, category, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW() - INTERVAL '15 days', NOW())
           ON CONFLICT (child_id, url_pattern) DO UPDATE SET rule_type = EXCLUDED.rule_type`,
          [rohanId, r.pattern, r.type, r.cat]
        ).catch(() => {});
      }
    }

    // 22. Seed Notifications
    const dummyNotifications = [
      { title: 'Geofence Arrival', body: "Rohan safely entered 'St. Xavier High School'", type: 'GEOFENCE_ENTRY', read: true, ago: '8 hours' },
      { title: 'Daily Screen Time Warning', body: "Ananya has reached 80% of her daily 180 min screen time limit", type: 'SCREEN_TIME_WARNING', read: true, ago: '5 hours' },
      { title: 'Reward Redemption Requested', body: "Rohan requested to redeem 'Choose Weekend Family Movie'", type: 'REWARD_REQUEST', read: false, ago: '4 hours' },
      { title: 'Security Scan Verified', body: "Nightly integrity scan on Rohan's Galaxy S21 completed with 0 threats detected.", type: 'SECURITY_SCAN', read: false, ago: '2 hours' },
      { title: 'Weekly Wellness Report Ready', body: 'Your family wellness digest for the past 7 days is now available to view.', type: 'WEEKLY_REPORT', read: false, ago: '1 hour' },
    ];

    for (const notif of dummyNotifications) {
      await query(
        `INSERT INTO notifications (user_id, title, body, notification_type, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' ')::INTERVAL)`,
        [parentId, notif.title, notif.body, notif.type, notif.read, notif.ago]
      ).catch(() => {});
    }

    // 23. Seed Emergency SOS Event (Resolved demonstration event)
    if (rohanId && rohanDeviceId) {
      await query(
        `INSERT INTO emergency_sos_events (
           device_id, child_id, latitude, longitude, battery_level, trigger_method, status, acknowledged_at, resolved_at, notes, created_at, updated_at
         ) VALUES ($1, $2, 12.9850, 77.6050, 82, 'BUTTON', 'RESOLVED', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'Accidental keypress during sports practice - child confirmed all safe over voice call.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')`,
        [rohanDeviceId, rohanId]
      ).catch(() => {});
    }

    // 24. Seed Behavior Predictions (AI Insights)
    if (rohanId) {
      await query(
        `INSERT INTO behavior_predictions (child_id, prediction_type, confidence, risk_score, prediction_data, valid_from, valid_until, is_active, created_at)
         VALUES 
           ($1, 'SCREEN_TIME_TREND', 0.88, 35, '{"trend": "decreasing", "recommended_limit_mins": 120, "summary": "Healthy balance maintained between learning apps (Duolingo/Khan) and games."}', NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', true, NOW()),
           ($1, 'APP_USAGE_PATTERN', 0.94, 15, '{"primary_category": "Educational", "peak_hours": ["16:30-18:00"], "risk_level": "Low"}', NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', true, NOW())`,
        [rohanId]
      ).catch(() => {});
    }

    // 25. Seed Security Scans & WiFi Logs
    if (rohanDeviceId) {
      await query(
        `INSERT INTO security_scans (device_id, scan_type, result, threats_found, scanned_at)
         VALUES ($1, 'FULL', '{"root_check": "passed", "debug_bridge": "disabled", "malware_signatures": "clean", "integrity": "verified"}', 0, NOW() - INTERVAL '6 hours')`,
        [rohanDeviceId]
      ).catch(() => {});

      await query(
        `INSERT INTO wifi_logs (device_id, ssid, bssid, security_type, is_open, is_known, ip_address, recorded_at)
         VALUES 
           ($1, 'Home_Fiber_5G', 'aa:bb:cc:11:22:33', 'WPA3-Personal', false, true, '192.168.1.105', NOW() - INTERVAL '1 hour'),
           ($1, 'StXavier_Campus_Secure', 'aa:bb:cc:44:55:66', 'WPA2-Enterprise', false, true, '10.0.4.52', NOW() - INTERVAL '6 hours')`,
        [rohanDeviceId]
      ).catch(() => {});
    }

    // 26. Seed Voice Command Logs
    if (rohanId && rohanDeviceId) {
      await query(
        `INSERT INTO voice_commands (child_id, device_id, command_text, intent, was_executed, recorded_at)
         VALUES 
           ($1, $2, 'Call Dad', 'CALL_PARENT', true, NOW() - INTERVAL '1 day'),
           ($1, $2, 'Share my current location with Mom', 'SHARE_LOCATION', true, NOW() - INTERVAL '2 days'),
           ($1, $2, 'How much screen time do I have left today', 'CHECK_SCREEN_TIME', true, NOW() - INTERVAL '3 days')`,
        [rohanId, rohanDeviceId]
      ).catch(() => {});
    }

    // 27. Seed Audit Logs with Hash Chain
    const auditActions = [
      { action: 'DEVICE_REGISTERED', res: 'devices', details: { device_name: "Rohan's Galaxy S21", os: 'Android 14' }, minsAgo: 43200 },
      { action: 'GEOFENCE_CREATED', res: 'geofences', details: { name: 'Home Safe Zone', radius_meters: 300 }, minsAgo: 28800 },
      { action: 'GEOFENCE_CREATED', res: 'geofences', details: { name: 'St. Xavier High School', radius_meters: 450 }, minsAgo: 28700 },
      { action: 'SCREEN_TIME_LIMIT_UPDATED', res: 'children', details: { child_name: 'Rohan Sharma', limit_minutes: 120 }, minsAgo: 14400 },
      { action: 'APP_BLOCK_UPDATED', res: 'app_block_rules', details: { app_name: 'TikTok', package_name: 'com.zhiliaoapp.musically', is_blocked: true }, minsAgo: 7200 },
      { action: 'REWARD_APPROVED', res: 'reward_redemptions', details: { reward_name: '30 Mins Extra Gaming Time', points: 100 }, minsAgo: 2880 },
    ];

    let prevHash = 'GENESIS_HASH_00000000000000000000000000000000000000000000000000000000';
    let seq = 1;

    for (const act of auditActions) {
      const payload = `${seq}:${parentId}:${act.action}:${JSON.stringify(act.details)}:${prevHash}`;
      const currentHash = crypto.createHash('sha256').update(payload).digest('hex');

      await query(
        `INSERT INTO audit_logs (
           actor_id, target_child_id, action, resource_type, details, ip_address,
           sequence_number, previous_hash, current_hash, created_at
         ) VALUES ($1, $2, $3, $4, $5, '192.168.1.100', $6, $7, $8, NOW() - ($9 || ' minutes')::INTERVAL)`,
        [parentId, rohanId, act.action, act.res, JSON.stringify(act.details), seq, prevHash, currentHash, act.minsAgo.toString()]
      ).catch(() => {});

      prevHash = currentHash;
      seq++;
    }

    logger.info('✓ Comprehensive dummy data successfully populated for demo accounts (Aarav Sharma & System Admin)');
  } catch (seedErr: any) {
    logger.error('Error during dummy data population:', seedErr);
  }
}
