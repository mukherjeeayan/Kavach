/**
 * Shared API types matching the backend response envelope
 * (see backend/src/controllers/*, backend/src/routes/*).
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp: string;
  request_id: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface ChildProfile {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string | null;
  daily_screen_time_limit_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceProfile {
  device_id: string;
  child_id: string;
  device_name: string;
  device_type: string;
  os_version: string | null;
  fcm_token: string | null;
  last_active: string | null;
}

export interface AppBlockRule {
  id: string;
  device_id: string;
  package_name: string;
  app_name: string | null;
  is_blocked: boolean;
  block_reason: string | null;
  unblock_requested: boolean;
  unblock_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginPayload {
  token: string;
  refresh_token: string;
  user: AuthUser;
  child: ChildProfile | null;
}

// ── Phase 1: screen time, locks, location, contacts ──────────────

export interface ScheduledLock {
  id: string;
  child_id: string;
  device_id: string | null;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LockInput {
  device_id?: string;
  day_of_week?: number | null;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface ContactRule {
  id: string;
  child_id: string;
  device_id: string | null;
  phone_number: string;
  contact_name: string | null;
  rule_type: 'ALLOW' | 'BLOCK';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactInput {
  phone_number?: string;
  contact_name?: string;
  rule_type?: 'ALLOW' | 'BLOCK';
  device_id?: string;
}

export interface ScreenTimeRow {
  device_id: string;
  app_package: string;
  app_category: string | null;
  total_seconds: number;
}

export interface DailyTotal {
  date_recorded: string;
  total_seconds: number;
}

export interface AppTotal {
  app_package: string;
  app_category: string;
  total_seconds: number;
}

export interface ScreenTimeSummary {
  range: 'day' | 'week' | 'month';
  total_seconds: number;
  daily: DailyTotal[];
  by_app: AppTotal[];
}

export interface LocationPoint {
  id: string;
  child_id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_kmh: number | null;
  recorded_at: string;
}

/** Tamper / screen-time-limit event, read from the child's audit log. */
export interface ChildAlert {
  action: 'TAMPER_ALERT' | 'SCREEN_TIME_LIMIT_REACHED';
  resource_type: string;
  details: Record<string, unknown>;
  created_at: string;
}