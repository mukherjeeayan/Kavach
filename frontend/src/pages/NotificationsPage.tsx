import { Link } from 'react-router-dom';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications';
import { SkeletonList } from '../components/ui/Skeleton';
import Toast from '../components/ui/Toast';
import { useState } from 'react';

const TYPE_ICONS: Record<string, string> = {
  ALERT: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  SOS: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  GEOFENCE: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  SCREEN_TIME: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  SELF_HARM: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  REPORT: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  DEFAULT: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [toast, setToast] = useState<string | null>(null);

  const unread = (notifications ?? []).filter((n) => !n.is_read);
  const read = (notifications ?? []).filter((n) => n.is_read);

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch {
      setToast('Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
    } catch {
      setToast('Failed to mark all as read');
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          {unread.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
              className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 transition-colors disabled:opacity-50"
            >
              Mark All Read
            </button>
          )}
        </div>

        {isLoading && <SkeletonList items={5} />}

        {!isLoading && (notifications ?? []).length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No notifications yet.</p>
          </div>
        )}

        {!isLoading && (notifications ?? []).length > 0 && (
          <div className="space-y-6">
            {unread.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
                  New ({unread.length})
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                  {unread.map((n) => (
                    <NotificationRow key={n.id} notification={n} onMarkRead={handleMarkRead} isPending={markRead.isPending} />
                  ))}
                </div>
              </div>
            )}

            {read.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Earlier
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                  {read.map((n) => (
                    <NotificationRow key={n.id} notification={n} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  isPending,
}: {
  notification: import('../types/api').Notification;
  onMarkRead?: (id: string) => void;
  isPending?: boolean;
}) {
  const iconPath = TYPE_ICONS[notification.notification_type] ?? TYPE_ICONS.DEFAULT;
  const iconColor = notification.is_read
    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';

  return (
    <div className={`px-6 py-4 flex items-start gap-4 transition-colors ${
      notification.is_read ? 'opacity-70' : 'bg-blue-50/30 dark:bg-blue-900/5'
    }`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-medium text-gray-900 dark:text-white'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(notification.created_at).toLocaleString()}</p>
      </div>
      {!notification.is_read && onMarkRead && (
        <button
          onClick={() => onMarkRead(notification.id)}
          disabled={isPending}
          className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors shrink-0"
        >
          Mark read
        </button>
      )}
    </div>
  );
}
