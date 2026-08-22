const path = require('path');
process.env.DB_DRIVER = 'pg-mem';
process.env.RUN_E2E = '1';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.BCRYPT_SALT_ROUNDS = '4';

const { getPgMem } = require('../../src/config/pgmem');

const fs = require('fs');
const pool = getPgMem().pool;

const sqlSanitize = (sql) =>
  sql
    .replace(/^\s*CREATE\s+OR\s+REPLACE\s+FUNCTION[\s\S]*?\$\$\s*LANGUAGE\s+'?plpgsql'?\s*;/gim, '-- stripped')
    .replace(/^\s*CREATE\s+TRIGGER[\s\S]*?;/gim, '-- stripped trigger')
    .replace(/\bDECIMAL\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'DECIMAL')
    .replace(/DROP TABLE IF EXISTS (\w+) CASCADE;\s*CREATE TABLE IF NOT EXISTS \1[\s\S]*?\);\s*CREATE INDEX IF NOT EXISTS [\s\S]*?;/g, '-- stripped redundant')
    .replace(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)([\s\S]*?)\s*CHECK \(([\s\S]*?)\)/g, 'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2$3;\nALTER TABLE $1 ADD CONSTRAINT ck_$2 CHECK ($4)');

(async () => {
  const dir = path.resolve(__dirname, '../../db/migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(sqlSanitize(fs.readFileSync(path.join(dir, file), 'utf8')));
  }
  await pool.query('TRUNCATE parents CASCADE');

  const { default: app } = await import('../../src/app');
  const request = require('supertest');

  const EMAIL = 'probe-' + Date.now() + '@test.local';
  const PASSWORD = 'correct-horse-battery';

  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Probe', email: EMAIL, password: PASSWORD, child_name: 'Kid' });
  console.log('register:', reg.status, JSON.stringify(reg.body).slice(0, 200));
  const token = reg.body.data.token;
  const childId = reg.body.data.child.id;
  const auth = () => ({ Authorization: 'Bearer ' + token });

  const dev = await request(app)
    .post('/api/v1/devices/register')
    .set(auth())
    .send({ child_id: childId, device_name: 'Phone', device_type: 'android' });
  console.log('devices/register:', dev.status, JSON.stringify(dev.body).slice(0, 300));
  const deviceId = dev.body.data.device.device_id;

  const block = await request(app)
    .post(`/api/v1/children/${childId}/apps/block`)
    .set(auth())
    .send({ device_id: deviceId, package_name: 'com.example.game', app_name: 'Game' });
  console.log('block:', block.status, JSON.stringify(block.body).slice(0, 300));

  const up = await request(app)
    .post(`/api/v1/devices/${deviceId}/screen-time`)
    .set(auth())
    .send({ entries: [{ app_package: 'com.example.game', app_category: 'games', seconds: 5000 }] });
  console.log('screen-time:', up.status, JSON.stringify(up.body).slice(0, 300));

  const loc = await request(app)
    .post(`/api/v1/devices/${deviceId}/location`)
    .set(auth())
    .send({ latitude: 12.9716, longitude: 77.5946, accuracy_m: 5, speed_kmh: 0 });
  console.log('location:', loc.status, JSON.stringify(loc.body).slice(0, 300));

  const lock = await request(app)
    .post(`/api/v1/children/${childId}/locks`)
    .set(auth())
    .send({ device_id: deviceId, day_of_week: 0, start_time: '09:00', end_time: '17:00', is_active: true });
  console.log('locks:', lock.status, JSON.stringify(lock.body).slice(0, 300));

  const contact = await request(app)
    .post(`/api/v1/children/${childId}/contacts`)
    .set(auth())
    .send({ phone_number: '+919999999999', contact_name: 'School', rule_type: 'ALLOW' });
  console.log('contacts:', contact.status, JSON.stringify(contact.body).slice(0, 300));

  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });