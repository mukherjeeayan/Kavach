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
  role: 'parent' | 'child' | 'admin' | null;
  subscription_tier?: 'FREE' | 'TRIAL' | 'PREMIUM';
  trial_expires_at?: string | null;
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
  admin_active: boolean;
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
  daily_limit_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface LoginPayload {
  /** Optional: the backend also sets httpOnly cookies for browser clients. */
  token?: string;
  refresh_token?: string;
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
  id: string;
  action: 'TAMPER_ALERT' | 'SCREEN_TIME_LIMIT_REACHED' | 'PER_APP_LIMIT_REACHED' | 'DEVICE_ADMIN_STATUS' | 'DEVICE_SECURITY_ALERT' | 'FLAGGED_COMMUNICATION' | 'SOS_TRIGGERED' | 'SOS_ACKNOWLEDGED' | 'SOS_RESOLVED' | 'CREATE_GEOFENCE' | 'UPDATE_GEOFENCE' | 'DELETE_GEOFENCE';
  resource_type: string;
  details: Record<string, unknown>;
  created_at: string;
  acknowledged_at: string | null;
}

// ── Phase 2: Website Filtering ──────────────────────────────────

export interface UrlFilterRule {
  id: string;
  child_id: string;
  url_pattern: string;
  rule_type: 'ALLOW' | 'BLOCK';
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UrlFilterInput {
  url_pattern: string;
  rule_type?: 'ALLOW' | 'BLOCK';
  category?: string;
}

// ── Phase 2: Device Health ──────────────────────────────────────

export interface DeviceHealth {
  id: string;
  device_id: string;
  battery_level: number | null;
  is_charging: boolean | null;
  storage_total_mb: number | null;
  storage_free_mb: number | null;
  is_rooted: boolean;
  is_developer_options: boolean;
  is_usb_debugging: boolean;
  os_version: string | null;
  app_version: string | null;
  recorded_at: string;
  created_at: string;
}

// ── Phase 2: Communication Logs ─────────────────────────────────

export interface CommunicationLog {
  id: string;
  device_id: string;
  comm_type: 'SMS_IN' | 'SMS_OUT' | 'CALL_IN' | 'CALL_OUT' | 'CALL_MISSED';
  contact_number: string | null;
  contact_name: string | null;
  content_snippet: string | null;
  duration_seconds: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
  recorded_at: string;
  created_at: string;
}

export interface KeywordAlert {
  id: string;
  device_id: string;
  child_id: string;
  source_type: 'SMS' | 'NOTIFICATION' | 'CLIPBOARD' | 'APP_TEXT';
  detected_keywords: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  content_snippet: string | null;
  app_package: string | null;
  is_reviewed: boolean;
  reviewed_at: string | null;
  created_at: string;
}

// ── Phase 2: Emergency SOS ──────────────────────────────────────

export interface SosEvent {
  id: string;
  device_id: string;
  child_id: string;
  latitude: number | null;
  longitude: number | null;
  battery_level: number | null;
  trigger_method: 'BUTTON' | 'WIDGET' | 'VOICE' | 'HARDWARE_KEY';
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
}

// ── Phase 2: Analytics & Reports ────────────────────────────────

export interface AnalyticsReport {
  id: string;
  child_id: string;
  report_type: 'WEEKLY' | 'MONTHLY';
  period_start: string;
  period_end: string;
  data: Record<string, unknown>;
  generated_at: string;
}

export interface ReportData {
  period: { start: string; end: string; type: string };
  screen_time: {
    daily_totals: Array<{ date_recorded: string; total_seconds: number }>;
    by_app: Array<{ app_package: string; app_category: string; total_seconds: number }>;
    by_category: Array<{ category: string; total_seconds: number }>;
    grand_total_seconds: number;
  };
  location: { total_pings: number };
  communications: Array<{ comm_type: string; count: number; flagged: number }>;
  keyword_alerts: Array<{ severity: string; count: number }>;
}

// ── Phase 2: Geofencing ────────────────────────────────────────

export interface Geofence {
  id: string;
  child_id: string;
  device_id: string | null;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  zone_type: 'HOME' | 'SCHOOL' | 'FRIEND' | 'CUSTOM';
  alert_on_entry: boolean;
  alert_on_exit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeofenceInput {
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  zone_type?: 'HOME' | 'SCHOOL' | 'FRIEND' | 'CUSTOM';
  alert_on_entry?: boolean;
  alert_on_exit?: boolean;
  device_id?: string;
}

// ── Phase 2: Keyword Dictionary ─────────────────────────────────

export interface KeywordDictEntry {
  id: string;
  category: 'CYBERBULLYING' | 'SELF_HARM' | 'PROFANITY' | 'DRUGS' | 'CUSTOM';
  keyword: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  language: string;
  is_active: boolean;
  created_at: string;
}

// ── Phase 3: Mood Tracking ──────────────────────────────────────

export interface MoodLog {
  id: string;
  child_id: string;
  device_id: string | null;
  mood_score: number;
  note: string | null;
  activities: string[] | null;
  recorded_at: string;
  created_at: string;
}

// ── Phase 3: Self-Harm Alerts ───────────────────────────────────

export interface SelfHarmAlert {
  id: string;
  child_id: string;
  device_id: string;
  source_type: 'SMS' | 'APP_TEXT' | 'KEYBOARD' | 'SEARCH';
  detected_keywords: string[];
  content_snippet: string | null;
  risk_level: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

// ── Phase 3: Reward System ──────────────────────────────────────

export interface RewardCatalogItem {
  id: string;
  parent_id: string;
  name: string;
  description: string | null;
  cost_points: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RewardPoints {
  total_points: number;
  recent_entries: Array<{
    id: string;
    points: number;
    reason: string | null;
    source: string | null;
    created_at: string;
  }>;
}

export interface RewardRedemption {
  id: string;
  child_id: string;
  reward_id: string;
  points_spent: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
  parent_notes: string | null;
  redeemed_at: string;
  resolved_at: string | null;
}

// ── Phase 4: Behavior Prediction ────────────────────────────────

export interface BehaviorPrediction {
  id: string;
  child_id: string;
  prediction_type: 'HIGH_RISK_TIME' | 'SCREEN_TIME_TREND' | 'APP_USAGE_PATTERN' | 'SOCIAL_RISK';
  confidence: number;
  risk_score: number;
  prediction_data: Record<string, unknown>;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
}

// ── Phase 4: Security ──────────────────────────────────────────

export interface SecurityScan {
  id: string;
  device_id: string;
  scan_type: 'ROOT' | 'KEYLOGGER' | 'WIFI' | 'APP_INTEGRITY' | 'FULL';
  result: Record<string, unknown>;
  threats_found: number;
  scanned_at: string;
}

export interface WifiLog {
  id: string;
  device_id: string;
  ssid: string | null;
  bssid: string | null;
  security_type: string | null;
  is_open: boolean;
  is_known: boolean;
  ip_address: string | null;
  recorded_at: string;
}

// ── Phase 4: Integrations ──────────────────────────────────────

export interface Integration {
  id: string;
  parent_id: string;
  integration_type: 'SCHOOL_PORTAL' | 'CALENDAR' | 'HEALTH_APP' | 'CUSTOM';
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

// ── User Settings ──────────────────────────────────────────────

export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  email_digest_enabled: boolean;
  digest_frequency: 'DAILY' | 'WEEKLY';
  screen_time_alerts: boolean;
  location_alerts: boolean;
  communication_alerts: boolean;
  sos_alerts: boolean;
  self_harm_alerts: boolean;
  dnd_enabled: boolean;
  dnd_start_time: string;
  dnd_end_time: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsInput {
  notifications_enabled?: boolean;
  email_digest_enabled?: boolean;
  digest_frequency?: 'DAILY' | 'WEEKLY';
  screen_time_alerts?: boolean;
  location_alerts?: boolean;
  communication_alerts?: boolean;
  sos_alerts?: boolean;
  self_harm_alerts?: boolean;
  dnd_enabled?: boolean;
  dnd_start_time?: string;
  dnd_end_time?: string;
}

// ── Notifications ─────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Pagination ─────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── Parental Consent (DPDP Act compliance) ────────────────────

export interface ParentalConsent {
  id: string;
  parent_id: string;
  child_id: string;
  consent_type: string;
  status: 'ACTIVE' | 'REVOKED';
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentInput {
  child_id: string;
  consent_type: string;
}