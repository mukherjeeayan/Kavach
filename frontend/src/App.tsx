import { type ReactElement, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useRole, useIsAdmin } from './store/authSlice';
import { Skeleton } from './components/ui/Skeleton';

// Lazy load page components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const ManageChildPage = lazy(() => import('./pages/ManageChildPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const CommunicationsPage = lazy(() => import('./pages/CommunicationsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const GeofencePage = lazy(() => import('./pages/GeofencePage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const SOSPage = lazy(() => import('./pages/SOSPage'));
const VoiceCommandsPage = lazy(() => import('./pages/VoiceCommandsPage'));
const ChildSetupScreen = lazy(() => import('./screens/ChildSetupScreen'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const AiSettingsPage = lazy(() => import('./pages/AiSettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-56" />
    </div>
  </div>
);

// Protected Route wrapper — checks the session flag. The access token
// lives in memory and the refresh token in an httpOnly cookie; a page
// reload silently restores the token via the cookie-based refresh.
// Role-protected route — only users with the required role can access
const RoleProtectedRoute = ({ role, children }: { role: 'parent' | 'child'; children: ReactElement }) => {
  const hasMatchingRole = useRole(role);

  if (!hasMatchingRole) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Admin-only route — only users with role='admin' can access
const AdminRoute = ({ children }: { children: ReactElement }) => {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <RoleProtectedRoute role="parent">
                      <DashboardPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleProtectedRoute role="parent">
                      <SettingsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/subscription"
                  element={
                    <RoleProtectedRoute role="parent">
                      <SubscriptionPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/ai-settings"
                  element={
                    <RoleProtectedRoute role="parent">
                      <AiSettingsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/alerts"
                  element={
                    <RoleProtectedRoute role="parent">
                      <AlertsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/children"
                  element={
                    <RoleProtectedRoute role="parent">
                      <ManageChildPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RoleProtectedRoute role="parent">
                      <ReportsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/communications"
                  element={
                    <RoleProtectedRoute role="parent">
                      <CommunicationsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <RoleProtectedRoute role="parent">
                      <NotificationsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/child-setup"
                  element={
                    <RoleProtectedRoute role="parent">
                      <ChildSetupScreen />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/children/:childId/geofence"
                  element={
                    <RoleProtectedRoute role="parent">
                      <GeofencePage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/children/:childId/rewards"
                  element={
                    <RoleProtectedRoute role="parent">
                      <RewardsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/children/:childId/sos"
                  element={
                    <RoleProtectedRoute role="parent">
                      <SOSPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/children/:childId/voice-commands"
                  element={
                    <RoleProtectedRoute role="parent">
                      <VoiceCommandsPage />
                    </RoleProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;