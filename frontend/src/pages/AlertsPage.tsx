import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useChildren } from '../hooks/useChildrenData';
import { useChildAlerts, useAcknowledgeAlert } from '../hooks/usePhase1Data';
import { SkeletonList } from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import type { ChildAlert } from '../types/api';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  TAMPER_ALERT: { label: 'Tamper Alert', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SCREEN_TIME_LIMIT_REACHED: { label: 'Screen Time Limit', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PER_APP_LIMIT_REACHED: { label: 'App Limit', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  DEVICE_ADMIN_STATUS: { label: 'Device Admin', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  DEVICE_SECURITY_ALERT: { label: 'Security Alert', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  FLAGGED_COMMUNICATION: { label: 'Flagged Comm', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  SOS_TRIGGERED: { label: 'SOS Triggered', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SOS_ACKNOWLEDGED: { label: 'SOS Acknowledged', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  SOS_RESOLVED: { label: 'SOS Resolved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  CREATE_GEOFENCE: { label: 'Geofence Created', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  UPDATE_GEOFENCE: { label: 'Geofence Updated', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  DELETE_GEOFENCE: { label: 'Geofence Deleted', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

function formatAlertDetails(alert: ChildAlert): string {
  const time = new Date(alert.created_at).toLocaleString();
  if (alert.action === 'SCREEN_TIME_LIMIT_REACHED') {
    const minutes = alert.details?.limit_minutes;
    return `Exceeded daily limit${minutes ? ` (${minutes} min)` : ''} — ${time}`;
  }
  if (alert.action === 'PER_APP_LIMIT_REACHED') {
    const app = alert.details?.app_name ?? alert.details?.package_name;
    const minutes = alert.details?.limit_minutes;
    return `${app ?? 'An app'} exceeded ${minutes ? `${minutes}-min ` : ''}limit — ${time}`;
  }
  return time;
}

export default function AlertsPage() {
  const { data: children, isLoading: childrenLoading } = useChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const childId = selectedChildId ?? children?.[0]?.id ?? null;
  const { data: alerts, isLoading: alertsLoading } = useChildAlerts(childId);
  const acknowledgeAlert = useAcknowledgeAlert(childId);
  const [toast, setToast] = useState<string | null>(null);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert.mutateAsync(alertId);
    } catch {
      setToast('Failed to mark alert as read');
    }
  };

  const unacknowledged = (alerts?.data ?? []).filter((a) => !a.acknowledged_at);
  const acknowledged = (alerts?.data ?? []).filter((a) => !!a.acknowledged_at);

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-primary">SafeGuard</Link>
          <Link to="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">Back to Dashboard</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          {children && children.length > 1 && (
            <select
              value={childId ?? ''}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {childrenLoading && <SkeletonList items={3} />}

        {!childrenLoading && !childId && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No children found. Add a child first.</p>
          </div>
        )}

        {childId && alertsLoading && <SkeletonList items={5} />}

        {childId && !alertsLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Alerts</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {unacknowledged.length} unread of {(alerts?.data ?? []).length} total
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {(alerts?.data ?? []).length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">No alerts recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {unacknowledged.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-3">Unread</h3>
                      <div className="space-y-2">
                        {unacknowledged.map((alert, i) => (
                          <AlertRow key={`${alert.id}-${i}`} alert={alert} onAcknowledge={handleAcknowledge} isPending={acknowledgeAlert.isPending} />
                        ))}
                      </div>
                    </div>
                  )}

                  {acknowledged.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Read</h3>
                      <div className="space-y-2">
                        {acknowledged.map((alert, i) => (
                          <AlertRow key={`${alert.id}-${i}`} alert={alert} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </div>
  );
}

function AlertRow({
  alert,
  onAcknowledge,
  isPending,
}: {
  alert: ChildAlert;
  onAcknowledge?: (id: string) => void;
  isPending?: boolean;
}) {
  const style = ACTION_LABELS[alert.action] ?? { label: alert.action, color: 'bg-gray-100 text-gray-700' };
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
      alert.acknowledged_at
        ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`mt-0.5 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
          alert.acknowledged_at ? 'bg-gray-300 dark:bg-gray-600' : 'bg-red-500'
        }`} />
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.color}`}>
              {style.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatAlertDetails(alert)}</p>
        </div>
      </div>
      {!alert.acknowledged_at && onAcknowledge && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          disabled={isPending}
          className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors disabled:opacity-50"
        >
          Mark Read
        </button>
      )}
    </div>
  );
}
