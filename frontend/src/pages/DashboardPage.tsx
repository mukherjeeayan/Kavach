import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useBlockedApps,
  useChildren,
  useCreateChild,
  useDevices,
  useInvalidateChildData,
  useUnblockRequests,
} from '../hooks/useChildrenData';
import { useBlockAppAction, useRespondToUnblockRequest } from '../hooks/useDashboardActions';
import { useSetParentPin, useVerifyParentPin } from '../hooks/usePhase1Data';
import { useLogout } from '../hooks/useAuth';
import { useRealtimeRules } from '../hooks/useRealtimeRules';
import Header from '../components/dashboard/Header';
import ChildSelector from '../components/dashboard/ChildSelector';
import DeviceList from '../components/dashboard/DeviceList';
import BlockAppForm from '../components/dashboard/BlockAppForm';
import BlockedAppsTable from '../components/dashboard/BlockedAppsTable';
import UnblockRequests from '../components/dashboard/UnblockRequests';
import ScreenTimeSection from '../components/dashboard/ScreenTimeSection';
import AlertsSection from '../components/dashboard/AlertsSection';
import LocksSection from '../components/dashboard/LocksSection';
import ContactsSection from '../components/dashboard/ContactsSection';
import LocationsSection from '../components/dashboard/LocationsSection';
import WebsiteFilterSection from '../components/dashboard/WebsiteFilterSection';
import DeviceHealthSection from '../components/dashboard/DeviceHealthSection';
import CommunicationSection from '../components/dashboard/CommunicationSection';
import KeywordAlertsSection from '../components/dashboard/KeywordAlertsSection';
import KeywordDictionarySection from '../components/dashboard/KeywordDictionarySection';
import EmergencySOS from '../components/dashboard/EmergencySOS';
import AnalyticsSection from '../components/dashboard/AnalyticsSection';
import GeofenceSection from '../components/dashboard/GeofenceSection';
import MoodTrackingSection from '../components/dashboard/MoodTrackingSection';
import RewardSection from '../components/dashboard/RewardSection';
import BehaviorPredictionSection from '../components/dashboard/BehaviorPredictionSection';
import SecuritySection from '../components/dashboard/SecuritySection';
import SelfHarmAlertsSection from '../components/dashboard/SelfHarmAlertsSection';
import VoiceCommandsSection from '../components/dashboard/VoiceCommandsSection';
import IntegrationsSection from '../components/dashboard/IntegrationsSection';
import PremiumLockOverlay from '../components/ui/PremiumLockOverlay';
import Toast from '../components/ui/Toast';
import { SkeletonList } from '../components/ui/Skeleton';
import type { RootState } from '../store/store';

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const { handleLogout } = useLogout();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pinGateOpen, setPinGateOpen] = useState(true);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [pinSetupHint, setPinSetupHint] = useState<string | null>(null);

  const childrenQuery = useChildren();
  const createChild = useCreateChild();
  const childId = selectedChildId ?? childrenQuery.data?.[0]?.id ?? null;
  const invalidateChildData = useInvalidateChildData(childId);

  // Real-time rule updates: the backend broadcasts rule:changed to the
  // socket room of the affected child. When the socket is unavailable
  // (offline backend, blocked websockets) we fall back to polling.
  const { isConnected } = useRealtimeRules(childId, invalidateChildData);
  const pollInterval = isConnected ? false : 60_000;

  const devicesQuery = useDevices(childId);
  const blockedQuery = useBlockedApps(childId, pollInterval);
  const requestsQuery = useUnblockRequests(childId, pollInterval);
  const verifyPin = useVerifyParentPin();
  const setPin = useSetParentPin();

  const respondToRequest = useRespondToUnblockRequest(childId, invalidateChildData, setActionError);
  const blockApp = useBlockAppAction(childId, invalidateChildData, setActionError);

  const handleAddChild = useCallback(
    (name: string, birthDate: string) =>
      createChild.mutateAsync({ name, birthDate: birthDate || undefined }),
    [createChild]
  );

  const handleBlock = useCallback(
    (packageName: string, reason: string) =>
      blockApp.mutateAsync({
        device_id: selectedDeviceId as string,
        package_name: packageName,
        block_reason: reason || undefined,
      }),
    [blockApp, selectedDeviceId]
  );

  const handlePinSubmit = useCallback(
    (pin: string) => {
      if (!user) return;
      verifyPin.mutate(
        { email: user.email, pin },
        {
          onSuccess: () => {
            setPinUnlocked(true);
            setPinGateOpen(false);
          },
        }
      );
    },
    [verifyPin, user]
  );

  const handlePinSetup = useCallback(
    (pin: string, confirm: string) => {
      if (pin !== confirm || !/^\d{4,6}$/.test(pin)) {
        setPinSetupHint('PIN must be 4-6 digits and match in both fields.');
        return;
      }
      setPin.mutate(pin, {
        onSuccess: () => {
          setPinSetupOpen(false);
          setPinSetupHint('PIN saved. Enter it below to unlock.');
        },
        onError: () => setPinSetupHint('Failed to save PIN. Please try again.'),
      });
    },
    [setPin]
  );

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 sm:space-y-8">
        <ChildSelector
          children={childrenQuery.data ?? []}
          selectedChildId={childId}
          isLoading={childrenQuery.isLoading}
          isError={childrenQuery.isError}
          onSelect={setSelectedChildId}
          onAddChild={handleAddChild}
          isAddingChild={createChild.isPending}
          addChildError={createChild.isError ? 'Failed to add child' : null}
        />

        {childId && (
          <>
            <ScreenTimeSection
              childId={childId}
              limitMinutes={
                childrenQuery.data?.find((c) => c.id === childId)
                  ?.daily_screen_time_limit_minutes ?? null
              }
            />
            <AlertsSection childId={childId} />
            <PremiumLockOverlay featureName="Location Tracking" requiredTier="TRIAL">
              <LocationsSection childId={childId} />
            </PremiumLockOverlay>

            {devicesQuery.isLoading && <SkeletonList items={2} />}
            {devicesQuery.isError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  Failed to load devices. Please try refreshing the page.
                </p>
              </div>
            )}
            {blockedQuery.isLoading && <SkeletonList items={2} />}
            {blockedQuery.isError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  Failed to load blocked apps. Please try refreshing the page.
                </p>
              </div>
            )}

            {pinGateOpen && (
              <section className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 text-primary dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Parent verification</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                  Managing locks and contacts is protected. Enter the PIN you set during setup.
                </p>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('pin') as HTMLInputElement;
                    handlePinSubmit(input.value);
                  }}
                >
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    placeholder="PIN"
                    maxLength={6}
                    autoFocus
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm w-32 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={verifyPin.isPending}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {verifyPin.isPending ? 'Checking...' : 'Unlock'}
                  </button>
                </form>
                {verifyPin.isError && (
                  <p className="text-sm text-red-500" role="alert">
                    Incorrect PIN
                  </p>
                )}
                {pinSetupHint && <p className="text-sm text-green-600">{pinSetupHint}</p>}
                {pinSetupOpen ? (
                  <form
                    className="flex flex-col items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const pin = (form.elements.namedItem('newPin') as HTMLInputElement).value;
                      const confirm = (form.elements.namedItem('confirmPin') as HTMLInputElement).value;
                      handlePinSetup(pin, confirm);
                    }}
                  >
                    <input
                      name="newPin"
                      type="password"
                      inputMode="numeric"
                      placeholder="New PIN (4-6 digits)"
                      maxLength={6}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm w-48 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                    />
                    <input
                      name="confirmPin"
                      type="password"
                      inputMode="numeric"
                      placeholder="Confirm PIN"
                      maxLength={6}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm w-48 text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={setPin.isPending}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {setPin.isPending ? 'Saving...' : 'Save PIN'}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setPinSetupOpen(true);
                      setPinSetupHint(null);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Never set a PIN? Set one now
                  </button>
                )}
              </section>
            )}

            {pinUnlocked && (
              <>
                <LocksSection childId={childId} onError={setActionError} />
                <ContactsSection childId={childId} onError={setActionError} />
              </>
            )}

            {pinUnlocked && (
              <DeviceList
                devices={devicesQuery.data ?? []}
                selectedDeviceId={selectedDeviceId}
                onSelect={setSelectedDeviceId}
              />
            )}

            {pinUnlocked && (
              <>
                <BlockAppForm
                  isPending={blockApp.isPending}
                  disabled={!selectedDeviceId || !devicesQuery.data?.length}
                  showDeviceHint={
                    !!selectedDeviceId === false && !!devicesQuery.data?.length
                  }
                  onBlock={handleBlock}
                />

                <BlockedAppsTable rules={blockedQuery.data ?? []} childId={childId} />

                <UnblockRequests
                  rules={requestsQuery.data ?? []}
                  isPending={respondToRequest.isPending}
                  onApprove={(ruleId) =>
                    respondToRequest.mutate({ ruleId, decision: 'approve' })
                  }
                  onReject={(ruleId) =>
                    respondToRequest.mutate({ ruleId, decision: 'reject' })
                  }
                />
              </>
            )}

            {/* Phase 2: Advanced Features */}
            {pinUnlocked && (
              <>
                <EmergencySOS childId={childId} onError={setActionError} />
                <PremiumLockOverlay featureName="Website Filtering" requiredTier="TRIAL">
                  <WebsiteFilterSection childId={childId} onError={setActionError} />
                </PremiumLockOverlay>
                <DeviceHealthSection childId={childId} deviceId={selectedDeviceId} />
                <PremiumLockOverlay featureName="Geofencing" requiredTier="TRIAL">
                  <GeofenceSection childId={childId} onError={setActionError} />
                </PremiumLockOverlay>
                <PremiumLockOverlay featureName="Communication Monitoring" requiredTier="TRIAL">
                  <CommunicationSection childId={childId} />
                </PremiumLockOverlay>
                <PremiumLockOverlay featureName="Keyword Alerts" requiredTier="TRIAL">
                  <KeywordAlertsSection childId={childId} onError={setActionError} />
                </PremiumLockOverlay>
                <KeywordDictionarySection onError={setActionError} />
                <PremiumLockOverlay featureName="Weekly AI Reports" requiredTier="PREMIUM">
                  <AnalyticsSection childId={childId} onError={setActionError} />
                </PremiumLockOverlay>
              </>
            )}

            {/* Phase 3: Wellness Features */}
            {pinUnlocked && (
              <>
                <MoodTrackingSection childId={childId} />
                <RewardSection
                  childId={childId}
                  onError={setActionError}
                  childName={childrenQuery.data?.find((c) => c.id === childId)?.name}
                />
                <PremiumLockOverlay featureName="Self-Harm Detection" requiredTier="PREMIUM">
                  <SelfHarmAlertsSection childId={childId} onError={setActionError} />
                </PremiumLockOverlay>
                <VoiceCommandsSection childId={childId} />
              </>
            )}

            {/* Phase 4: AI & Advanced Features */}
            {pinUnlocked && (
              <>
                <PremiumLockOverlay featureName="Behavior Predictions" requiredTier="PREMIUM">
                  <BehaviorPredictionSection childId={childId} />
                </PremiumLockOverlay>
                <SecuritySection childId={childId} deviceId={selectedDeviceId} />
                <PremiumLockOverlay featureName="Multi-Guardian" requiredTier="PREMIUM">
                  <IntegrationsSection onError={setActionError} />
                </PremiumLockOverlay>
              </>
            )}
          </>
        )}

        {actionError && (
          <Toast message={actionError} type="error" onClose={() => setActionError(null)} />
        )}
      </main>
    </div>
  );
}
