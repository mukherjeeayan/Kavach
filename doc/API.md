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
`/auth/pin/verify` and `/health` require `Authorization: Bearer <JWT>`.
Parent endpoints also require the `parent` role (rejected with 403
otherwise). Validation failures return 422; auth failures 401.

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
Body: `{ refresh_token }`

### PUT /auth/pin — set or rotate the parental PIN
Body: `{ pin }` (4-6 digits; stored as a bcrypt hash). Called by the
Android app during onboarding.

### POST /auth/pin/verify — verify the PIN (dashboard unlock)
Body: `{ email, pin }` → 200 `{ valid: true, token: "<15m scoped pin token>" }` / 401 on mismatch.

### POST /auth/biometric-token — short-lived token for biometric unlocks
Body: `{ email, password }` → 15-minute scoped token.

---

## Children & Devices

| Method | Path | Description |
|---|---|---|
| GET | `/children` | List the parent's children |
| POST | `/children` | Create a child (`{ name, birth_date? }`) |
| GET | `/children/:childId/devices` | Devices of a child |
| POST | `/devices/register` | Register/refresh this device (`{ child_id, device_id?, device_name, device_type, os_version? }`) |
| POST | `/devices/:deviceId/tamper-alert` | Device reports tampering (`{ details }`) |

---

## App Blocking

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/apps/blocked` | Blocked apps (incl. pending unblocks) |
| POST | `/children/:childId/apps/block` | Block an app (`{ device_id, package_name, app_name?, block_reason? }`) |
| DELETE | `/children/:childId/apps/block/:ruleId` | Unblock |
| POST | `/children/:childId/apps/unblock-request` | Child requests an unblock (`{ rule_id, reason }`) |
| GET | `/children/:childId/apps/unblock-requests` | Pending requests |
| POST | `/children/:childId/apps/block/:ruleId/:decision-unblock` | Approve or reject (`decision` = `approve` \| `reject`) |

---

## Screen Time

| Method | Path | Description |
|---|---|---|
| POST | `/devices/:deviceId/screen-time` | Batch upload `{ entries: [{ app_package, app_category?, seconds, date? }] }` — accumulates idempotently |
| GET | `/children/:childId/screen-time?date=YYYY-MM-DD` | Per-app usage for one date (defaults to today) |
| GET | `/children/:childId/screen-time/summary?range=day\|week\|month` | `{ range, total_seconds, daily: [{ date_recorded, total_seconds }], by_app: [{ app_package, app_category, total_seconds }] }` |

---

## Scheduled Locks

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/locks` | List lock windows |
| POST | `/children/:childId/locks` | `{ device_id?, day_of_week? (0=Sun..6=Sat, null=every day), start_time "HH:MM", end_time "HH:MM", is_active? }` |
| PUT | `/children/:childId/locks/:lockId` | Partial update (same fields) |
| DELETE | `/children/:childId/locks/:lockId` | Delete |

---

## Contacts

| Method | Path | Description |
|---|---|---|
| GET | `/children/:childId/contacts` | List allow/block rules |
| POST | `/children/:childId/contacts` | `{ phone_number, contact_name?, rule_type: ALLOW\|BLOCK, device_id? }` |
| PUT | `/children/:childId/contacts/:contactId` | `{ contact_name?, rule_type?, is_active? }` |
| DELETE | `/children/:childId/contacts/:contactId` | Delete |

---

## Location

| Method | Path | Description |
|---|---|---|
| POST | `/devices/:deviceId/location` | GPS ping `{ latitude, longitude, accuracy_m?, speed_kmh?, recorded_at? }` |
| GET | `/children/:childId/locations/current` | Latest position per device |
| GET | `/children/:childId/locations/history?from&to&limit` | Recent pings (limit capped at 500) |

---

## Misc

`GET /health` — liveness with real DB check (200 / 503).

## Realtime

`rule:changed` is broadcast over Socket.IO to the room of the affected
child whenever block rules change (path `/socket.io`, same port).