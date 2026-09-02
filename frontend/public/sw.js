// sw.js — Service Worker for Kavach Parent Dashboard
//
// Handles:
// 1. Push notification display with action buttons
// 2. Notification click handling (approve/deny unblock requests)
// 3. Offline caching of static assets (optional, for PWA support)

// ── Push Notification Handling ─────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'Kavach',
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'kavach-notification',
    renotify: true,
    data: data.data || {},
    actions: [],
  };

  // Add action buttons for unblock requests
  if (data.data?.type === 'unblock_request') {
    options.actions = [
      { action: 'approve', title: `Approve +${data.data.extra_minutes || 15}m` },
      { action: 'deny', title: 'Deny' },
    ];
    options.requireInteraction = true;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kavach', options)
  );
});

// ── Notification Click Handling ────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;

  if (event.action && data?.type === 'unblock_request') {
    // Handle approve/deny action — send message to the main app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Focus existing window or open new one
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: event.action,
              requestId: data.request_id,
              extraMinutes: data.extra_minutes || 15,
            });
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
    );
  } else {
    // Default: focus the dashboard
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
    );
  }
});

// ── Message Handling (from main app) ───────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
