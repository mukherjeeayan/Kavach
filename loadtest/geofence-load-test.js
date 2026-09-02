// geofence-load-test.js
// Load test for geofence checking endpoints.
// Simulates high-frequency geofence checks from multiple devices.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const checkDuration = new Trend('geofence_check_duration');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Simulate school location (geofence center)
const SCHOOL_LAT = 12.9716;
const SCHOOL_LNG = 77.5946;
const SCHOOL_RADIUS = 100; // 100 meters

function getRandomChildId() {
  const children = ['child-1', 'child-2', 'child-3', 'child-4', 'child-5'];
  return children[Math.floor(Math.random() * children.length)];
}

function simulateLocationMovement() {
  // Simulate child moving around school area
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * 200; // 0-200m from center
  const lat = SCHOOL_LAT + (distance / 111000) * Math.cos(angle);
  const lng = SCHOOL_LNG + (distance / (111000 * Math.cos(SCHOOL_LAT * Math.PI / 180))) * Math.sin(angle);
  return { lat, lng };
}

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`,
  };

  // Test 1: Check geofence status
  const location = simulateLocationMovement();
  const childId = getRandomChildId();

  const checkRes = http.get(
    `${BASE_URL}/api/v1/children/${childId}/geofences/check?lat=${location.lat}&lng=${location.lng}`,
    { headers }
  );
  checkDuration.add(checkRes.timings.duration);
  check(checkRes, {
    'geofence check status 200': (r) => r.status === 200,
  });

  // Test 2: Get current location (less frequent)
  if (Math.random() < 0.2) { // 20% of requests
    const locationRes = http.get(
      `${BASE_URL}/api/v1/children/${childId}/locations/current`,
      { headers }
    );
    check(locationRes, {
      'get location status 200': (r) => r.status === 200,
    });
  }

  // Test 3: Get geofences list (rare)
  if (Math.random() < 0.05) { // 5% of requests
    const geofencesRes = http.get(
      `${BASE_URL}/api/v1/children/${childId}/geofences`,
      { headers }
    );
    check(geofencesRes, {
      'list geofences status 200': (r) => r.status === 200,
    });
  }

  sleep(0.5); // 500ms between checks
}
