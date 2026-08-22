# SafeGuard API Reference

Base URL: `http://localhost:3000/api/v1`

Every response uses the uniform envelope:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "timestamp": "2026-01-01T00:00:00.000Z",
  "request_id": "uuid"
}
```

All endpoints except `/auth/login`, `/auth/register`, `/auth/refresh-token`,
`/auth/pin/verify`, `/auth/biometric-token`, `/devices/register`,
`/devices/:deviceId/screen-time`, `/devices/:deviceId/location`,
`/devices/:deviceId/tamper-alert` and `/health` require
`Authorization: Bearer <JWT>`.

**Browser sessions (web dashboard):** the auth endpoints also set
httpOnly cookies — `kavach_access` (short-lived, site-wide) and
`kavach_refresh` (7 days, scoped to `/api/v1/auth`). The middleware
accepts either the Bearer header (mobile) or the access cookie (web),
and `/auth/refresh-token` + `/auth/logout` accept the refresh cookie
instead of a body token. The web client keeps tokens out of JS-readable
storage entirely.
Parent endpoints also require the `parent` role (rejected with 403
otherwise). Validation failures return 422; auth failures 401.

List endpoints accept optional `?page=` (1-based, default 1) and
`?limit=` (default 20, max 100) and return a `pagination` object:

```json
"pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
```

Device endpoints may include an `X-Device-ID` header (device_id)
additionally to the bearer token for tamper alerts.
Every child-data write (`createChild`, `createDevice`, `blockApp`,
`requestUnblock`, `approveUnblock`, `rejectUnblock`, `createLock`,
`updateLock`, `deleteLock`, `createContact`, `updateContact`,
`deleteContact`, `recordScreenTime`, `recordLocation`,
`setScreenTimeLimit`, tamper alerts) is recorded in the parent's
audit log.

---

## Auth

### POST /auth/register — create a parent account
Body: `{ name, email, password, child_name?, birth_date? }`

### POST /auth/login
Body: `{ email, password }`
Returns:
```json
{ "token": "...", "refresh_token": "...", "user": { "id", "email", "name" }, "child": { ... } | null }
```

### POST /auth/refresh-token — rotate the refresh token
Body: `{ refresh_token }` **optional** — the httpOnly cookie is accepted
instead (browser clients). → 200 `{ token, refresh_token }`; new cookies
are set. Replaying an already-rotated token revokes the whole session
family (token-theft response). No token anywhere → 401.

### POST /auth/logout — revoke the refresh token
Body: `{ refresh_token }` optional — the httpOnly cookie is accepted.
Idempotent (always 200, `{ revoked: boolean }`); session cookies are
cleared either way. Call this on sign-out so the old refresh token can
never be replayed.

### GET /auth/me — authenticated profile
→ 200 `{ user: { id, email, name } }`.

### PUT /auth/profile — update the parent profile
Body: `{ name }` → 200 `{ user }`.

### PUT /auth/password — change password
Body: `{ current_password, new_password }` (≥8 chars).
On success **all sessions are revoked** and session cookies cleared.
401 when the current password is wrong.

### POST /auth/logout-all — sign out of every device
Revokes all active refresh tokens for the account.
→ 200 `{ revoked: <count> }`.

### PUT /auth/pin — set or rotate the parental PIN
Body: `{ pin }` (4-6 digits; stored as a bcrypt hash). Called by the
Android app during onboarding.

### POST /auth/pin/verify — verify the PIN (dashboard unlock)
Body: `{ email, pin }` → 200
`{ valid: true, token: "<15m scoped pin token>", user: { id, email, name }, child: { ... } | null }`
/ 401 on mismatch.

### POST /auth/biometric-token — short-lived token for biometric unlocks
Body: `{ email, password }` → 15-minute scoped token. Rate-limited
(5 per minute per IP).

---

## Children & Devices

| Method | Path | Description |
|---|---|---|
| GET | `/children` | List the parent's children (paginated) |
| POST | `/children` | Create a child (`{ name, birth_date? }`) |
| GET | `/children/:childId` | Single child profile |
| PATCH | `/children/:childId` | Update `{ name?, birth_date? }` |
| DELETE | `/children/:childId` | Delete profile — cascades devices/rules/logs/consents (DPDP erasure). Owner only. |
| GET | `/children/:childId/devices` | Devices of a child (paginated) |
| PUT | `/children/:childId/screen-time-limit` | Set or clear the daily screen-time limit (`{ limit_minutes: number \| null }`, 0-1440) |
| GET | `/children/:childId/alerts` | Tamper / screen-time / per-app-limit / device-admin alerts with `acknowledged_at` state (paginated) |
| POST | `/children/:childId/alerts/ack` | Mark alerts seen — `{ alert_ids?: string[] }`; omit to acknowledge all |
| DELETE | `/devices/:deviceId` | Unpair a device (cascades its rules/logs) |
| POST | `/devices/register` | Register/refresh this device (`{ child_id, device_id?, device_name, device_type, os_version?, fcm_token? }`) |
| GET | `/devices/:deviceId/heartbeat` | Device heartbeat — returns `{ rules_changed, force_logout }` and bumps `last_active` |
| PUT | `/devices/:deviceId/admin-status` | Report device-admin state `{ admin_active }` (audited) |
| PUT | `/devices/:deviceId/fcm-token` | Refresh push token `{ fcm_token }` |
| POST | `/devices/:deviceId/tamper-alert` | Device reports tampering (`{ details }`) — `X-Device-ID` header accepted as fallback |

### Co-guardian sharing
A child is owned by its creator and can be shared with other parent
accounts; guardians get full access to every child-scoped endpoint.

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/guardians` | List guardians incl. the owner |
| POST | `/children/:childId/guardians` | Owner shares: `{ email }` of an existing parent account (idempotent) |
| DELETE | `/children/:childId/guardians/:guardianId` | Owner revokes a guardian (the owner cannot be removed → 409) |

---

## Consent (DPDP)

Location and screen-time ingestion are **blocked with 403** until
consent has been granted for the child.

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/consent` | List consents with active/revoked state |
| POST | `/children/:childId/consent` | Grant consent `{ consent_type }` (`location`, `app_usage`, `communications`, …) |
| DELETE | `/children/:childId/consent/:consentType` | Revoke (404 when no active consent of that type) |
| GET | `/children/:childId/consent/check/:consentType` | Boolean check used by ingestion gating |

---

## App Blocking

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/apps/blocked` | Blocked apps (incl. pending unblocks) — `data` is a raw array (Android client compatibility) |
| POST | `/children/:childId/apps/block` | Block an app (`{ device_id, package_name, app_name?, block_reason? }`) |
| DELETE | `/children/:childId/apps/block/:ruleId` | Unblock |
| POST | `/children/:childId/apps/unblock-request` | Child requests an unblock (`{ rule_id, reason }`) |
| GET | `/children/:childId/apps/unblock-requests` | Pending requests — `data` is a raw array |
| POST | `/children/:childId/apps/block/:ruleId/:decision-unblock` | Approve or reject (`decision` = `approve` \| `reject`) |

---

## Screen Time

| Method | Path | Description |
|---|---|---|
| POST | `/devices/:deviceId/screen-time` | Batch upload `{ batch_id?, entries: [{ app_package, app_category?, seconds, date? }] }` — `batch_id` (device-generated UUID) makes retried batches idempotent; accumulates seconds otherwise; 10 req/min per device. When the child's daily limit is crossed, the backend writes one `SCREEN_TIME_LIMIT_REACHED` alert per day (visible at `/children/:childId/alerts`) |
| GET | `/children/:childId/screen-time?date=YYYY-MM-DD` | Per-app usage for one date (defaults to today) |
| GET | `/children/:childId/screen-time/summary?range=day\|week\|month` | `{ range, total_seconds, daily: [{ date_recorded, total_seconds }], by_app: [{ app_package, app_category, total_seconds }] }` |

---

## Scheduled Locks

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/locks` | List lock windows (paginated) |
| POST | `/children/:childId/locks` | `{ device_id?, day_of_week? (0=Sun..6=Sat, null=every day), start_time "HH:MM", end_time "HH:MM", is_active? }` |
| PUT | `/children/:childId/locks/:lockId` | Partial update (same fields) |
| DELETE | `/children/:childId/locks/:lockId` | Delete |

---

## Contacts

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/contacts` | List allow/block rules (paginated) |
| POST | `/children/:childId/contacts` | `{ phone_number, contact_name?, rule_type: ALLOW\|BLOCK, device_id? }` |
| PUT | `/children/:childId/contacts/:contactId` | `{ contact_name?, rule_type?, is_active? }` |
| DELETE | `/children/:childId/contacts/:contactId` | Delete |

---

## Location

| Method | Path | Description |
|---|---|---|
| POST | `/devices/:deviceId/location` | GPS ping `{ latitude, longitude, accuracy_m?, speed_kmh?, recorded_at? }` — 10 req/min per device (429 on overflow) |
| GET | `/children/:childId/locations/current` | Latest position per device |
| GET | `/children/:childId/locations/history?from&to&limit` | Recent pings (limit capped at 500) |

---

## Misc

`GET /health` — liveness with real DB check (200 / 503).

`GET /api/v1/geo/mapbox-token` — runtime Mapbox public token for the
dashboard (503 when `MAPBOX_PUBLIC_TOKEN` is unset). Keeps the token
out of the frontend bundle.

OpenAPI documentation: interactive docs are served at **`/api/docs`**
(swagger-ui) backed by `/api/docs.json`.

## Realtime

`rule:changed` is broadcast over Socket.IO to the room of the affected
child whenever block rules change (path `/socket.io`, same port).
**Connections must authenticate during the handshake** with a parent
access token (`auth: { token: "Bearer <jwt>" }`); unauthenticated
sockets are rejected and room joins are authorized against child
ownership.