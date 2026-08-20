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
Body: `{ refresh_token }` → 200 `{ token, refresh_token, user }`.

### POST /auth/logout — revoke the refresh token
Body: `{ refresh_token }` → 200 `{ success: true }`. Idempotent; call this
on sign-out so the old refresh token can never be replayed.

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
| GET | `/children/:childId/devices` | Devices of a child (paginated) |
| PUT | `/children/:childId/screen-time-limit` | Set or clear the daily screen-time limit (`{ limit_minutes: number \| null }`, 0-1440) |
| GET | `/children/:childId/alerts` | Recent tamper + screen-time-limit alerts (`?limit=`, max 100) |
| POST | `/devices/register` | Register/refresh this device (`{ child_id, device_id?, device_name, device_type, os_version?, fcm_token? }`) |
| GET | `/devices/:deviceId/heartbeat` | Device heartbeat — returns `{ rules_changed, force_logout }` and bumps `last_active` |
| POST | `/devices/:deviceId/tamper-alert` | Device reports tampering (`{ details }`) — `X-Device-ID` header accepted as fallback |

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
| POST | `/devices/:deviceId/screen-time` | Batch upload `{ entries: [{ app_package, app_category?, seconds, date? }] }` — accumulates idempotently; 10 req/min per device. When the child's daily limit is crossed, the backend writes one `SCREEN_TIME_LIMIT_REACHED` alert per day to the audit log (visible at `/children/:childId/alerts`) |
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

`GET /devices/:deviceId/heartbeat` — `{ rules_changed, force_logout }`;
`rules_changed` is true when block/lock/contact rules changed since the
device's `last_active` timestamp (server bumps `last_active` on each
call, so the device must call this every few minutes to stay fresh).
`force_logout` is true when the device's token was explicitly revoked.

## Realtime

`rule:changed` is broadcast over Socket.IO to the room of the affected
child whenever block rules change (path `/socket.io`, same port).