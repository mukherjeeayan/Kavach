import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  useBlockedApps,
  useChildren,
  useDevices,
  useInvalidateChildData,
  useUnblockRequests,
} from '../hooks/useChildrenData';
import { useBlockAppAction, useRespondToUnblockRequest } from '../hooks/useDashboardActions';
import { useVerifyParentPin } from '../hooks/usePhase1Data';
import { useLogout } from '../hooks/useAuth';
import { useRealtimeRules } from '../hooks/useRealtimeRules';
import Header from '../components/dashboard/Header';
import ChildSelector from '../components/dashboard/ChildSelector';
import DeviceList from '../components/dashboard/DeviceList';
import BlockAppForm from '../components/dashboard/BlockAppForm';
import BlockedAppsTable from '../components/dashboard/BlockedAppsTable';
import UnblockRequests from '../components/dashboard/UnblockRequests';
import ScreenTimeSection from '../components/dashboard/ScreenTimeSection';
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

  const childrenQuery = useChildren();
  const childId = selectedChildId ?? childrenQuery.data?.[0]?.id ?? null;

  const devicesQuery = useDevices(childId);
  const blockedQuery = useBlockedApps(childId);
  const requestsQuery = useUnblockRequests(childId);
  const invalidateChildData = useInvalidateChildData(childId);
  const verifyPin = useVerifyParentPin();

  const respondToRequest = useRespondToUnblockRequest(childId, invalidateChildData, setActionError);
  const blockApp = useBlockAppAction(childId, invalidateChildData, setActionError);

  // Real-time rule updates: the backend broadcasts rule:changed to the
  // socket room of the affected child — no polling needed.
  useRealtimeRules(childId, invalidateChildData);

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
        />

        {childId && (
          <>
            <ScreenTimeSection childId={childId} />
            <LocationsSection childId={childId} />

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
              </section>
            )}

            {pinUnlocked && (
              <>
                <LocksSection childId={childId} onError={setActionError} />
                <ContactsSection childId={childId} />
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