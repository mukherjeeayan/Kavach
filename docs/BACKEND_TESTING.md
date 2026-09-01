# Backend Test Coverage Report

## Overview

The backend has **643 tests** across **58 test suites** (1 skipped). All tests use **Jest** as the test framework, **pg-mem** for in-memory database emulation, and **supertest** for HTTP integration tests (where applicable).

## Test Commands

```bash
npm test                    # Run all tests
npm run test:unit           # Unit tests only (no DB needed)
npm run test:integration    # Integration tests only (requires running DB)
npx tsc --noEmit            # Type-check
```

## Module Test Coverage

### Auth Module
- Login, register, 2FA, getMe, refreshAccessToken
- Token family rotation and subscription context preservation
- Account lockout after failed attempts

### Children Module
- CRUD operations, child-parent verification
- Guardian management

### Device Health Module (7 tests)
- `recordHealth`, `getLatestHealth`, `getHealthHistory`
- Security audit alerts for rooted devices

### Geo Module (27 tests)
- Geofence CRUD (list, create, update, delete)
- Geofence detection (entry/exit events, alert_on_entry/alert_on_exit)

### Integrations Module (21 tests)
- CRUD operations, sync, audit logging

### URL Filter Module (20 tests)
- CRUD operations, active rule filtering

### App Blocking Module
- Rule CRUD, device sync, unblock requests

### Screen Time Module
- Usage tracking, daily limits, per-app limits

### Location Module
- GPS ping ingestion, history, current location

### Contacts Module
- Contact rules (ALLOW/BLOCK), device sync

### Communication Module
- SMS/call log monitoring, cyberbullying detection

### Mood Module
- Mood logging, summary, daily check-ins

### Self-Harm Module
- Keyword detection, critical alert generation

### Rewards Module
- Points system, reward catalog, redemptions

### Predictions Module
- Behavior predictions, risk scoring

### Security Module
- Tamper detection, root detection

### Voice Commands Module
- Command parsing, execution

### SOS Module
- Emergency alerts, acknowledge/resolve

### Analytics Module
- Usage analytics, dashboard data

### Statistics Module
- Aggregated statistics, reports

### Reports Module
- Weekly AI report generation

### Settings Module
- Profile updates, PIN management

### Devices Module
- Device registration, heartbeat, pairing

### Consent Module
- Parental consent tracking

### Notifications Module
- Push notification management

### Admin Module (24 tests)
- System stats, user management, feature flags

### Subscription Module (20 tests)
- Plans, Razorpay orders, webhooks, upgrade/downgrade

### Shared Module
- Audit logging, pagination, validation middleware

## Test Pattern Summary

All service tests follow a consistent pattern:

1. **Mock the database:** `jest.mock('../../../config/database', () => ({ query: jest.fn() }))`
2. **Mock dependent services:** Children service and audit service are mocked
3. **Use descriptive test constants:** PARENT_ID, CHILD_ID, DEVICE_ID at module level
4. **Before each test:** `jest.clearAllMocks()` resets mock state
5. **Test structure:** `describe('serviceName') > describe('methodName') > it('description')`
6. **Assertions:** Verify returned values, mock calls, error throws, audit logs
