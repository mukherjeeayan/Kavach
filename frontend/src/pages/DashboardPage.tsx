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
import { useLogout } from '../hooks/useAuth';
import { useRealtimeRules } from '../hooks/useRealtimeRules';
import Header from '../components/dashboard/Header';
import ChildSelector from '../components/dashboard/ChildSelector';
import DeviceList from '../components/dashboard/DeviceList';
import BlockAppForm from '../components/dashboard/BlockAppForm';
import BlockedAppsTable from '../components/dashboard/BlockedAppsTable';
import UnblockRequests from '../components/dashboard/UnblockRequests';
import type { RootState } from '../store/store';

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const { handleLogout } = useLogout();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const childrenQuery = useChildren();
  const childId = selectedChildId ?? childrenQuery.data?.[0]?.id ?? null;

  const devicesQuery = useDevices(childId);
  const blockedQuery = useBlockedApps(childId);
  const requestsQuery = useUnblockRequests(childId);
  const invalidateChildData = useInvalidateChildData(childId);

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
            <DeviceList
              devices={devicesQuery.data ?? []}
              selectedDeviceId={selectedDeviceId}
              onSelect={setSelectedDeviceId}
            />

            <BlockAppForm
              isPending={blockApp.isPending}
              disabled={!selectedDeviceId || !devicesQuery.data?.length}
              showDeviceHint={!!selectedDeviceId === false && !!devicesQuery.data?.length}
              onBlock={handleBlock}
            />

            <BlockedAppsTable rules={blockedQuery.data ?? []} />

            <UnblockRequests
              rules={requestsQuery.data ?? []}
              isPending={respondToRequest.isPending}
              onApprove={(ruleId) => respondToRequest.mutate({ ruleId, decision: 'approve' })}
              onReject={(ruleId) => respondToRequest.mutate({ ruleId, decision: 'reject' })}
            />
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
