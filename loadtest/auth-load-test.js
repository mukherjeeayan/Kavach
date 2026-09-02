// auth-load-test.js
// Load test for authentication endpoints.
// Tests login, register, and token refresh under load.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const registerDuration = new Trend('register_duration');
const refreshDuration = new Trend('refresh_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.1'],
  },
};

function getRandomEmail() {
  return `loadtest${Date.now()}${Math.random().toString(36).slice(2)}@example.com`;
}

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
  });

  // Test 2: Registration
  const registerPayload = JSON.stringify({
    email: getRandomEmail(),
    password: 'TestPassword123!',
    name: 'Load Test User',
  });

  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  registerDuration.add(registerRes.timings.duration);
  check(registerRes, {
    'register status 201 or 409': (r) => r.status === 201 || r.status === 409,
  });

  // Test 3: Login
  const loginPayload = JSON.stringify({
    email: 'test@example.com',
    password: 'TestPassword123!',
  });

  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  loginDuration.add(loginRes.timings.duration);
  check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login returns token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data?.accessToken !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Test 4: Token refresh
  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      const refreshToken = body.data?.refreshToken;

      if (refreshToken) {
        const refreshPayload = JSON.stringify({ refreshToken });
        const refreshRes = http.post(`${BASE_URL}/api/v1/auth/refresh-token`, refreshPayload, {
          headers: { 'Content-Type': 'application/json' },
        });
        refreshDuration.add(refreshRes.timings.duration);
        check(refreshRes, {
          'refresh status 200': (r) => r.status === 200,
        });
      }
    } catch (e) {
      // Parse error
    }
  }

  sleep(1);
}
