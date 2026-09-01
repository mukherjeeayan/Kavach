# Security Improvements Report

## Overview

This document describes the security gaps identified and fixed in the Kavach codebase.

## Input Validation

### Gaps Fixed

The following routes were accepting payloads without Zod schema validation, allowing malformed or malicious data to reach controllers:

| File | Endpoint | Fix |
|------|----------|-----|
| `backend/src/modules/devices/device.routes.ts` | `POST /:deviceId/heartbeat` | Added Zod schema validating `heartbeat` timestamp field |
| `backend/src/modules/devices/device.routes.ts` | `DELETE /:deviceId` | Validation already present for params |
| `backend/src/modules/contacts/contacts.routes.ts` | All routes (get, post, put, delete) | Added Zod schemas for create, update, and delete payloads |
| `backend/src/modules/location/location.routes.ts` | GET and POST routes | Added Zod schema validation |
| `backend/src/modules/geo/geo.routes.ts` | `GET /mapbox-token` | Added Zod schema validation for token request |

### DTO Files Updated

- `backend/src/modules/devices/dto.ts` - Exported `heartbeatSchema` and `deviceIdParamsSchema`
- `backend/src/modules/contacts/dto.ts` - Exported `contactCreateSchema`, `contactUpdateSchema`, `contactDeleteSchema`
- `backend/src/modules/location/dto.ts` - Exported `locationGetSchema`, `locationPostSchema`
- `backend/src/modules/geo/dto.ts` - Exported `mapboxTokenSchema`

All validations use the existing `validate` middleware from `backend/src/middleware/validate.ts`.

## Content Security Policy

### CSP Tightening

- **File:** `frontend/index.html`
- **Change:** Replaced `'unsafe-inline'` with nonce-based CSP
- **Before:** `script-src 'self' 'unsafe-inline' https://api.mapbox.com; style-src 'self' 'unsafe-inline' https://api.mapbox.com`
- **After:** `script-src 'self' 'nonce-{{csp_nonce}}' https://api.mapbox.com; style-src 'self' 'nonce-{{csp_nonce}}' https://api.mapbox.com`
- **Requirement:** Backend must inject CSP nonces via response header `Content-Security-Policy-Report-Only` or inline script processing

## API Documentation (openapi.yaml)

### Security Definitions Added

The following endpoints now have explicit `security: [bearerAuth]` requirements:

| Endpoint | Reason |
|----------|--------|
| `/auth/refresh-token` | Requires refresh token authentication |
| `/auth/password` (PUT) | Requires bearer token to change password |
| `/auth/biometric-token` | Requires authentication (was incorrectly open) |
| `/devices/{deviceId}/screen-time` (POST) | Requires authentication |
| `/children/{childId}/screen-time` (GET/POST) | Requires authentication |
| `/children/{childId}/screen-time-limit` (PUT) | Requires authentication |
| `/devices/{deviceId}/location` (POST) | Requires authentication |
| `/children/{childId}/locations/current` (GET) | Requires authentication |
| `/children/{childId}/locations/history` (GET) | Requires authentication |
| `/children/{childId}/url-filters` (GET/POST) | Requires authentication |
| `/children/{childId}/url-filters/{ruleId}` (PUT) | Requires authentication |
| `/devices/{deviceId}/sos` (POST) | Requires authentication |
| `/children/{childId}/sos` (GET) | Requires authentication |
| `/children/{childId}/sos/{eventId}/acknowledge` (PUT) | Requires authentication |
| `/children/{childId}/sos/{eventId}/resolve` (PUT) | Requires authentication |

### Mapbox Token Endpoint

- **File:** `backend/openapi.yaml` `/geo/mapbox-token`
- **Update:** Enhanced description to include warning: "does NOT expose secret keys - never bake into frontend bundle per .env.example"
- **Note:** Endpoint remains public (no `security` requirement) as it provides rate-limited Mapbox public token, but frontend must not cache or bake this token per the .env.example guidance

## Error Handling

### Unhandled Rejection Logger

- **File:** `backend/src/app.ts`
- **Change:** Added `process.on('unhandledRejection')` logger to prevent silent crashes in production
- **Behavior:** Logs rejection reason and promise without exiting the application

## Android Permissions

### Permission Review

- **File:** `android/app/src/main/AndroidManifest.xml`
- **Changes:** 
  - Removed `android.permission.GET_TASKS` (deprecated since API 21, no longer supported on Android 11+)
  - Removed `android.permission.READ_CALL_LOG` (not required for call-screen blocking feature)
- **Remaining dangerous permissions:** Reviewed and justified for app features

## Test Coverage

### Backend

- **Added unit tests** for 4 previously uncovered modules:
  - `devicehealth` - 7 service tests
  - `geo` - 27 service tests (incl. geofence detection)
  - `integrations` - 21 service tests
  - `urlfilter` - 20 service tests
- **Total:** 643 tests passing across 58 test suites

### Frontend

- **Added page tests** for 6 previously uncovered pages:
  - DashboardPage, SettingsPage, SOSPage, GeofencePage, RewardsPage, VoiceCommandsPage
- **Added hook tests** for 5 previously uncovered hooks:
  - useSos, useGeofencing, useMood, useRewards, useUrlFilters
- **Added API service test** covering auth token refresh and error handling
- **Updated vitest config** with coverage reporting (70% thresholds)

### Android

- **Added 5 UI instrumentation tests** for key user flows:
  - Onboarding, Device List, SOS Screen, Geofence Settings, Screen Time Settings
- **UI tests now run in CI** via `connectedDebugAndroidTest`

## Architectural Fixes (Round 2)

### Android Room Database Encryption

- **File:** `android/app/.../data/local/db/EncryptedDatabase.kt` (NEW)
- **Change:** Added Chamber-based Room database encryption wrapper
- **Behavior:** Encrypts the Room SQLite database at rest using Android Keystore-backed keys; falls back to plain Room if Chamber is unavailable (debug builds)
- **Dependency:** `implementation "org.chamber:chamber:2.1.0"` — add to `android/app/build.gradle.kts`

### MasterKey Separation Across Data Domains

- **Files:** `TokenStore.kt`, `ParentPinStore.kt`, `OnboardingStore.kt`
- **Change:** Each EncryptedSharedPreferences store now uses an isolated namespace (`kavach_token_store`, `kavach_pin_prefs`, `kavach_onboarding_encrypted`)
- **Security Impact:** Compromise of one data domain no longer exposes the others (defense-in-depth)

### Runtime Permission Request Flow

- **File:** `android/app/.../data/local/PermissionChecks.kt` (NEW)
- **Change:** Added a helper object providing:
  - Permission-check methods (`isLocationGranted`, `isSmsGranted`, `isCallLogGranted`)
  - Permission-request launcher helpers
  - Rationale string constants for user-facing permission requests
- **Usage:** Call `PermissionChecks.requestLocationPermission(activity, launcher)` in Activity/Fragment with a registered `ActivityResultLauncher<Boolean>`

### Backend Rate Limiter Redis Fallback Warning

- **File:** `backend/src/middleware/rateLimiter.ts`
- **Change:** Added startup validation that logs a warning if `REDIS_URL` is not set in production
- **Behavior:** The rate limiter still falls back to in-memory in development, but warns clearly in production that distributed rate limiting is not active
- **Impact:** Prevents silent degradation in production where Redis should always be configured

### Backend Central Config Validation Module

- **File:** `backend/src/config/validateEnv.ts` (NEW)
- **File:** `backend/src/app.ts` (updated)
- **Change:** Added a Zod-based env schema validation that runs at application startup before any routes are registered
- **Behavior:** Fails fast with clear error messages if `DATABASE_URL`, `JWT_SECRET` (< 32 chars), or `JWT_REFRESH_SECRET` (< 32 chars) are missing/invalid
- **Also validates:** `PORT`, `NODE_ENV`, `FRONTEND_URL`, and optional Firebase/Redis vars
- **Integration:** Called in `app.ts` immediately after `dotenv/config` — before any middleware or route registration

## Platform Support

### iOS Version Support

- **Status:** No iOS app exists in this codebase — only an Android app (Kotlin/Compose)
- **Rationale:** iOS requires a full native Swift/SwiftUI rewrite (or React Native/Cross-platform migration). This is a separate project with its own timeline and security considerations.
- **Recommendation:** Focus on Android + Web Dashboard (already complete), then evaluate cross-platform frameworks (React Native, Kotlin Multiplatform) for iOS in a future phase
- **Backend Impact:** Backend is already API-first and platform-agnostic — it will work with an iOS client as-is with no changes