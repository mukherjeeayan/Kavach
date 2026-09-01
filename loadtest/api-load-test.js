import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 10 },    // Stay at 10 users
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 20 },    // Stay at 20 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    errors: ['rate<0.1'],               // Error rate under 10%
  },
};

function getRandomEmail() {
  return `test${Date.now()}${Math.random().toString(36).slice(2)}@example.com`;
}

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
  });
  errorRate.add(healthRes.status !== 200);
  sleep(1);

  // Test 2: Register a new user
  const email = getRandomEmail();
  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, JSON.stringify({
    email,
    password: 'TestPassword123!',
    name: 'Load Test User',
    child_name: 'Test Child',
    child_age: 10,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(registerRes, {
    'register status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'register returns token': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.data?.token !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(registerRes.status !== 200 && registerRes.status !== 201);

  let token = '';
  try {
    const body = JSON.parse(registerRes.body as string);
    token = body.data?.token || '';
  } catch {
    // Registration failed, skip authenticated tests
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Test 3: Get user profile
  const profileRes = http.get(`${BASE_URL}/api/v1/auth/me`, { headers: authHeaders });
  check(profileRes, {
    'profile status 200': (r) => r.status === 200,
  });
  errorRate.add(profileRes.status !== 200);
  sleep(0.5);

  // Test 4: Get children
  const childrenRes = http.get(`${BASE_URL}/api/v1/children`, { headers: authHeaders });
  check(childrenRes, {
    'children status 200': (r) => r.status === 200,
  });
  errorRate.add(childrenRes.status !== 200);
  sleep(0.5);

  // Test 5: Get alerts
  const alertsRes = http.get(`${BASE_URL}/api/v1/alerts`, { headers: authHeaders });
  check(alertsRes, {
    'alerts status 200': (r) => r.status === 200,
  });
  errorRate.add(alertsRes.status !== 200);
  sleep(0.5);

  // Test 6: Get notifications
  const notifRes = http.get(`${BASE_URL}/api/v1/notifications`, { headers: authHeaders });
  check(notifRes, {
    'notifications status 200': (r) => r.status === 200,
  });
  errorRate.add(notifRes.status !== 200);
  sleep(1);
}

export function handleSummary(data) {
  return {
    'loadtest/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  const lines = [];
  lines.push('');
  lines.push('====================');
  lines.push('  LOAD TEST RESULTS');
  lines.push('====================');
  lines.push(`  Total requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  lines.push(`  Failed requests: ${data.metrics.http_req_failed?.values?.rate || 0}`);
  lines.push(`  Avg response time: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms`);
  lines.push(`  P95 response time: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms`);
  lines.push(`  Max response time: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms`);
  lines.push(`  Error rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%`);
  lines.push('');
  return lines.join('\n');
}
