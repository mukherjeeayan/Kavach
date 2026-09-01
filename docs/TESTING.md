# Testing Guide

## Quick Reference

```bash
# Backend
cd backend
npm test           # Run all 643 tests (58 suites)
npm run test:unit  # Unit tests only
npm run test:integration  # Integration tests (requires DB)

# Frontend
cd frontend
npx vitest run          # Run all 515 tests (75 files)
npx vitest run --watch  # Watch mode
npx vitest run --coverage  # With coverage report

# Android
cd android
./gradlew :app:testDebugUnitTest  # Run Android unit tests
```

## Backend Tests (643 tests)

The backend has **643 tests** across **58 test suites** (1 skipped). All tests use **Jest** as the test framework, **pg-mem** for in-memory database emulation, and **supertest** for HTTP integration tests.

### Module Coverage

| Module | Tests | Key Features |
|--------|-------|--------------|
| Auth | — | Login, register, 2FA, getMe, refreshAccessToken |
| Children | — | CRUD, parent verification |
| Device Health | 7 | Health monitoring, rooted device detection |
| Geo | 27 | Geofence CRUD, entry/exit alerts |
| Integrations | 21 | Sync, audit logging |
| URL Filter | 20 | Rule CRUD, active filtering |
| App Blocking | — | Rule CRUD, device sync |
| Screen Time | — | Usage tracking, daily limits |
| Location | — | GPS pings, history, current location |
| Contacts | — | Contact rules, sync |
| Communication | — | SMS/call monitoring, cyberbullying |
| Mood | — | Mood logging, daily check-ins |
| Self-Harm | — | Keyword detection, critical alerts |
| Rewards | — | Points, catalog, redemptions |
| Predictions | — | Behavior predictions, risk scoring |
| Security | — | Tamper, root detection |
| Voice Commands | — | Command parsing, execution |
| SOS | — | Emergency alerts, acknowledge |
| Analytics | — | Usage analytics, dashboard data |
| Statistics | — | Aggregated statistics |
| Reports | — | Weekly AI report generation |
| Settings | — | Profile updates, PIN management |
| Devices | — | Registration, heartbeat, pairing |
| Consent | — | Parental consent tracking |
| Notifications | — | Push notification management |
| Admin | 24 | System stats, user management |
| Subscription | 20 | Plans, Razorpay, webhooks |

### Test Pattern Summary

All service tests follow a consistent pattern:

1. **Mock the database:** `jest.mock('../../../config/database', () => ({ query: jest.fn() }))`
2. **Mock dependent services:** Children service and audit service are mocked
3. **Use descriptive test constants:** PARENT_ID, CHILD_ID, DEVICE_ID at module level
4. **Before each test:** `jest.clearAllMocks()` resets mock state
5. **Test structure:** `describe('serviceName') > describe('methodName') > it('description')`
6. **Assertions:** Verify returned values, mock calls, error throws, audit logs

### Modules List (by test count)

- Auth: ~60 tests
- Children: ~30 tests
- Geo: 27 tests
- Integrations: 21 tests
- URL Filter: 20 tests
- Subscription: 20 tests
- Admin: 24 tests
- Settings: ~10 tests
- Notifications: ~10 tests
- Predictions: ~10 tests
- ~~All other modules each have 1–9 tests~~

## Frontend Tests (515 tests)

The frontend has **515 tests** across **75 test files**. All tests use **Vitest** with jsdom environment and **@testing-library/react**.

### Test Commands

```bash
npx vitest run              # Run all tests
npx vitest run --watch      # Watch mode
npx vitest run --coverage   # With coverage report (70% threshold)
npm run lint                # Lint check
npm run build               # Build (includes type-check)
```

### Test File Breakdown

#### Hook Tests (20 files)

| Hook | Tests | Description |
|------|-------|-------------|
| `useAnalytics` | 8 | Usage analytics, dashboard data |
| `useAuth` | 5 | Authentication state, login/logout |
| `useChildrenData` | 9 | Child data fetching, selection |
| `useCommunications` | 7 | SMS/call log monitoring |
| `useDashboardActions` | 9 | Dashboard action handlers |
| `useDeviceHealth` | 7 | Device health monitoring |
| `useGeofencing` | 9 | Geofence CRUD, detection |
| `useIntegrations` | 8 | Integration management |
| `useKeywords` | 7 | Keyword alert management |
| `useMood` | 6 | Mood logging, summary |
| `useNotifications` | 7 | Push notification management |
| `usePhase1Data` | 15 | Phase 1 feature data |
| `usePredictions` | 9 | Behavior predictions |
| `useRealtimeRules` | 6 | Socket.IO realtime rules |
| `useRewards` | 14 | Rewards, points, redemptions |
| `useSelfHarmAlerts` | 8 | Self-harm keyword detection |
| `useSettings` | 5 | Profile, PIN, password |
| `useSos` | 8 | Emergency SOS alerts |
| `useUrlFilters` | 9 | URL filter rules |
| `useVoiceCommands` | 5 | Voice command execution |

#### Component Tests (28 files)

| Component | Tests | Description |
|-----------|-------|-------------|
| `AlertsSection` | 10 | Alert list, filtering |
| `AnalyticsSection` | 3 | Usage analytics charts |
| `BehaviorPredictionSection` | 9 | AI behavior insights |
| `BlockAppForm` | 4 | App blocking form |
| `BlockedAppsTable` | 2 | Blocked apps list |
| `ChildSelector` | 7 | Child selection dropdown |
| `CommunicationSection` | 6 | SMS/call monitoring |
| `ContactsSection` | 4 | Contact rules |
| `DeviceHealthSection` | 12 | Device health gauges |
| `DeviceList` | 5 | Device listing |
| `EmergencySOS` | 5 | SOS button, alerts |
| `GeofenceSection` | 5 | Geofence map, list |
| `GeofenceSection.edit` | 4 | Geofence create/edit |
| `Header` | 4 | Navigation, subscription link |
| `IntegrationsSection` | 4 | Integration management |
| `KeywordAlertsSection` | 8 | Keyword alerts |
| `KeywordDictionarySection` | 8 | Keyword dictionary |
| `LocationMap` | 4 | Location map display |
| `LocationsSection` | 4 | Location history |
| `LocksSection` | 4 | Scheduled locks |
| `MoodTrackingSection` | 6 | Mood check-in, history |
| `RewardSection` | 14 | Rewards, points |
| `RewardSection.redemption` | 4 | Reward redemption |
| `ScreenTimeChart` | 8 | Screen time charts |
| `ScreenTimeSection` | 15 | Screen time management |
| `SecuritySection` | 10 | Security status |
| `SelfHarmAlertsSection` | 4 | Self-harm alerts |
| `UnblockRequests` | 4 | Unblock request list |
| `VoiceCommandsSection` | 4 | Voice commands |
| `WebsiteFilterSection` | 12 | URL filter rules |
| `WebsiteFilterSection.edit` | 4 | URL filter edit |

#### UI Component Tests (3 files)

| Component | Tests | Description |
|---------|-------|-------------|
| `ConfirmDialog` | 12 | Confirmation dialog |
| `ErrorBoundary` | 9 | Error boundary |
| `PremiumLockOverlay` | 6 | Premium feature gating |

#### Page Tests (17 files)

| Page | Tests | Description |
|------|-------|-------------|
| `AdminDashboard` | 4 | Admin panel |
| `AlertsPage` | 10 | Alerts management |
| `CommunicationsPage` | 5 | Communication monitoring |
| `DashboardPage` | 4 | Main dashboard |
| `ForgotPasswordPage` | 8 | Password reset |
| `GeofencePage` | 2 | Geofence management |
| `LoginPage` | 8 | Login form |
| `ManageChildPage` | 5 | Child profile management |
| `NotFoundPage` | 3 | 404 page |
| `NotificationsPage` | 9 | Notification management |
| `RegisterPage` | 9 | Registration form |
| `ReportsPage` | 4 | Weekly reports |
| `ResetPasswordPage` | 14 | Password reset flow |
| `RewardsPage` | 2 | Rewards catalog |
| `SettingsPage` | 8 | Settings management |
| `SOSPage` | 2 | SOS events |
| `SubscriptionPage` | 5 | Subscription management |
| `VoiceCommandsPage` | 2 | Voice commands |

#### Service Tests (2 files)

| Service | Tests | Description |
|---------|-------|-------------|
| `api.test.ts` | 9 | API client, auth refresh, error handling |
| `apiClient.test.ts` | 11 | HTTP client, interceptors |

#### Store Tests (1 file)

| Store | Tests | Description |
|-------|-------|-------------|
| `authSlice.test.ts` | 6 | Auth state, selectors |

### Configuration

- **Framework:** Vitest with jsdom environment
- **Coverage:** v8 provider, 70% threshold for branches/functions/lines/statements
- **Libraries:** @testing-library/react, @testing-library/jest-dom
- **Providers:** QueryClientProvider, Redux Provider, MemoryRouter

### Test Patterns

- vitest as the test runner with jsdom environment
- React Testing Library for rendering components
- QueryClientProvider from @tanstack/react-query for hook testing
- Mock API functions using vi.mock
- act() from @testing-library/react for async state updates
- beforeEach with vi.clearAllMocks() to reset between tests
- Wrap providers: QueryClientProvider, Provider (Redux), MemoryRouter (React Router)

## Android Tests

### Unit Tests (14 test files)

Covering viewmodels, repositories, services, and detectors across:
- Settings (Change PIN, Onboarding)
- Security (Self-harm, Keylogger, Behavior Prediction)
- Device UI (Screen time, Locks, Location, Contacts)
- Phase1 repository, App blocking, Screen time/Lock preferences

### Instrumentation Tests (1 file)

| Feature | Test File | Package |
|---------|-----------|---------|
| Parent lock screen | `ParentLockScreenTest.kt` | `ui.screens.parentlock` |

### Permission Review

- **Removed** `android.permission.GET_TASKS` – deprecated
- **Removed** `android.permission.READ_CALL_LOG` – not required

### CI Configuration

```bash
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

The `testOptions` block in `android/app/build.gradle.kts` ensures Android resources are packaged for instrumentation.

### Re-using Existing Test Patterns

Copy `ParentLockScreenTest.kt` imports, `@get:Rule` declaration, and `newPinStore()` / context-provider pattern, then replace screen-specific components.