// offlineRuleSync.ts
// Offline-first rule synchronization using IndexedDB and service worker.
//
// Rules (schedules, appLimits, geofences, etc.) are cached in IndexedDB
// and synced from the backend on a background schedule. The Android device
// reads from the local cache for enforcement, ensuring rules work even
// when the device is offline (e.g., in airplane mode, underground).

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import apiClient from '../services/apiClient';

// ── Types ──────────────────────────────────────────────────────────

export interface OfflinePolicy {
  policyVersion: number;
  schedules: ScheduleRule[];
  appLimits: AppLimitRule[];
  geofences: GeofenceRule[];
  urlFilters: UrlFilterRule[];
  syncedAt: number; // ISO timestamp
}

export interface ScheduleRule {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;
  days: string[]; // MON, TUE, etc.
  action: 'LOCK_DEVICE' | 'WHITELIST_ONLY' | 'DISABLE_APP';
  allowedPackages?: string[];
}

export interface AppLimitRule {
  id: string;
  packageName: string;
  dailyLimitMinutes: number;
}

export interface GeofenceRule {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  action: 'ALERT_ON_EXIT' | 'ALERT_ON_ENTER';
}

export interface UrlFilterRule {
  id: string;
  pattern: string;
  action: 'BLOCK' | 'ALLOW';
}

// ── IndexedDB Schema ───────────────────────────────────────────────

interface KavachDB extends DBSchema {
  policies: {
    key: string;
    value: OfflinePolicy;
  };
  syncState: {
    key: string;
    value: { lastSync: number; version: number };
  };
}

let dbInstance: IDBPDatabase<KavachDB> | null = null;

async function getDB(): Promise<IDBPDatabase<KavachDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<KavachDB>('kavach-offline-rules', 1, {
    upgrade(db) {
      db.createObjectStore('policies');
      db.createObjectStore('syncState');
    },
  });

  return dbInstance;
}

// ── Sync Functions ─────────────────────────────────────────────────

/**
 * Fetch the latest policy from the backend and cache it in IndexedDB.
 * Called on app startup and periodically via service worker.
 */
export async function syncPolicyFromBackend(childId: string): Promise<OfflinePolicy | null> {
  try {
    const response = await apiClient.get(`/children/${childId}/offline-policy`);

    const policy: OfflinePolicy = {
      policyVersion: response.data.data.policy_version,
      schedules: response.data.data.schedules ?? [],
      appLimits: response.data.data.app_limits ?? [],
      geofences: response.data.data.geofences ?? [],
      urlFilters: response.data.data.url_filters ?? [],
      syncedAt: new Date().toISOString(),
    };

    await cachePolicy(childId, policy);

    // Update sync state
    const db = await getDB();
    await db.put('syncState', {
      lastSync: Date.now(),
      version: policy.policyVersion,
    }, `child:${childId}`);

    return policy;
  } catch (err) {
    console.error('Offline policy sync error:', err);
    return null;
  }
}

/**
 * Cache a policy in IndexedDB.
 */
export async function cachePolicy(childId: string, policy: OfflinePolicy): Promise<void> {
  const db = await getDB();
  await db.put('policies', policy, `child:${childId}`);
}

/**
 * Read the cached policy from IndexedDB (for offline enforcement).
 * Returns null if no cached policy exists.
 */
export async function getCachedPolicy(childId: string): Promise<OfflinePolicy | null> {
  const db = await getDB();
  return db.get('policies', `child:${childId}`) ?? null;
}

/**
 * Check if the cached policy is stale (>1 hour since last sync).
 */
export async function isPolicyStale(childId: string): Promise<boolean> {
  const db = await getDB();
  const syncState = await db.get('syncState', `child:${childId}`);
  if (!syncState) return true;
  return Date.now() - syncState.lastSync > 60 * 60 * 1000; // 1 hour
}

/**
 * Clear all cached policies (called on logout).
 */
export async function clearOfflineCache(): Promise<void> {
  const db = await getDB();
  await db.clear('policies');
  await db.clear('syncState');
}
