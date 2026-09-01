# Frontend Test Coverage Documentation

## Overview

The frontend has **515 tests** across **75 test files**. All tests use **Vitest** with jsdom environment and **@testing-library/react**.

## Test Commands

```bash
npx vitest run              # Run all tests
npx vitest run --watch      # Watch mode
npx vitest run --coverage   # With coverage report
npx tsc --noEmit            # Type-check
npm run build               # Build (includes type-check)
npm run lint                # Lint
```

## Test Files

### Hook Tests (20 files)

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

### Component Tests (28 files)

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

### UI Component Tests (3 files)

| Component | Tests | Description |
|-----------|-------|-------------|
| `ConfirmDialog` | 12 | Confirmation dialog |
| `ErrorBoundary` | 9 | Error boundary |
| `PremiumLockOverlay` | 6 | Premium feature gating |

### Page Tests (17 files)

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

### Service Tests (2 files)

| Service | Tests | Description |
|---------|-------|-------------|
| `api.test.ts` | 9 | API client, auth refresh, error handling |
| `apiClient.test.ts` | 11 | HTTP client, interceptors |

### Store Tests (1 file)

| Store | Tests | Description |
|-------|-------|-------------|
| `authSlice.test.ts` | 6 | Auth state, selectors |

## Configuration

- **Framework:** Vitest with jsdom environment
- **Coverage:** v8 provider, 70% threshold for branches/functions/lines/statements
- **Libraries:** @testing-library/react, @testing-library/jest-dom
- **Providers:** QueryClientProvider, Redux Provider, MemoryRouter

## Test Patterns

All tests follow these patterns:
- vitest as the test runner with jsdom environment
- React Testing Library for rendering components
- QueryClientProvider from @tanstack/react-query for hook testing
- Mock API functions using vi.mock
- act() from @testing-library/react for async state updates
- beforeEach with vi.clearAllMocks() to reset between tests
- Wrap providers: QueryClientProvider, Provider (Redux), MemoryRouter (React Router)
