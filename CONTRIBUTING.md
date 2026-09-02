# Contributing to Kavach

Thank you for your interest in contributing to Kavach! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+ (optional — dev server uses pg-mem by default)
- **Android Studio** (for Android development)
- **JDK 17**

### Quick Start (Zero Config)

The fastest way to get running — no database setup needed:

```bash
git clone https://github.com/your-org/kavach.git
cd kavach
npm install
npm run dev
```

This starts the dev server on `http://localhost:3000` with an in-memory PostgreSQL database and demo seed data.

### Development Setup (With Database)

If you prefer a real PostgreSQL database:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/kavach.git
   cd kavach
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```

   The server starts on port 3000 and serves both the API and frontend.

### Frontend-Only Development

To run the frontend separately with hot reload:

```bash
cd frontend
npm install
npm run dev
```

This starts Vite on port 5173 with a proxy to the backend on port 3000.

### Backend-Only Development

```bash
cd backend
npm install
npm run dev
```

### Android Setup
- Open `android/` in Android Studio
- Sync Gradle
- Run on device/emulator

## Project Structure

```
kavach/
├── .env.example        # Environment variable template
├── package.json        # Root monorepo config
├── scripts/
│   └── dev-server.ts   # Dev server (serves API + frontend)
├── backend/            # Node.js/Express REST API
│   ├── src/
│   │   ├── modules/    # Feature modules (auth, children, location, etc.)
│   │   ├── middleware/  # Auth, tenant guard, rate limiting, CSP
│   │   ├── db/         # Migrations and seeds
│   │   ├── jobs/       # Scheduled tasks (data retention, cleanup)
│   │   └── workers/    # Background workers (telemetry)
│   └── __tests__/      # Integration tests
├── frontend/           # React + Vite SPA
│   ├── eslint.config.js
│   ├── vite.config.ts
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   └── e2e/            # Playwright E2E tests
├── android/            # Android (Kotlin/Jetpack Compose)
│   ├── metadata.json
│   └── app/src/main/java/com/safeguard/parentalcontrol/
├── admin-panel/        # Admin React app (Vite)
├── deploy/             # Deployment configs (Docker, nginx)
├── docs/               # Documentation
└── loadtest/           # Load testing scripts
```

## Available Scripts

### Root (`npm run ...` from project root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (API + frontend on port 3000) |
| `npm run build` | Build frontend + bundle server for production |
| `npm start` | Start production server |
| `npm run build:frontend` | Build frontend only |
| `npm run lint` | Lint frontend TypeScript/React code |

### Backend (`cd backend && npm run ...`)

| Script | Description |
|--------|-------------|
| `npm test` | Run all backend tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run dev` | Start backend only (ts-node-dev) |

### Frontend (`cd frontend && npm run ...`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | TypeScript check + Vite build |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Lint frontend code |

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Write or update tests
4. Run the test suite: `npm test` (backend and frontend)
5. Run linting: `npm run lint`
6. Submit a pull request

## Code Style

### Backend (TypeScript)
- Use strict TypeScript
- Follow existing module patterns (service + controller + routes + DTO)
- All route handlers use `try/catch` with `next(err)`
- Validate inputs with Zod schemas
- Write tests for new modules
- Use the `respond()` helper for consistent API responses

### Frontend (TypeScript/React)
- Use functional components with hooks
- Follow existing component patterns
- Use Tailwind CSS for styling
- Add dark mode support (`dark:` variants)
- Write tests for new components and hooks

### Android (Kotlin)
- Use Jetpack Compose for UI
- Follow MVVM architecture
- Use Hilt for dependency injection
- Write unit tests for ViewModels and repositories

## Testing

### Backend
```bash
cd backend
npm test                    # Run all tests (644 tests, 58 suites, 22 skipped)
npm run test:watch          # Watch mode
npx jest --testPathPattern=auth  # Run specific test suite
```

### Frontend
```bash
cd frontend
npx vitest run              # Run all tests (515 tests, 75 files)
npx vitest run --watch      # Watch mode
```

### Load Testing (k6)
```bash
cd loadtest
k6 run auth-load-test.js              # Auth endpoint load test
k6 run telemetry-load-test.js         # Telemetry ingestion load test
k6 run geofence-load-test.js          # Geofence checking load test
```

### Android
```bash
./gradlew testDebugUnitTest  # Unit tests
./gradlew connectedDebugAndroidTest  # Instrumentation tests
```

## Environment Variables

See `.env.example` at the project root for all variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No* | PostgreSQL connection string (*uses pg-mem if absent) |
| `JWT_SECRET` | No** | Secret for JWT signing (**auto-generated in dev) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID (enables Google sign-in) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `REDIS_URL` | No | Redis connection for telemetry pipeline and Socket.IO |
| `FIREBASE_PROJECT_ID` | No | Firebase for push notifications |
| `RAZORPAY_KEY_ID` | No | Razorpay for payments |

## Architecture Highlights

- **Tenant Guard Middleware** — Prevents BOLA/IDOR attacks by verifying resource ownership
- **Audit Log Hash Chain** — Cryptographic integrity for audit trails (SHA-256)
- **Aho-Corasick Scanner** — Real-time content filtering for cyberbullying detection
- **Telemetry Pipeline** — Redis Streams for location data ingestion
- **Offline-First Rules** — Android enforces app blocking even without connectivity (IndexedDB)
- **Kalman Filter** — GPS noise reduction with accuracy thresholds
- **ECDH Key Exchange** — Secure QR code device pairing with StrongBox-backed keys
- **SMS Fallback** — Emergency SMS delivery when push notifications fail
- **Kiosk Mode** — Full-screen lockout for scheduled locks and screen time limits
- **Redis Pub/Sub Adapter** — Socket.IO horizontal scaling for multi-instance deployments
- **Zero-Cost Maps** — React-Leaflet + OpenStreetMap (no external API keys required)
- **Prometheus Metrics** — `GET /metrics` endpoint for monitoring integration

## Pull Request Guidelines

- Write clear commit messages
- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Ensure all CI checks pass

## Reporting Issues

- Use GitHub Issues for bug reports
- Include steps to reproduce
- Include environment details (OS, browser, app version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
