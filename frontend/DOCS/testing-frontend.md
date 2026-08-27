# Frontend Test Coverage Documentation

## Test Coverage Improvements

This document summarizes the test coverage improvements added to the Kavach frontend codebase.

### Test Files Created

#### Hook Tests

1. useSos.test.tsx - Tests for the SOS hook:
   - useSosEvents - fetches SOS events, handles null childId
   - useAcknowledgeSos - mutation interface, calls acknowledgeSos API
   - useResolveSos - mutation with and without notes

2. useGeofencing.test.tsx - Tests for the geofencing hooks:
   - useGeofences - fetches geofences, handles null childId
   - useCreateGeofence - mutation interface, calls createGeofence API
   - useUpdateGeofence - mutation interface, calls updateGeofence API
   - useDeleteGeofence - mutation interface, calls deleteGeofence API

3. useMood.test.tsx - Tests for the mood hooks:
   - useMoodLogs - fetches mood logs, handles null childId
   - useMoodSummary - fetches mood summary, handles null childId

4. useRewards.test.tsx - Tests for the rewards hooks:
   - useRewardCatalog - fetches reward catalog
   - useCreateRewardItem - mutation interface, calls createRewardItem API
   - useRewardPoints - fetches reward points, handles null childId
   - useAwardPoints - mutation interface, calls awardPoints API
   - useRedemptions - fetches redemptions, handles null childId
   - useRedeemReward - mutation interface, calls redeemReward API

5. useUrlFilters.test.tsx - Tests for the URL filters hooks:
   - useUrlFilters - fetches URL filters, handles null childId
   - useCreateUrlFilter - mutation interface, calls createUrlFilter API
   - useUpdateUrlFilter - mutation interface, calls updateUrlFilter API
   - useDeleteUrlFilter - mutation interface, calls deleteUrlFilter API

#### Page Tests

6. SOSPage.test.tsx - Tests for the SOS page:
   - Renders with loading state
   - Displays SOS events when fetched

7. GeofencePage.test.tsx - Tests for the geofence page:
   - Renders with loading state
   - Displays geofences when fetched

8. RewardsPage.test.tsx - Tests for the rewards page:
   - Renders with loading state
   - Displays reward catalog when fetched

9. VoiceCommandsPage.test.tsx - Tests for the voice commands page:
   - Renders with loading state
   - Displays voice commands when fetched

10. DashboardPage.test.tsx - Tests for the dashboard page:
    - Renders header with application name
    - Renders child selector
    - Renders main content area
    - Shows loading state when no child selected

11. SettingsPage.test.tsx - Tests for the settings page:
    - Renders profile section
    - Renders change password section
    - Renders PIN section
    - Renders danger zone section
    - Renders confirm dialog for sign out all

#### API Service Tests

12. api.test.ts - Updated with:
    - Auth token refresh tests (401 handling, refresh failure)
    - Error handling tests (network errors, 403 forbidden, missing token)

### Configuration Updates

#### vitest.config.ts

Added coverage reporting configuration:
- Provider: v8
- Reporters: text, json, html
- Coverage directory: coverage
- Default thresholds: 70% for branches, functions, lines, and statements

### Test Execution

Run all tests:
\\\ash
npm test
# or
vitest run
\\\

Run tests with coverage:
\\\ash
vitest run --coverage
\\\

Coverage report will be generated in the coverage/ directory.

### Test Patterns Used

All tests follow these patterns:
- vitest as the test runner with jsdom environment
- React Testing Library for rendering components
- QueryClientProvider from @tanstack/react-query for hook testing
- Mock API functions using vi.mock
- act() from @testing-library/react for async state updates
- beforeEach with vi.clearAllMocks() to reset between tests
- Wrap providers: QueryClientProvider, Provider (Redux), MemoryRouter (React Router)
