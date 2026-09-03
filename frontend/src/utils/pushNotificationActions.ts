// pushNotificationActions.ts
// Interactive push notification handling for lock-screen approve/deny actions.
//
// When a child requests +15 minutes from the lock screen, the parent receives
// an interactive push notification with [Approve +15m] and [Deny] action buttons.
// This module handles:
// 1. Service Worker registration for push notifications
// 2. Notification action button handling
// 3. Sending approval/denial responses back to the backend

import apiClient from '../services/apiClient';

// ── Service Worker Type Declarations ─────────────────────────────────

interface SWNotificationEvent extends Event {
  notification: Notification;
  action: string;
  waitUntil(promise: Promise<unknown>): void;
}

interface WindowClient extends EventTarget {
  focus(): Promise<WindowClient>;
}

interface ServiceWorkerGlobalScope {
  clients: {
    matchAll(options?: { type?: string }): Promise<WindowClient[]>;
    openWindow(url: string): Promise<WindowClient | null>;
  };
  addEventListener(type: string, listener: (event: SWNotificationEvent) => void): void;
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// ── Service Worker Registration ────────────────────────────────────

/**
 * Register the service worker for push notifications.
 * Called once on app startup.
 */
export async function registerPushNotifications(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);

    // Request push notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Push notification permission denied');
      return null;
    }

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });

    // Send subscription to backend
    await apiClient.post('/auth/push-token', {
      token: subscription.endpoint,
    });

    console.log('Push notifications enabled');
    return subscription.endpoint;
  } catch (err) {
    console.error('Failed to register push notifications:', err);
    return null;
  }
}

// ── Notification Action Handling ───────────────────────────────────

/**
 * Handle notification action button clicks.
 * Called from the service worker's notificationclick event.
 */
export function handleNotificationAction(
  notification: Notification,
  action: string
): void {
  const data = notification.data as {
    type?: string;
    request_id?: string;
    child_id?: string;
    extra_minutes?: number;
  };

  if (data.type === 'unblock_request') {
    handleUnblockRequestAction(data.request_id!, action, data.extra_minutes ?? 15);
  }
}

async function handleUnblockRequestAction(
  requestId: string,
  action: string,
  extraMinutes: number
): Promise<void> {
  try {
    if (action === 'approve') {
      await apiClient.post(`/unblock-requests/${requestId}/respond`, {
        action: 'approve',
        extra_minutes: extraMinutes,
      });
      console.log(`Approved unblock request ${requestId} (+${extraMinutes}m)`);
    } else if (action === 'deny') {
      await apiClient.post(`/unblock-requests/${requestId}/respond`, {
        action: 'deny',
      });
      console.log(`Denied unblock request ${requestId}`);
    }
  } catch (err) {
    console.error(`Failed to respond to unblock request ${requestId}:`, err);
  }
}

// ── Service Worker Event Listeners ─────────────────────────────────

/**
 * Setup notification event listeners.
 * Call this from the service worker file (sw.js).
 */
export function setupNotificationListeners(): void {
  if (typeof self === 'undefined') return; // Not in service worker context

  self.addEventListener('notificationclick', (event: SWNotificationEvent) => {
    event.notification.close();

    if (event.action) {
      // Handle action button click
      handleNotificationAction(event.notification, event.action);
    } else {
      // Handle notification body click — open the app
      event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients: WindowClient[]) => {
          if (clients.length > 0) {
            return clients[0].focus();
          }
          return self.clients.openWindow('/');
        })
      );
    }
  });
}
