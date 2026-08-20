import { useState } from 'react';
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

  const handleAddChild = (name: string, birthDate: string) =>
    createChild.mutateAsync({ name, birthDate: birthDate || undefined });

  const handleBlock = (packageName: string, reason: string) =>
    blockApp.mutateAsync({
      device_id: selectedDeviceId as string,
      package_name: packageName,
      block_reason: reason || undefined,
    });

  const handlePinSubmit = (pin: string) => {
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
  };

  const handlePinSetup = (pin: string, confirm: string) => {
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
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
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
            <LocationsSection childId={childId} />

            {devicesQuery.isLoading && (
              <p className="text-sm text-gray-500">Loading devices...</p>
            )}
            {devicesQuery.isError && (
              <p className="text-sm text-red-500" role="alert">
                Failed to load devices.
              </p>
            )}
            {blockedQuery.isLoading && (
              <p className="text-sm text-gray-500">Loading blocked apps...</p>
            )}
            {blockedQuery.isError && (
              <p className="text-sm text-red-500" role="alert">
                Failed to load blocked apps.
              </p>
            )}

            {pinGateOpen && (
              <section className="bg-white rounded-lg p-6 border flex flex-col items-center gap-3">
                <h2 className="text-lg font-semibold">Parent verification</h2>
                <p className="text-sm text-gray-500 text-center">
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
                    className="border rounded-md px-3 py-2 text-sm w-32 text-center"
                  />
                  <button
                    type="submit"
                    disabled={verifyPin.isPending}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {verifyPin.isPending ? 'Checking…' : 'Unlock'}
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
                      className="border rounded-md px-3 py-2 text-sm w-48 text-center"
                    />
                    <input
                      name="confirmPin"
                      type="password"
                      inputMode="numeric"
                      placeholder="Confirm PIN"
                      maxLength={6}
                      className="border rounded-md px-3 py-2 text-sm w-48 text-center"
                    />
                    <button
                      type="submit"
                      disabled={setPin.isPending}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {setPin.isPending ? 'Saving…' : 'Save PIN'}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setPinSetupOpen(true);
                      setPinSetupHint(null);
                    }}
                    className="text-sm text-blue-600 hover:underline"
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

                <BlockedAppsTable rules={blockedQuery.data ?? []} />

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
          </>
        )}

        {actionError && (
          <p className="text-sm text-red-500" role="alert">
            {actionError}
          </p>
        )}
      </main>
    </div>
  );
}