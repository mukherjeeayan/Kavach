# Changelog

All notable changes to the Kavach parental control platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Admin dashboard with system stats, user management, and feature flags
- Subscription management with Razorpay payment integration
- 7-day free trial for new users
- Premium feature gating with tier-based access control (FREE / TRIAL / PREMIUM)
- PremiumLockOverlay component for blurred content with upgrade prompts
- Subscription tier display in dashboard header with upgrade link
- Dark mode support across all pages including Settings
- Screen time analytics gated for TRIAL tier users
- Backend subscription middleware (requirePremium) on all premium routes
- Trial expiry background job (daily scheduler)
- Refresh token now preserves subscription context
- Tests for AdminDashboard, SubscriptionPage, and PremiumLockOverlay
- **AI Provider Settings** — Users can connect their own AI provider (OpenAI, Gemini, Anthropic) with encrypted API key storage
- **AI-powered Weekly Reports** — Reports include AI-generated narrative summaries when a provider is configured
- **AI-powered Behavior Insights** — Predictions include contextual AI insights
- **Model Discovery** — Fetch available models directly from each provider's API
- **AI Settings in Registration** — Optional AI provider setup during account registration
- **AI Settings Page** — `/ai-settings` route with provider selection, masked key display, and update flow
- **Backend AI module** — Multi-provider AI service abstraction with OpenAI/Gemini/Anthropic adapters
- **Backend AI settings module** — CRUD for provider settings with AES-256-GCM encrypted key storage
- **ECDH Key Exchange** — Ephemeral ECDH P-256 key pairs for secure QR code device pairing
- **QR Code Device Pairing** — Web dashboard generates QR codes with ephemeral public keys for pairing child devices
- **Offline Rule Sync** — IndexedDB-based offline policy caching for rule enforcement without internet
- **Push Notification Actions** — Lock-screen approve/deny buttons for unblock requests
- **Service Worker** — Push notification handling with action buttons
- **SMS Fallback for SOS** — Emergency SMS delivery when FCM push notifications fail
- **Kiosk Mode Activity** — Full-screen lockout for scheduled locks and screen time limits
- **Redis Pub/Sub Adapter for Socket.IO** — Horizontal scaling support for real-time events
- **AWS ECS Fargate Deployment** — CloudFormation template, task definition, and service definition
- **Kubernetes Manifests** — Complete deployment manifests for any K8s cluster
- **Oracle Cloud Always-Free Deployment** — Zero-cost deployment on Oracle Cloud ARM instances
- **Prometheus Metrics Endpoint** — `GET /metrics` for monitoring integration
- **Grafana Dashboard** — Auto-provisioned monitoring dashboards
- **Uptime Kuma** — Self-hosted uptime monitoring
- **Load Test Scripts** — k6 load tests for auth, telemetry, and geofence endpoints
- **Offline Policy API** — `GET /children/:childId/offline-policy` for device sync
- **Audit Chain Verification** — `GET /admin/audit/verify` for tamper-proof audit integrity checks
- **Device Public Key Registration** — `POST /devices/:deviceId/public-key` for ECDH key storage
- **Web Crypto API** — Frontend ECDH, AES-256-GCM, ECDSA, HKDF cryptographic utilities
- **Zero-Cost Maps** — React-Leaflet + OpenStreetMap (removed Mapbox dependency)
- **Tenant Guard on Device Routes** — Ownership verification on screentime device endpoints
- **Cryptographic Key Deletion** — Keystore cleanup on account logout

### Fixed
- Critical: PremiumLockOverlay now correctly enforces tier access (TRIAL users cannot see PREMIUM features)
- Token refresh no longer loses subscription tier context
- Settings page now has full dark mode support
- Admin dashboard table now scrolls horizontally on mobile
- Header test mock for subscription tier
- SecureGuardDeviceAdminReceiver → SafeGuardDeviceAdminReceiver naming fix
- Frontend QR pairing endpoint corrected to `/auth/provisioning-qr`
- Frontend push token endpoint corrected to `/auth/push-token`
- LocationService Android 14+ foreground service type fix
- All 17 test failures resolved (bcryptjs mock fixes across 7+ test files)
- Root-level Jest test failures (tests run correctly from `backend/` directory)
- Phase2RepositoryImpl missing SmsFallbackService DI
- Phase2Api routes missing /api/v1 prefix
- SQLCipher 3.x to 4.x import fix
- PIN hashing upgraded to PBKDF2
- AppBlockingService Android 14+ FGS type
- GeofenceService Android 14+ FGS type
- VoiceCommandService Android 14+ FGS type
- UrlFilterService Android 14+ FGS type
- Frontend LocationMap test fix
- ApiClient path duplication fix
- offlineRuleSync using apiClient
- Sentry integration in ErrorBoundary
- Reducer clearSession on 401
- Added VoiceCommandDao, RewardPointsDao, IntegrationConfigDao
- Fixed Room KSP schema config
- Fixed billing dependency config
- Encrypted ScreenTimeLimitPreferences
- Added certificate pinning to AuthInterceptor refresh client

### Changed
- Razorpay is now the sole payment gateway (Stripe and Google Play removed)
- Subscription upgrade link added to dashboard header navigation
- React-Leaflet + OpenStreetMap replaces Mapbox for map rendering
- Socket.IO reconnection uses exponential backoff with jitter
- Dev entry point moved from `server.ts` to `scripts/dev-server.ts`
- Web Crypto API uses ECDH P-256 (not X25519) for browser compatibility

### Documentation
- Consolidated docs: TESTING.md (merged BACKEND_TESTING, FRONTEND_TESTING, ANDROID_TESTING, MANUAL_TESTING_RUNBOOK)
- Consolidated docs: DEPLOYMENT.md (merged DEPLOYMENT, DEPLOYMENT_GUIDE, QUICK_START)
- Consolidated docs: SECURITY.md (merged SECURITY, SECURITY_AUDIT, BACKEND_SECURITY)
- Consolidated docs: LEGAL.md (merged PRIVACY_POLICY, TERMS_OF_SERVICE, DPDP_COMPLIANCE_AUDIT)
- Added AI endpoints to API.md
- Updated test counts in README and docs

## [0.1.0] - 2026-08-01

### Added
- Initial release
- Backend: 31 feature modules with REST API
- Frontend: React dashboard with 17 pages
- Android: Kotlin/Jetpack Compose app with 18 screens
- PostgreSQL database with 21 migrations
- Docker deployment (dev + production)
- CI pipeline with GitHub Actions
- OpenAPI documentation
- Comprehensive test suites (backend: 643 tests, frontend: 515 tests)
