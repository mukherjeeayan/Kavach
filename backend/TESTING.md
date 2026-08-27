
# Test Coverage Report

This document describes the unit test coverage improvements made for the backend modules.

## Overview

The following backend modules have unit tests covering their service layers. All tests use **Jest** as the test framework, **pg-mem** for in-memory database emulation, and **supertest** for HTTP integration tests (where applicable).

## Test Command

Run all unit tests:

`ash
npm test
`

Run unit tests (excluding integration tests):

`ash
npm run test:unit
`

## Module Test Coverage

### 1. devicehealth Module
**File:** ackend/src/modules/devicehealth/__tests__/deviceHealth.service.test.ts

**Tests:** 7 tests covering all service methods

**Covered Methods:**
- ecordHealth(parentId, deviceId, input) - Records a health snapshot from the device
  - Inserts health data into device_health_logs table
  - Writes security audit alert when device is rooted or USB debugging is enabled
  - Throws NotFoundError when device not found for parent

- getLatestHealth(parentId, childId, deviceId) - Gets the latest health snapshot
  - Verifies child belongs to parent
  - Returns 
ull when no health data exists

- getHealthHistory(parentId, childId, deviceId, limit) - Gets health history for charts
  - Verifies child belongs to parent
  - Returns array of health entries limited by limit parameter (default 48)

**Test Pattern:** Each test mocks the query function and children.service erifyChildBelongsToParent, and shared.audit.service writeAuditLog to isolate the service layer.

---

### 2. geo Module
**File:** ackend/src/modules/geo/__tests__/geofence.service.test.ts

**Tests:** 27 tests covering geofence CRUD and detection

**Covered Methods (CRUD):**
- listGeofences(parentId, childId, page, limit) - Lists paginated geofences for a child
- createGeofence(parentId, childId, input) - Creates a new geofence
  - Verifies child belongs to parent
  - Ensures device belongs to child (if device_id provided)
  - Writes CREATE_GEOFENCE audit log

- updateGeofence(parentId, childId, geofenceId, input) - Updates an existing geofence
  - Throws NotFoundError when geofence not found

- deleteGeofence(parentId, childId, geofenceId) - Deletes a geofence
  - Throws NotFoundError when geofence not found
  - Writes DELETE_GEOFENCE audit log

- getActiveGeofencesForChild(childId) - Gets active geofences for device sync

**Covered Methods (Geofence Detection):**
- checkGeofences(childId, deviceId, latitude, longitude) - Detects entry/exit events
  - Detects ENTRY events when device enters a geofence (with alert_on_entry enabled)
  - Detects EXIT events when device exits a geofence (with alert_on_exit enabled, last event was ENTRY)
  - No event generated when alert_on_entry/alert_on_exit is disabled
  - No exit event generated when last event was not ENTRY
  - Handles multiple geofences with mixed states

**Test Pattern:** Tests mock the query function, children.service (verifyChildBelongsToParent, ensureDeviceBelongsToChild), shared.audit.service (writeAuditLog), and utils.pagination (toOffset, buildPaginationMeta).

---

### 3. integrations Module
**File:** ackend/src/modules/integrations/__tests__/integration.service.test.ts

**Tests:** 21 tests covering all service methods

**Covered Methods:**
- listIntegrations(parentId) - Lists all integrations for a parent
- createIntegration(parentId, input) - Creates a new integration
  - Inserts integration with type, name, and config
  - Writes INTEGRATION_CREATED audit log

- updateIntegration(parentId, integrationId, input) - Updates an integration
  - Throws NotFoundError when integration not found for parent
  - Writes INTEGRATION_UPDATED audit log with fields updated

- deleteIntegration(parentId, integrationId) - Deletes an integration
  - Throws NotFoundError when integration not found for parent
  - Writes INTEGRATION_DELETED audit log

- syncIntegration(parentId, integrationId) - Syncs an integration
  - Updates last_sync_at timestamp
  - Throws NotFoundError when active integration not found
  - Writes INTEGRATION_SYNCED audit log

**Test Pattern:** Tests mock the query function and shared.audit.service writeAuditLog.

---

### 4. urlfilter Module
**File:** ackend/src/modules/urlfilter/__tests__/urlFilter.service.test.ts

**Tests:** 20 tests covering all service methods

**Covered Methods:**
- listRules(parentId, childId, page, limit) - Lists paginated URL filter rules for a child
  - Verifies child belongs to parent
  - Returns data and meta (total, page, limit, total_pages)

- createRule(parentId, childId, input) - Creates a new URL filter rule
  - Defaults is_active to 	rue when not provided
  - Writes CREATE_URL_FILTER audit log

- updateRule(parentId, childId, ruleId, input) - Updates a URL filter rule
  - Throws NotFoundError when rule not found
  - Writes UPDATE_URL_FILTER audit log with changes details

- deleteRule(parentId, childId, ruleId) - Deletes a URL filter rule
  - Throws NotFoundError when rule not found
  - Writes DELETE_URL_FILTER audit log

- getActiveRulesForChild(childId) - Gets all active rules for a child
  - Filters by is_active = TRUE
  - Orders by rule_type ASC, url_pattern ASC

**Test Pattern:** Tests mock the query function, children.service erifyChildBelongsToParent, shared.audit.service writeAuditLog, and utils.pagination (toOffset, buildPaginationMeta).

## Test Pattern Summary

All service tests follow a consistent pattern:

1. **Mock the database:** jest.mock('../../../config/database', () => ({ query: jest.fn() }))

2. **Mock dependent services:** Children service and audit service are mocked to isolate the service layer

3. **Use descriptive test constants:** PARENT_ID, CHILD_ID, DEVICE_ID, and entity-specific IDs are defined at the module level

4. **Before each test:** jest.clearAllMocks() resets mock state to prevent test state leakage

5. **Test structure:** describe('serviceName') > describe('methodName') > it('description', async () => { ... })

6. **Assertions:** Verify:
   - Returned values match expectations
   - Mock functions are called with correct arguments
   - Expected errors are thrown
   - Audit logs are written correctly

## Notes

- Repository tests are not applicable for these modules as they use direct query calls to the database rather than a separate repository pattern
- All tests use pg-mem in-memory database via the DB_DRIVER=pg-mem environment variable
- The test setup in jest.setup.js configures test JWT secrets and bcrypt salt rounds

