import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import apiClient from '../services/apiClient';
import { clearSession } from '../store/authSlice';
import type { RootState } from '../store/store';
import type {
  ApiResponse,
  AppBlockRule,
  ChildProfile,
  DeviceProfile,
} from '../types/api';

const fetchChildren = async (): Promise<ChildProfile[]> => {
  const response = await apiClient.get<ApiResponse<{ children: ChildProfile[] }>>('/children');
  return response.data.data?.children ?? [];
};

const fetchDevices = async (childId: string): Promise<DeviceProfile[]> => {
  const response = await apiClient.get<ApiResponse<{ devices: DeviceProfile[] }>>(
    `/children/${childId}/devices`
  );
  return response.data.data?.devices ?? [];
};

const fetchBlockedApps = async (childId: string): Promise<AppBlockRule[]> => {
  const response = await apiClient.get<ApiResponse<AppBlockRule[]>>(
    `/children/${childId}/apps/blocked`
  );
  return response.data.data ?? [];
};

const fetchUnblockRequests = async (childId: string): Promise<AppBlockRule[]> => {
  const response = await apiClient.get<ApiResponse<AppBlockRule[]>>(
    `/children/${childId}/apps/unblock-requests`
  );
  return response.data.data ?? [];
};

export default function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [blockPackage, setBlockPackage] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const childrenQuery = useQuery({ queryKey: ['children'], queryFn: fetchChildren });

  const childId = selectedChildId ?? childrenQuery.data?.[0]?.id ?? null;

  const devicesQuery = useQuery({
    queryKey: ['devices', childId],
    queryFn: () => fetchDevices(childId as string),
    enabled: !!childId,
  });

  const blockedQuery = useQuery({
    queryKey: ['blocked', childId],
    queryFn: () => fetchBlockedApps(childId as string),
    enabled: !!childId,
  });

  const requestsQuery = useQuery({
    queryKey: ['unblockRequests', childId],
    queryFn: () => fetchUnblockRequests(childId as string),
    enabled: !!childId,
  });

  const invalidateChildData = () => {
    if (childId) {
      queryClient.invalidateQueries({ queryKey: ['blocked', childId] });
      queryClient.invalidateQueries({ queryKey: ['unblockRequests', childId] });
    }
  };

  const respondToRequest = useMutation({
    mutationFn: async ({
      ruleId,
      decision,
    }: {
      ruleId: string;
      decision: 'approve' | 'reject';
    }) => {
      const url = `/children/${childId}/apps/block/${ruleId}/${decision}-unblock`;
      const response = await apiClient.post<ApiResponse<AppBlockRule>>(url);
      return response.data;
    },
    onSuccess: () => invalidateChildData(),
    onError: () => setActionError('Failed to update the unblock request. Please retry.'),
  });

  const blockApp = useMutation({
    mutationFn: async () => {
      if (!childId || !selectedDeviceId || !blockPackage.trim()) {
        throw new Error('Select a device and enter a package name');
      }
      const response = await apiClient.post<ApiResponse<AppBlockRule>>(
        `/children/${childId}/apps/block`,
        {
          device_id: selectedDeviceId,
          package_name: blockPackage.trim(),
          block_reason: blockReason.trim() || undefined,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      setBlockPackage('');
      setBlockReason('');
      invalidateChildData();
    },
    onError: (e) => setActionError((e as Error).message || 'Failed to block app'),
  });

  const handleLogout = () => {
    dispatch(clearSession());
    navigate('/login', { replace: true });
  };

  // Real-time rule updates: the backend broadcasts rule:changed to the
  // socket room of the affected child — no polling needed.
  useEffect(() => {
    if (!childId) return;
    const socket = io();
    socket.emit('subscribe:child', childId);
    const handleRuleChanged = () => invalidateChildData();
    socket.on('rule:changed', handleRuleChanged);
    return () => {
      socket.off('rule:changed', handleRuleChanged);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">SafeGuard Parent Portal</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name ?? ''}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-primary"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-8">
        {/* ── Children selector ─────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Children</h2>
          {childrenQuery.isLoading && <p className="text-sm text-gray-500">Loading...</p>}
          {childrenQuery.isError && (
            <p className="text-sm text-red-500">Failed to load children.</p>
          )}
          {childrenQuery.data?.length === 0 && (
            <p className="text-sm text-gray-500">
              No child profiles yet. Add one on the child&apos;s device during setup.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {childrenQuery.data?.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  child.id === childId
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                }`}
              >
                {child.name}
              </button>
            ))}
          </div>
        </section>

        {childId && (
          <>
            {/* ── Devices ─────────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Devices</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {devicesQuery.data?.map((device) => (
                  <div
                    key={device.device_id}
                    className={`bg-white rounded-lg p-4 border cursor-pointer transition-colors ${
                      selectedDeviceId === device.device_id
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedDeviceId(device.device_id)}
                  >
                    <p className="font-medium">{device.device_name}</p>
                    <p className="text-sm text-gray-500">
                      {device.device_type} · OS {device.os_version ?? 'unknown'}
                    </p>
                    {device.last_active && (
                      <p className="text-xs text-gray-400">
                        Last active: {new Date(device.last_active).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
                {devicesQuery.data?.length === 0 && (
                  <p className="text-sm text-gray-500 col-span-full">
                    No registered devices. Install the app on the child&apos;s device.
                  </p>
                )}
              </div>
            </section>

            {/* ── Block an app ───────────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Block an App</h2>
              <div className="bg-white rounded-lg p-4 border flex flex-col sm:flex-row gap-3">
                <input
                  value={blockPackage}
                  onChange={(e) => setBlockPackage(e.target.value)}
                  placeholder="Package name (e.g. com.android.chrome)"
                  className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                />
                <input
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                />
                <button
                  onClick={() => blockApp.mutate()}
                  disabled={
                    blockApp.isPending ||
                    !selectedDeviceId ||
                    !blockPackage.trim() ||
                    !!devicesQuery.data?.length === false
                  }
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {blockApp.isPending ? 'Blocking...' : 'Block App'}
                </button>
              </div>
              {!selectedDeviceId && devicesQuery.data && devicesQuery.data.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Select a device above to target the block.
                </p>
              )}
            </section>

            {/* ── Blocked apps ───────────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Blocked Apps</h2>
              <div className="bg-white rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2">App</th>
                      <th className="px-4 py-2">Package</th>
                      <th className="px-4 py-2">Reason</th>
                      <th className="px-4 py-2">Unblock Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedQuery.data?.map((rule) => (
                      <tr key={rule.id} className="border-t">
                        <td className="px-4 py-2">{rule.app_name ?? rule.package_name}</td>
                        <td className="px-4 py-2 font-mono text-xs">{rule.package_name}</td>
                        <td className="px-4 py-2 text-gray-500">
                          {rule.block_reason ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          {rule.unblock_requested ? (
                            <span className="text-amber-600 font-medium">Pending</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {blockedQuery.data?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                          No blocked apps yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Unblock requests ───────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Unblock Requests</h2>
              <div className="space-y-3">
                {requestsQuery.data?.map((rule) => (
                  <div
                    key={rule.id}
                    className="bg-white rounded-lg p-4 border flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-medium">
                        {rule.app_name ?? rule.package_name}
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {rule.package_name}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600">
                        Reason: {rule.unblock_reason ?? 'No reason given'}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() =>
                          respondToRequest.mutate({ ruleId: rule.id, decision: 'approve' })
                        }
                        disabled={respondToRequest.isPending}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          respondToRequest.mutate({ ruleId: rule.id, decision: 'reject' })
                        }
                        disabled={respondToRequest.isPending}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {requestsQuery.data && requestsQuery.data.length === 0 && (
                  <p className="text-sm text-gray-400">No pending unblock requests.</p>
                )}
              </div>
            </section>
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