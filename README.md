# SafeGuard — Parental Control Platform

SafeGuard is a parental-control platform that keeps children safe on
Android phones while giving parents full visibility and control from a
web dashboard. Designed from a
[design plan](doc/PARENTAL_CONTROL_APP_DESIGN_PLAN.md) with Phase 1
(mvp) functionality complete end-to-end.

## Features (Phase 1)

| Feature | Child device (Android) | Parent (web dashboard) |
|---|---|---|
| App blocking | Foreground service kills blocked apps in ~1s, offline-capable | Block/unblock apps, approve/reject unblock requests |
| Screen time | Per-app foreground seconds recorded locally, batched upload | Day/week/month summaries, per-app breakdown |
| Scheduled locks | Lock-window enforcement (whitelist = launcher/settings) | Create/edit/delete lock windows |
| Contacts | Incoming-call rejection for blocked numbers (Call Screening role) | Allow/block rules per number |
| Location | Foreground GPS pinger, buffered upload | latest + recent positions with Google Maps links |
| Parental auth | Biometric + PIN gate before parental settings (PIN stored as salted digest in EncryptedSharedPreferences) | PIN verification before management sections |

Shared security posture: fail-closed caching (rules enforced from a
local Room cache even when offline), tamper/root detection with local
lockdown + server alert, JWT auth with rotating refresh tokens, and
rate-limited, validated, audited API endpoints.

## Repository layout

```
backend/   Express + TypeScript API (Postgres + Redis, socket.io)
frontend/  React + Vite dashboard (react-query, redux)
app/       Android app (Jetpack Compose, Hilt, Room, WorkManager)
doc/       Design plan, task list, and per-stack skill guides
```

## Getting started

### 1. Services (Postgres + Redis)

```bash
docker compose up -d
```

The first boot applies `backend/db/migrations/*.sql` in order
(seq 1-4). Redis is used for rate limiting.

### 2. Backend

```bash
cd backend
cp .env.example .env        # adjust as needed (JWT secrets!)
npm install
npm run dev                 # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api/v1 and /socket.io)
```

### 4. Android

- Configure `API_BASE_URL` in `app/build.gradle.kts` build types
  (debug defaults to `http://10.0.2.2:3000/` for the emulator).
- `./gradlew :app:assembleDebug`, then install on the emulator.
- Onboarding flow: login → child → device → PIN → permissions
  (usage stats, device admin, notifications, location, call screening).

## Testing

```bash
# backend — typecheck + 71 tests (services + route-surface smoke)
cd backend && npx tsc --noEmit && npx jest --silent

# frontend — build + lint
cd frontend && npm run build && npm run lint

# android — assemble + unit tests
cd <repo root> && ./gradlew :app:assembleDebug :app:testDebugUnitTest
```

CI (`.github/workflows/ci.yml`) runs all three on push/PR.

## API

See [doc/API.md](doc/API.md) for the complete endpoint reference.

## Documentation

- [Design plan](doc/PARENTAL_CONTROL_APP_DESIGN_PLAN.md)
- [Task list](doc/PROJECT_TASKLIST.md)
- Per-stack skill guides: `doc/SKILL_*.md`