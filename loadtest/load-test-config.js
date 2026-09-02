// load-test-config.js
// Comprehensive load test configuration for Kavach backend.
// Tests various API endpoints under different load patterns.

export const options = {
  // Stress test: ramp up to high load
  stress: {
    stages: [
      { duration: '30s', target: 10 },   // Ramp up
      { duration: '1m', target: 50 },    // Stress
      { duration: '2m', target: 100 },   // Peak
      { duration: '1m', target: 50 },    // Recovery
      { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<3000'],
      errors: ['rate<0.15'],
    },
  },
  // Soak test: sustained load over time
  soak: {
    stages: [
      { duration: '1m', target: 20 },    // Ramp up
      { duration: '30m', target: 20 },   // Sustained load
      { duration: '1m', target: 0 },     // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000'],
      errors: ['rate<0.05'],
    },
  },
  // Spike test: sudden burst of traffic
  spike: {
    stages: [
      { duration: '10s', target: 10 },   // Normal
      { duration: '5s', target: 200 },   // Spike!
      { duration: '1m', target: 200 },   // Sustained spike
      { duration: '5s', target: 10 },    // Recovery
      { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      errors: ['rate<0.2'],
    },
  },
};
