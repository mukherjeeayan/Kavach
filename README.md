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
- **Get emergency alerts** — If they tap the SOS button, you get notified instantly
- **Track mood** — Kids can log how they're feeling each day
- **Detect self-harm keywords** — Critical alerts for concerning behavior
- **Voice commands** — Control features hands-free
- **Keyword alerts** — Real-time notifications for flagged content

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
| **SOS** | Dual-channel emergency alerts (FCM high-priority + APNs critical) |
| **Voice Commands** | Hands-free feature control |
| **Keyword Alerts** | Real-time notifications for flagged content |
| **Weekly AI Reports** | Comprehensive weekly summaries with insights |
| **Multi-Guardian** | Share monitoring with co-guardians |
| **Admin Panel** | User management and feature flags |
| **Google OAuth** | Sign in with Google (demo mode available without credentials) |

## Subscription & Payments

Kavach uses **Razorpay** for web-based payment processing:
- **7-day free trial** for new users
- **Monthly and yearly plans** available
- **Three tiers**: FREE, TRIAL, PREMIUM
- Premium features are gated behind subscription tiers
- No Google Play Store billing — all payments handled via the web dashboard

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Mobile:** Kotlin + Jetpack Compose (Android)
- **Database:** PostgreSQL (with pg-mem for zero-config dev)
- **Cache:** Redis ( Streams for telemetry pipeline)
- **Real-time:** Socket.IO
- **Auth:** JWT + Google OAuth
- **Deployment:** Docker + Docker Compose
- **CI/CD:** GitHub Actions

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
│   │   ├── db/         # Migrations and seeds
│   │   ├── jobs/       # Scheduled tasks
│   │   └── workers/    # Background workers (telemetry)
│   └── __tests__/      # Integration tests
├── frontend/           # React + Vite SPA
│   ├── eslint.config.js
│   ├── vite.config.ts
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   └── e2e/            # Playwright E2E tests
├── android/            # Android (Kotlin/Jetpack Compose)
├── admin-panel/        # Admin React app (Vite)
├── deploy/             # Deployment configs (Docker, nginx)
├── docs/               # Documentation
└── loadtest/           # Load testing scripts
```

## Testing

- **Backend:** 644 tests across 58 test suites (Jest)
- **Frontend:** Unit tests (Vitest) + E2E tests (Playwright)

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npx vitest run

# Lint
npm run lint
```

## Deployment

Kavach supports multiple deployment options:
- **Docker Compose** — Development and production environments
- **AWS ECS Fargate** — Scalable cloud deployment
- **Kubernetes** — Container orchestration

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional, enables demo mode) |
| `REDIS_URL` | Redis connection string (optional, enables caching) |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications |

## License

MIT License

---

*Kavach: Because every kid deserves to explore safely.*
