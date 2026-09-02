// telemetry-load-test.js
// Load test for telemetry ingestion endpoints.
// Simulates high-frequency GPS pings from multiple child devices.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const ingestDuration = new Trend('ingest_duration');
const totalPings = new Counter('total_pings');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Simulate realistic GPS coordinates (Bangalore, India)
const CENTER_LAT = 12.9716;
const CENTER_LNG = 77.5946;
const RADIUS_KM = 5;

function randomCoordinate() {
  const lat = CENTER_LAT + (Math.random() - 0.5) * 0.1;
  const lng = CENTER_LNG + (Math.random() - 0.5) * 0.1;
  return { lat, lng };
}

function getRandomChildId() {
  const children = ['child-1', 'child-2', 'child-3', 'child-4', 'child-5'];
  return children[Math.floor(Math.random() * children.length)];
}

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up
    { duration: '2m', target: 100 },   // High load
    { duration: '3m', target: 100 },   // Sustained
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  // Test 1: Location ping
  const location = randomCoordinate();
  const locationPayload = JSON.stringify({
    childId: getRandomChildId(),
    latitude: location.lat,
    longitude: location.lng,
    accuracy: 5 + Math.random() * 45, // 5-50m accuracy
    speed: Math.random() * 60, // 0-60 km/h
    batteryLevel: 20 + Math.random() * 80, // 20-100%
    timestamp: Date.now(),
  });

  const locationRes = http.post(`${BASE_URL}/api/v1/devices/location`, locationPayload, {
    headers,
  });
  ingestDuration.add(locationRes.timings.duration);
  totalPings.add(1);
  check(locationRes, {
    'location ping status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  // Test 2: Screen time upload (less frequent)
  if (Math.random() < 0.1) { // 10% of requests
    const screenTimePayload = JSON.stringify({
      childId: getRandomChildId(),
      packageName: 'com.example.app',
      usageMinutes: Math.floor(Math.random() * 60),
      timestamp: Date.now(),
    });

    const screenTimeRes = http.post(`${BASE_URL}/api/v1/devices/screen-time`, screenTimePayload, {
      headers,
    });
    check(screenTimeRes, {
      'screen time status 200/201': (r) => r.status === 200 || r.status === 201,
    });
  }

  // Test 3: Health check (periodic)
  if (Math.random() < 0.05) { // 5% of requests
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health check status 200': (r) => r.status === 200,
    });
  }

  sleep(0.1); // 100ms between requests (10 pings/second per VU)
}
