# Kavach: Your Digital Bodyguard

## What is this app?
Kavach is a **parental control platform** that helps parents keep kids safe online. Think of it like a digital bodyguard for your phone or tablet!

## For Parents
As a parent, you can:

- **Block apps** — Stop kids from opening games or apps too much
- **Set screen time limits** — Like a timer for how long they can use the tablet
- **Track location** — Know where your child is (with their permission!)
- **Set safe zones** — Get alerts when they leave the park or school area
- **Monitor communications** — SMS and call monitoring with cyberbullying detection
- **Filter websites** — Block inappropriate content automatically
- **Get AI-powered insights** — Behavior predictions and weekly AI reports
- **Get emergency alerts** — If they tap the SOS button, you get notified instantly (with SMS fallback)
- **Track mood** — Kids can log how they're feeling each day
- **Detect self-harm keywords** — Critical alerts for concerning behavior
- **Voice commands** — Control features hands-free
- **Keyword alerts** — Real-time notifications for flagged content
- **Pair devices securely** — QR code pairing with ECDH key exchange
- **Enforce kiosk mode** — Full-screen lock during scheduled times
- **Offline enforcement** — Rules work even without internet connection

## For Kids (The Safe Part)
Kavach keeps you safe without being mean! You can:

- **Log your mood** — Pick an emoji that shows how you feel today
- **Use SOS button** — If something feels wrong, tap it and tell a parent
- **See geofences** — Virtual boundaries on a map (like an invisible fence)
- **Log screen time** — So parents can see balance, not just restrictions
- **Earn rewards** — Good behavior gets points toward fun stuff!

## Is it safe?
Yes! Kavach follows strict privacy rules and is built to be **COPPA and GDPR-K compliant**:
- Your data is encrypted (scrambled so only parents can read it)
- No data is sold to advertisers
- Parents can only see data about their own kid
- You can ask to delete your data anytime
- Strict access controls and rate-limiting are enforced on all actions

## How it works

1. **Parent sets it up** — Mom or Dad installs the app and creates an account
2. **Kid installs a companion app** — A simpler version goes on the kid's device
3. **Connect them** — Parent and kid link the devices
4. **Start protecting!** — Parents choose what rules to set

## Feature Overview

| Feature | What it does |
|---------|-------------|
| **Location Tracking** | Real-time GPS tracking with Kalman filter and accuracy thresholds |
| **Geofencing** | Safe zone alerts when entering/leaving areas |
| **Screen Time** | Daily limits and per-app usage caps |
| **App Blocking** | Prevents opening apps during homework time with lock-screen UX |
| **Communication Monitoring** | SMS/call monitoring with Aho-Corasick cyberbullying detection |
| **URL Filtering** | Blocks inappropriate websites automatically |
| **Behavior Predictions** | AI-powered insights into digital habits |
| **Self-Harm Detection** | Keyword-based critical alert system |
| **Mood Tracking** | Daily emoji check-in for emotional wellness |
| **Rewards** | Points-based system for good behavior |
| **SOS** | Dual-channel emergency alerts (push + SMS fallback) |
| **Voice Commands** | Hands-free feature control |
| **Keyword Alerts** | Real-time notifications for flagged content |
| **Weekly AI Reports** | Comprehensive weekly summaries with insights |
| **Multi-Guardian** | Share monitoring with co-guardians |
| **Admin Panel** | User management and feature flags |
| **Google OAuth** | Sign in with Google (demo mode available without credentials) |
| **QR Code Pairing** | Secure ECDH-based device pairing via QR code |
| **Kiosk Mode** | Full-screen lockout for scheduled locks and screen time limits |
| **Offline Rules** | Rule enforcement without internet connection (IndexedDB) |
| **Push Notifications** | Interactive lock-screen approve/deny actions |
| **SMS Fallback** | Emergency SMS delivery when push notifications fail |

## Subscription & Payments

Kavach uses **Razorpay** for web-based payment processing:
- **7-day free trial** for new users
- **Monthly and yearly plans** available
- **Three tiers**: FREE, TRIAL, PREMIUM
- Premium features are gated behind subscription tiers
- No Google Play Store billing — all payments handled via the web dashboard

See `.env.example` for plan IDs: `RAZORPAY_PLAN_MONTHLY`, `RAZORPAY_PLAN_YEARLY`

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Mobile:** Kotlin + Jetpack Compose (Android)
- **Database:** PostgreSQL 16 + PostGIS (with pg-mem for zero-config dev)
- **Cache:** Redis (Streams for telemetry + Pub/Sub for Socket.IO)
- **Real-time:** Socket.IO with Redis adapter
- **Maps:** React-Leaflet + OpenStreetMap (zero-cost)
- **Auth:** JWT + Google OAuth + 2FA (TOTP)
- **Monitoring:** Prometheus + Grafana + Sentry
- **Payments:** Razorpay
- **Deployment:** Docker + Docker Compose + ECS Fargate + Kubernetes

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/kavach.git
cd kavach
npm install

# Start dev server (backend + frontend on port 3000)
npm run dev
```

The dev server uses `pg-mem` (in-memory PostgreSQL) by default — no database setup required.

For production with a real database:
```bash
cp .env.example .env    # Edit with your DB credentials
npm run dev
```

## Project Structure

```
kavach/
├── .env.example        # Environment variable template
├── package.json        # Root monorepo config
├── scripts/
│   └── dev-server.ts   # Dev server entry point
├── backend/            # Node.js/Express REST API
│   ├── src/
│   │   ├── modules/    # Feature modules (auth, children, location, etc.)
│   │   ├── middleware/  # Auth, tenant guard, rate limiting, CSP
│   │   ├── config/    # Database, Redis, Sentry, metrics
│   │   ├── jobs/       # Scheduled tasks
│   │   └── workers/    # Background workers (telemetry)
│   └── db/            # Migrations
├── frontend/           # React + Vite SPA
│   ├── vite.config.ts
│   ├── src/
│   │   ├── pages/      # 18 page components
│   │   ├── components/ # 30+ UI components
│   │   ├── hooks/      # 23 custom hooks
│   │   ├── services/   # API clients
│   │   └── utils/      # Crypto, offline sync, push notifications
│   └── public/         # Static assets + service worker
├── android/            # Android (Kotlin/Jetpack Compose)
├── admin-panel/       # Admin React app (Vite)
├── deploy/            # Deployment configs (Docker, ECS, K8s, Oracle Cloud)
├── docs/              # Full documentation
├── loadtest/          # k6 load testing scripts
└── .github/          # GitHub Actions CI/CD
```

## Testing

- **Backend:** 644 tests across 58 test suites (Jest)
- **Frontend:** 513 tests across 75 test files (Vitest)
- **Load Testing:** 3 k6 scripts in `loadtest/` (auth, telemetry, geofence)

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npx vitest run

# Load tests (requires k6)
cd loadtest
k6 run auth-load-test.js

# Lint
cd backend && npm run lint
cd frontend && npm run lint
```

## Deployment

Kavach supports multiple deployment options:

### Option 1: Oracle Cloud Always-Free (Zero Cost)

Deploy on Oracle Cloud's Always Free tier — **$0.00/month** for 4 OCPUs, 24 GB RAM, 98 GB storage.

```bash
# On Oracle Cloud ARM instance (Ubuntu 22.04)
git clone https://github.com/your-org/kavach.git
cd kavach/deploy/oracle-cloud
chmod +x setup.sh
./setup.sh

# Edit .env with real secrets
nano ../.env.prod

# Start all services
docker compose -f ../docker-compose.prod.yml --env-file ../.env.prod up -d
```

Includes:
- PostgreSQL + PostGIS database
- Redis cache with Pub/Sub adapter for Socket.IO scaling
- Backend API server
- Frontend dashboard with OpenStreetMap
- Grafana + Prometheus (monitoring)
- Uptime Kuma (uptime monitoring)
- Certbot (auto-renew SSL)

### Option 2: Docker Compose (Single Server / Staging)

```bash
git clone https://github.com/your-org/kavach.git
cd kavach
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets
docker compose -f deploy/docker-compose.prod.yml --env-file .env.prod up -d
```

### Option 3: AWS ECS Fargate (Production)

See `deploy/ecs/` for CloudFormation template, task definition, and service configuration.

### Option 4: Kubernetes

See `deploy/kubernetes/` for complete manifests (namespace, secrets, postgres, redis, backend, frontend, ingress).

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `REDIS_URL` | Redis connection for telemetry and Socket.IO |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key |
| `DATA_ENCRYPTION_KEY` | AES-256 key for encrypting AI API keys |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `RAZORPAY_KEY_ID` | Razorpay payment key |
| `TWILIO_ACCOUNT_SID` | Twilio for SMS fallback |

## License

MIT License

---

*Kavach: Because every kid deserves to explore safely.*
