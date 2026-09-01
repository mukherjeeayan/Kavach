# Developer Guide — Kavach

Step-by-step guide to run the full Kavach stack locally. Covers
backend (Node/Express), frontend (React/Vite), Android (Jetpack Compose),
and the PostgreSQL database.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 20 | Backend + frontend |
| npm | >= 10 | Package manager |
| Docker Desktop | >= 24 | PostgreSQL (via docker compose) |
| Android Studio | latest stable | Android builds + emulator |
| JDK | 17 | Android Gradle builds |
| Git | >= 2.40 | Source control |

Optional:
- **Redis** -- rate limiting falls back to in-memory when unset
- **Mapbox account** -- for the optional dashboard map widget

---

## 1. Clone and install

`
git clone https://github.com/<org>/kavach.git
cd kavach

# Backend
cd backend
npm install
cp .env.example .env        # edit secrets (see section 3)
cd ..

# Frontend
cd frontend
npm install
cd ..
`

## 2. Database

`
docker compose up -d
`

This starts **PostgreSQL 16** on localhost:5432 with:

| Field | Value |
|-------|-------|
| User | postgres |
| Password | password |
| Database | kavach |

The first boot automatically runs every ackend/db/migrations/*.sql
in filename order (001 through 009). Your data persists in the pgdata
Docker volume.

To verify:

`
docker compose exec postgres psql -U postgres -d kavach -c '\dt'
`

You should see tables like users, children, devices, lock_rules,
screen_time_entries, lerts, efresh_tokens, child_guardians, etc.

### Running migrations manually

If you need to re-apply migrations (e.g. after a schema change):

`
cd backend
npm run db:migrate
`

## 3. Backend environment

Edit ackend/.env. The minimum required variables:

`
# Must be changed from the defaults
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>

# Database (matches deploy/docker-compose.yml)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=kavach

# CORS -- must match the frontend dev server
ALLOWED_ORIGINS=http://localhost:5173

# Dev mode disables strict CORS origin checking
NODE_ENV=development
`

Generate secrets quickly:

`
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
`

Optional but recommended for a full experience:

`
# Mapbox -- enables the map widget on the dashboard
MAPBOX_PUBLIC_TOKEN=pk.your_token_here

# Firebase -- enables push notifications to Android
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# SMTP -- enables password-reset emails
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=you@gmail.com
# SMTP_PASS=app-password
`

## 4. Start the backend

`
cd backend
npm run dev
`

The API is live at **http://localhost:3000**. Key endpoints:

| URL | Description |
|-----|-------------|
| GET /health | Liveness probe (checks DB connectivity) |
| GET /api/docs | Swagger UI (interactive API docs) |
| GET /api/docs.json | Raw OpenAPI spec |
| POST /api/v1/auth/register | Create a parent account |
| POST /api/v1/auth/login | Sign in |

The dev server uses 	s-node-dev so edits hot-reload automatically.


## 5. Start the frontend

`
cd frontend
npm run dev
`

The dashboard is live at **http://localhost:5173**. Vite proxies
/api/v1 and /socket.io to the backend at localhost:3000 -- no CORS
issues in development.

### First-time flow

1. Open http://localhost:5173
2. Click "Create an account" -- register with email + password
3. You'll be redirected to the dashboard (empty until you connect a device)
4. Settings page: /settings (update profile, change password, set PIN)

## 6. Android app

### Emulator setup

The debug build targets http://10.0.2.2:3000/ which routes to your
host machine's localhost:3000 from the Android emulator.

1. Open the project in Android Studio (open the root kavach/ folder)
2. Sync Gradle (Build > Rebuild Project)
3. Create an AVD: Pixel 7, API 34, x86_64
4. Start the emulator
5. Run: ./gradlew :app:assembleDebug (or use Android Studio's Run button)

### On-device flow

1. Open Kavach
2. Login with the same email/password you registered on the web
3. Follow onboarding: child name > device name > PIN > permissions
4. Permissions needed: Usage Stats, Device Admin, Notifications,
   Location (fine + background), Call Screening

### Building release

`
./gradlew :app:assembleRelease \
  -PAPI_BASE_URL=https://your-api-domain.com/ \
  -PKAVACH_PINS="sha256/...,sha256/..."
`

Certificate pinning is mandatory in release builds. Supply the
production SHA-256 pin set via -PKAVACH_PINS.

## 7. Testing

### Backend (643 tests)

`
cd backend

# Full suite (unit + integration)
npm test

# Unit tests only (no DB needed)
npm run test:unit

# Integration tests only (requires running DB)
npm run test:integration

# Type-check
npx tsc --noEmit
`

Tests use Jest with pg-mem (in-memory PostgreSQL) for unit tests and
a real PostgreSQL for integration tests. No external services needed
for 
pm test.

### Frontend (515 tests)

`
cd frontend

# Run all tests
npm test

# Type-check
npx tsc --noEmit

# Build (includes type-check)
npm run build

# Lint
npm run lint
`

Tests use Vitest with jsdom environment and @testing-library/react.

### Android (17 test files)

`
# From repo root
./gradlew :app:assembleDebug :app:testDebugUnitTest --console=plain
`

Tests use JUnit4 + Mockito. No emulator needed for unit tests.

### CI

CI runs automatically on push/PR to main (.github/workflows/ci.yml):
- Backend: 
pm ci && npm run build && npm test --silent
- Frontend: 
pm ci && npm run build && npm run lint && npm test
- Android: ssembleDebug + testDebugUnitTest

## 8. Architecture overview

`
+---------------+     +---------------+     +---------------+
|   Frontend    |---->|    Backend    |---->|  PostgreSQL   |
|  React/Vite   |     | Express/TS    |     |  (port 5432)  |
|  (port 5173)  |     |  (port 3000)  |     +---------------+
+---------------+     +-------+-------+
        |                     |
        | proxy               | Socket.IO
        | /api/v1             | /socket.io
        v                     v
  (same origin)         +-----------+
                        |  Android  |
                        |  Device   |
                        +-----------+
`

- **Frontend** talks to the backend exclusively via /api/v1 (REST) and
  /socket.io (realtime rules). Both are proxied by Vite in development.
- **Backend** stores everything in PostgreSQL. JWT tokens (access +
  rotating refresh) authenticate all requests. The access token is
  accepted as either a Bearer header (Android) or an httpOnly cookie
  (web dashboard).
- **Android** polls the backend for rules, records screen time + GPS
  locally, and uploads in batches. A foreground service enforces blocks
  and locks in real time.

## 9. Project structure

`
backend/
  src/
    modules/        # Feature modules (auth, children, devices, appblocking, ...)
      *.routes.ts   # Express routes
      *.controller.ts
      *.service.ts
      *.dto.ts      # Zod validation schemas
      __tests__/    # Unit + integration tests
    middleware/      # Auth, rate limiting, validation, error handling
    jobs/           # Scheduled tasks (data retention, token purge)
    config/         # Database, Redis connections
  db/migrations/    # SQL migrations (001-027, auto-applied by docker compose)
  openapi.yaml      # OpenAPI 3.0 spec (served at /api/docs)

frontend/
  src/
    pages/          # Route-level components (Login, Register, Dashboard, Settings, ...)
    components/     # Reusable UI (dashboard/, ui/, auth/)
    hooks/          # Custom hooks (useAuth, useChildrenData, usePhase1Data, ...)
    services/       # API client, session management
    store/          # Redux (authSlice)
    types/          # TypeScript interfaces

android/
  android/app/src/main/java/com/safeguard/parentalcontrol/
    data/           # Remote (Retrofit/Socket.IO) + Local (Room) + repositories
    service/        # Foreground services (app blocking, location, call screening)
    security/       # Tamper detection, device admin
    viewmodel/      # ViewModels per feature
    ui/screens/     # Compose screens (onboarding, dashboard, settings)
  src/test/         # JUnit4 unit tests
  src/androidTest/  # Instrumentation tests
`

## 10. Common tasks

### Adding a new API endpoint

1. Define a Zod schema in the module's dto.ts
2. Implement the service method in service.ts
3. Add a controller handler in controller.ts
4. Wire the route in outes.ts with alidate() and alidateParams() middleware
5. Import the route in pp.ts and mount it
6. Write integration tests in __tests__/
7. Update openapi.yaml and docs/API.md

### Adding a new frontend page

1. Create the page component in src/pages/
2. Add a route in App.tsx (inside <ProtectedRoute> if auth required)
3. Add navigation link if needed (Header, Settings)
4. Write tests in a co-located .test.tsx file

### Adding a new Android screen

1. Create the Composable in ui/screens/
2. Add navigation in the NavHost
3. Create a ViewModel in iewmodel/
4. Wire data layer (repository method, API call if needed)
5. Write unit tests for the ViewModel

---

**End of Developer Guide**
