/**
 * Typed API layer — the only place that talks to the backend.
 * Every endpoint used by the UI is exposed as a function here so
 * pages and hooks never build URLs or touch apiClient directly.
 */
import apiClient from './apiClient';
import type {
  ApiResponse,
  AuthUser,
  AnalyticsReport,
  AppBlockRule,
  BehaviorPrediction,
  ChildAlert,
  ChildProfile,
  CommunicationLog,
  ContactInput,
  ContactRule,
  DeviceHealth,
  DeviceProfile,
  Geofence,
  GeofenceInput,
  KeywordAlert,
  KeywordDictEntry,
  LocationPoint,
  LockInput,
  LoginPayload,
  MoodLog,
  Notification,
  PaginatedResponse,
  ParentalConsent,
  RewardCatalogItem,
  RewardPoints,
  RewardRedemption,
  ScheduledLock,
  ScreenTimeRow,
  ScreenTimeSummary,
  SelfHarmAlert,
  SecurityScan,
  SosEvent,
  UrlFilterRule,
  UrlFilterInput,
  UserSettings,
  UserSettingsInput,
  WifiLog,
} from '../types/api';

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  child_name?: string;
  birth_date?: string;
}

export interface BlockAppInput {
  device_id: string;
  package_name: string;
  block_reason?: string;
}

export const login = async (credentials: Credentials): Promise<LoginPayload> => {
  const response = await apiClient.post<ApiResponse<LoginPayload>>('/auth/login', credentials);
  return response.data.data!;
};

export const register = async (payload: RegisterPayload): Promise<LoginPayload> => {
  const response = await apiClient.post<ApiResponse<LoginPayload>>('/auth/register', payload);
  return response.data.data!;
};

export interface GoogleAuthPayload {
  email: string;
  name?: string;
  googleId?: string;
  avatarUrl?: string;
}

export const getGoogleAuthUrl = async (): Promise<{ configured: boolean; url?: string; demoAvailable?: boolean }> => {
  const response = await apiClient.get<any>('/auth/google/url');
  return response.data?.data || response.data;
};

export const googleAuth = async (payload: GoogleAuthPayload): Promise<LoginPayload> => {
  const response = await apiClient.post<ApiResponse<LoginPayload>>('/auth/google', payload);
  return response.data.data!;
};

/** Revokes the refresh token server-side and clears session cookies. Idempotent; call on sign-out. */
export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};

export const updateProfile = async (input: { name: string }): Promise<AuthUser> => {
  const response = await apiClient.put<ApiResponse<AuthUser>>('/auth/profile', input);
  return response.data.data!;
};

export const changePassword = async (input: {
  current_password: string;
  new_password: string;
}): Promise<void> => {
  await apiClient.put('/auth/password', input);
};

export const setPin = async (input: { pin: string }): Promise<void> => {
  await apiClient.put('/auth/pin', input);
};

export const logoutAll = async (): Promise<void> => {
  await apiClient.post('/auth/logout-all');
};

export const fetchChildren = async (): Promise<ChildProfile[]> => {
  const response = await apiClient.get<ApiResponse<{ children: ChildProfile[] }>>('/children');
  return response.data.data?.children ?? [];
};

/** Recent tamper/screen-time-limit alerts for a child. */
export const fetchChildAlerts = async (
  childId: string,
  page = 1,
  limit = 20
): Promise<PaginatedResponse<ChildAlert>> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<ChildAlert>>>(
    `/children/${childId}/alerts?page=${page}&limit=${limit}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit, total: 0, total_pages: 0 } };
};

/** Set (or clear, with null) the child's daily screen-time limit in minutes. */
export const setScreenTimeLimit = async (
  childId: string,
  limitMinutes: number | null
): Promise<ChildProfile> => {
  const response = await apiClient.put<ApiResponse<{ child: ChildProfile }>>(
    `/children/${childId}/screen-time-limit`,
    { limit_minutes: limitMinutes }
  );
  return response.data.data!.child;
};

export const createChild = async (name: string, birthDate?: string): Promise<ChildProfile> => {
  const response = await apiClient.post<ApiResponse<ChildProfile>>('/children', {
    name,
    birth_date: birthDate || undefined,
  });
  return response.data.data!;
};

export const fetchChildDevices = async (childId: string): Promise<DeviceProfile[]> => {
  const response = await apiClient.get<ApiResponse<{ devices: DeviceProfile[] }>>(
    `/children/${childId}/devices`
  );
  return response.data.data?.devices ?? [];
};

export const fetchBlockedApps = async (childId: string): Promise<AppBlockRule[]> => {
  const response = await apiClient.get<ApiResponse<AppBlockRule[]>>(
    `/children/${childId}/apps/blocked`
  );
  return response.data.data ?? [];
};

export const fetchUnblockRequests = async (childId: string): Promise<AppBlockRule[]> => {
  const response = await apiClient.get<ApiResponse<AppBlockRule[]>>(
    `/children/${childId}/apps/unblock-requests`
  );
  return response.data.data ?? [];
};

export const blockApp = async (childId: string, input: BlockAppInput): Promise<AppBlockRule> => {
  const response = await apiClient.post<ApiResponse<AppBlockRule>>(
    `/children/${childId}/apps/block`,
    input
  );
  return response.data.data!;
};

export const respondToUnblockRequest = async (
  childId: string,
  ruleId: string,
  decision: 'approve' | 'reject'
): Promise<AppBlockRule> => {
  const response = await apiClient.post<ApiResponse<AppBlockRule>>(
    `/children/${childId}/apps/block/${ruleId}/${decision}-unblock`
  );
  return response.data.data!;
};

/** Set (or clear, with null) a per-app daily usage limit in minutes. */
export const setAppDailyLimit = async (
  childId: string,
  ruleId: string,
  dailyLimitMinutes: number | null
): Promise<AppBlockRule> => {
  const response = await apiClient.put<ApiResponse<AppBlockRule>>(
    `/children/${childId}/apps/block/${ruleId}/limit`,
    { daily_limit_minutes: dailyLimitMinutes }
  );
  return response.data.data!;
};

// ── Scheduled locks ───────────────────────────────────────────────

export const fetchLocks = async (childId: string): Promise<ScheduledLock[]> => {
  const response = await apiClient.get<ApiResponse<{ locks: ScheduledLock[] }>>(
    `/children/${childId}/locks`
  );
  return response.data.data?.locks ?? [];
};

export const createLock = async (childId: string, input: LockInput): Promise<ScheduledLock> => {
  const response = await apiClient.post<ApiResponse<ScheduledLock>>(
    `/children/${childId}/locks`,
    input
  );
  return response.data.data!;
};

export const updateLock = async (
  childId: string,
  lockId: string,
  input: LockInput
): Promise<ScheduledLock> => {
  const response = await apiClient.put<ApiResponse<ScheduledLock>>(
    `/children/${childId}/locks/${lockId}`,
    input
  );
  return response.data.data!;
};

export const deleteLock = async (childId: string, lockId: string): Promise<void> => {
  await apiClient.delete(`/children/${childId}/locks/${lockId}`);
};

// ── Contacts ──────────────────────────────────────────────────────

export const fetchContacts = async (childId: string): Promise<ContactRule[]> => {
  const response = await apiClient.get<ApiResponse<{ contacts: ContactRule[] }>>(
    `/children/${childId}/contacts`
  );
  return response.data.data?.contacts ?? [];
};

export const createContact = async (childId: string, input: ContactInput): Promise<ContactRule> => {
  const response = await apiClient.post<ApiResponse<ContactRule>>(
    `/children/${childId}/contacts`,
    input
  );
  return response.data.data!;
};

export const updateContact = async (
  childId: string,
  contactId: string,
  input: ContactInput
): Promise<ContactRule> => {
  const response = await apiClient.put<ApiResponse<ContactRule>>(
    `/children/${childId}/contacts/${contactId}`,
    input
  );
  return response.data.data!;
};

export const deleteContact = async (childId: string, contactId: string): Promise<void> => {
  await apiClient.delete(`/children/${childId}/contacts/${contactId}`);
};

// ── Screen time ───────────────────────────────────────────────────

export const fetchDailyScreenTime = async (
  childId: string,
  date: string
): Promise<ScreenTimeRow[]> => {
  const response = await apiClient.get<ApiResponse<ScreenTimeRow[]>>(
    `/children/${childId}/screen-time?date=${date}`
  );
  return response.data.data ?? [];
};

export const fetchScreenTimeSummary = async (
  childId: string,
  range: 'day' | 'week' | 'month'
): Promise<ScreenTimeSummary> => {
  const response = await apiClient.get<ApiResponse<ScreenTimeSummary>>(
    `/children/${childId}/screen-time/summary?range=${range}`
  );
  return (
    response.data.data ?? { range, total_seconds: 0, daily: [], by_app: [] }
  );
};

// ── Location ──────────────────────────────────────────────────────

export const fetchCurrentLocations = async (childId: string): Promise<LocationPoint[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationPoint[] }>>(
    `/children/${childId}/locations/current`
  );
  return response.data.data?.locations ?? [];
};

export const fetchLocationHistory = async (childId: string): Promise<LocationPoint[]> => {
  const response = await apiClient.get<ApiResponse<{ locations: LocationPoint[] }>>(
    `/children/${childId}/locations/history?limit=100`
  );
  return response.data.data?.locations ?? [];
};

// ── Parent PIN (dashboard unlock) ─────────────────────────────────

export const setParentPin = async (pin: string): Promise<void> => {
  await apiClient.put('/auth/pin', { pin });
};

export const verifyParentPin = async (email: string, pin: string): Promise<void> => {
  await apiClient.post('/auth/pin/verify', { email, pin });
};

// ── Phase 2: URL Filtering ─────────────────────────────────────

export const fetchUrlFilters = async (childId: string): Promise<UrlFilterRule[]> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<UrlFilterRule>>>(
    `/children/${childId}/url-filters`
  );
  return response.data.data?.data ?? [];
};

export const createUrlFilter = async (childId: string, input: UrlFilterInput): Promise<UrlFilterRule> => {
  const response = await apiClient.post<ApiResponse<UrlFilterRule>>(
    `/children/${childId}/url-filters`, input
  );
  return response.data.data!;
};

export const updateUrlFilter = async (
  childId: string, ruleId: string, input: Partial<UrlFilterInput>
): Promise<UrlFilterRule> => {
  const response = await apiClient.put<ApiResponse<UrlFilterRule>>(
    `/children/${childId}/url-filters/${ruleId}`, input
  );
  return response.data.data!;
};

export const deleteUrlFilter = async (childId: string, ruleId: string): Promise<void> => {
  await apiClient.delete(`/children/${childId}/url-filters/${ruleId}`);
};

// ── Phase 2: Device Health ─────────────────────────────────────

export const fetchDeviceHealth = async (childId: string, deviceId: string): Promise<DeviceHealth | null> => {
  const response = await apiClient.get<ApiResponse<DeviceHealth>>(
    `/children/${childId}/devices/${deviceId}/health`
  );
  return response.data.data && Object.keys(response.data.data).length > 0 ? response.data.data : null;
};

export const fetchDeviceHealthHistory = async (
  childId: string, deviceId: string, limit = 48
): Promise<DeviceHealth[]> => {
  const response = await apiClient.get<ApiResponse<DeviceHealth[]>>(
    `/children/${childId}/devices/${deviceId}/health/history?limit=${limit}`
  );
  return response.data.data ?? [];
};

// ── Phase 2: Communication Logs ────────────────────────────────

export const fetchCommunicationLogs = async (
  childId: string, flaggedOnly = false, page = 1, limit = 50
): Promise<PaginatedResponse<CommunicationLog>> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (flaggedOnly) params.set('flagged', 'true');
  const response = await apiClient.get<ApiResponse<PaginatedResponse<CommunicationLog>>>(
    `/children/${childId}/communications?${params}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } };
};

export const fetchKeywordAlerts = async (
  childId: string, unreviewedOnly = false
): Promise<KeywordAlert[]> => {
  const params = unreviewedOnly ? '?unreviewed=true' : '';
  const response = await apiClient.get<ApiResponse<KeywordAlert[]>>(
    `/children/${childId}/keyword-alerts${params}`
  );
  return response.data.data ?? [];
};

export const reviewKeywordAlert = async (childId: string, alertId: string): Promise<KeywordAlert> => {
  const response = await apiClient.put<ApiResponse<KeywordAlert>>(
    `/children/${childId}/keyword-alerts/${alertId}/review`
  );
  return response.data.data!;
};

// ── Phase 2: Emergency SOS ─────────────────────────────────────

export const fetchSosEvents = async (
  childId: string,
  status?: string,
  page = 1,
  limit = 10
): Promise<PaginatedResponse<SosEvent>> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  const response = await apiClient.get<ApiResponse<PaginatedResponse<SosEvent>>>(
    `/children/${childId}/sos?${params}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit, total: 0, total_pages: 0 } };
};

export const acknowledgeSos = async (childId: string, eventId: string): Promise<SosEvent> => {
  const response = await apiClient.put<ApiResponse<SosEvent>>(
    `/children/${childId}/sos/${eventId}/acknowledge`
  );
  return response.data.data!;
};

export const resolveSos = async (
  childId: string, eventId: string, notes?: string
): Promise<SosEvent> => {
  const response = await apiClient.put<ApiResponse<SosEvent>>(
    `/children/${childId}/sos/${eventId}/resolve`, { notes }
  );
  return response.data.data!;
};

// ── Phase 2: Analytics & Reports ───────────────────────────────

export const generateReport = async (
  childId: string, reportType: 'WEEKLY' | 'MONTHLY'
): Promise<Record<string, unknown>> => {
  const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    `/children/${childId}/reports/generate`, { report_type: reportType }
  );
  return response.data.data!;
};

export const fetchLatestReport = async (
  childId: string, reportType: 'WEEKLY' | 'MONTHLY'
): Promise<AnalyticsReport | null> => {
  const response = await apiClient.get<ApiResponse<AnalyticsReport>>(
    `/children/${childId}/reports/latest?type=${reportType}`
  );
  return response.data.data && Object.keys(response.data.data).length > 0 ? response.data.data : null;
};

export const fetchReports = async (childId: string): Promise<AnalyticsReport[]> => {
  const response = await apiClient.get<ApiResponse<AnalyticsReport[]>>(
    `/children/${childId}/reports`
  );
  return response.data.data ?? [];
};

// ── Phase 2: Geofencing ───────────────────────────────────────

export const fetchGeofences = async (childId: string): Promise<Geofence[]> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Geofence>>>(
    `/children/${childId}/geofences`
  );
  return response.data.data?.data ?? [];
};

export const createGeofence = async (childId: string, input: GeofenceInput): Promise<Geofence> => {
  const response = await apiClient.post<ApiResponse<Geofence>>(
    `/children/${childId}/geofences`, input
  );
  return response.data.data!;
};

export const updateGeofence = async (
  childId: string, geofenceId: string, input: Partial<GeofenceInput>
): Promise<Geofence> => {
  const response = await apiClient.put<ApiResponse<Geofence>>(
    `/children/${childId}/geofences/${geofenceId}`, input
  );
  return response.data.data!;
};

export const deleteGeofence = async (childId: string, geofenceId: string): Promise<void> => {
  await apiClient.delete(`/children/${childId}/geofences/${geofenceId}`);
};

// ── Phase 2: Keyword Dictionary ────────────────────────────────

export const fetchKeywords = async (
  category?: string, page = 1, limit = 50
): Promise<PaginatedResponse<KeywordDictEntry>> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (category) params.set('category', category);
  const response = await apiClient.get<ApiResponse<PaginatedResponse<KeywordDictEntry>>>(
    `/keywords?${params}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } };
};

export const createKeyword = async (input: {
  category: string; keyword: string; severity?: string; language?: string
}): Promise<KeywordDictEntry> => {
  const response = await apiClient.post<ApiResponse<KeywordDictEntry>>('/keywords', input);
  return response.data.data!;
};

export const deleteKeyword = async (keywordId: string): Promise<void> => {
  await apiClient.delete(`/keywords/${keywordId}`);
};

// ── Phase 3: Mood Tracking ─────────────────────────────────────

export const fetchMoodLogs = async (
  childId: string,
  page = 1,
  limit = 20
): Promise<PaginatedResponse<MoodLog>> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<MoodLog>>>(
    `/children/${childId}/mood?page=${page}&limit=${limit}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit, total: 0, total_pages: 0 } };
};

export const fetchMoodSummary = async (childId: string): Promise<{ average: number; count: number } | null> => {
  const response = await apiClient.get<ApiResponse<{ average: number; count: number }>>(
    `/children/${childId}/mood/summary`
  );
  return response.data.data ?? null;
};

// ── Phase 3: Self-Harm Alerts ──────────────────────────────────

export const fetchSelfHarmAlerts = async (childId: string, unacknowledgedOnly = false): Promise<SelfHarmAlert[]> => {
  const params = unacknowledgedOnly ? '?unacknowledged=true' : '';
  const response = await apiClient.get<ApiResponse<SelfHarmAlert[]>>(
    `/children/${childId}/self-harm-alerts${params}`
  );
  return response.data.data ?? [];
};

export const acknowledgeSelfHarmAlert = async (childId: string, alertId: string): Promise<SelfHarmAlert> => {
  const response = await apiClient.put<ApiResponse<SelfHarmAlert>>(
    `/children/${childId}/self-harm-alerts/${alertId}/acknowledge`
  );
  return response.data.data!;
};

// ── Phase 3: Reward System ─────────────────────────────────────

export const fetchRewardCatalog = async (): Promise<RewardCatalogItem[]> => {
  const response = await apiClient.get<ApiResponse<RewardCatalogItem[]>>('/rewards/catalog');
  return response.data.data ?? [];
};

export const createRewardItem = async (input: {
  name: string; description?: string; cost_points: number; icon?: string
}): Promise<RewardCatalogItem> => {
  const response = await apiClient.post<ApiResponse<RewardCatalogItem>>('/rewards/catalog', input);
  return response.data.data!;
};

export const fetchRewardPoints = async (childId: string): Promise<RewardPoints> => {
  const response = await apiClient.get<ApiResponse<RewardPoints>>(`/children/${childId}/rewards/points`);
  return response.data.data ?? { total_points: 0, recent_entries: [] };
};

export const awardPoints = async (childId: string, input: {
  points: number; reason: string; source?: string
}): Promise<void> => {
  await apiClient.post(`/children/${childId}/rewards/points`, input);
};

export const fetchRedemptions = async (childId: string): Promise<RewardRedemption[]> => {
  const response = await apiClient.get<ApiResponse<RewardRedemption[]>>(
    `/children/${childId}/rewards/redemptions`
  );
  return response.data.data ?? [];
};

export const fetchRewardRedemptions = async (
  childId: string,
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED'
): Promise<RewardRedemption[]> => {
  const params = status ? `?status=${status}` : '';
  const response = await apiClient.get<ApiResponse<RewardRedemption[]>>(
    `/children/${childId}/rewards/redemptions${params}`
  );
  return response.data.data ?? [];
};

export const updateRedemptionStatus = async (
  childId: string,
  redemptionId: string,
  status: 'APPROVED' | 'REJECTED' | 'FULFILLED'
): Promise<RewardRedemption> => {
  const response = await apiClient.put<ApiResponse<RewardRedemption>>(
    `/children/${childId}/rewards/redemptions/${redemptionId}/status`,
    { status }
  );
  return response.data.data!;
};

export const redeemReward = async (childId: string, rewardId: string): Promise<RewardRedemption> => {
  const response = await apiClient.post<ApiResponse<RewardRedemption>>(
    `/children/${childId}/rewards/redeem`, { reward_id: rewardId }
  );
  return response.data.data!;
};

// ── Phase 4: Behavior Prediction ───────────────────────────────

export const fetchBehaviorPredictions = async (childId: string): Promise<BehaviorPrediction[]> => {
  const response = await apiClient.get<ApiResponse<BehaviorPrediction[]>>(
    `/children/${childId}/predictions`
  );
  return response.data.data ?? [];
};

// ── Phase 4: Security ─────────────────────────────────────────

export const fetchSecurityScans = async (childId: string, deviceId: string): Promise<SecurityScan[]> => {
  const response = await apiClient.get<ApiResponse<SecurityScan[]>>(
    `/children/${childId}/devices/${deviceId}/security-scans`
  );
  return response.data.data ?? [];
};

export const fetchWifiLogs = async (childId: string, deviceId: string): Promise<WifiLog[]> => {
  const response = await apiClient.get<ApiResponse<WifiLog[]>>(
    `/children/${childId}/devices/${deviceId}/wifi-logs`
  );
  return response.data.data ?? [];
};

// ── Phase 3: Self-Harm Alerts (count) ──────────────────────────

export const fetchSelfHarmAlertCount = async (childId: string): Promise<number> => {
  const response = await apiClient.get<ApiResponse<{ count: number }>>(
    `/children/${childId}/self-harm-alerts/count`
  );
  return response.data.data?.count ?? 0;
};

// ── Phase 3: Voice Commands ────────────────────────────────────

export interface VoiceCommand {
  id: string;
  child_id: string;
  device_id: string;
  command_text: string;
  intent: string | null;
  was_executed: boolean;
  recorded_at: string;
}

export const fetchVoiceCommands = async (childId: string, page = 1, limit = 50): Promise<PaginatedResponse<VoiceCommand>> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<VoiceCommand>>>(
    `/children/${childId}/voice-commands?page=${page}&limit=${limit}`
  );
  return response.data.data ?? { data: [], meta: { page: 1, limit: 50, total: 0, total_pages: 0 } };
};

// ── Phase 3: Integrations ─────────────────────────────────────

export interface IntegrationConfig {
  id: string;
  parent_id: string;
  integration_type: 'SCHOOL_PORTAL' | 'CALENDAR' | 'HEALTH_APP' | 'CUSTOM';
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export const fetchIntegrations = async (): Promise<IntegrationConfig[]> => {
  const response = await apiClient.get<ApiResponse<IntegrationConfig[]>>('/integrations');
  return response.data.data ?? [];
};

export const createIntegration = async (input: {
  integration_type: string;
  name: string;
  config?: Record<string, unknown>;
}): Promise<IntegrationConfig> => {
  const response = await apiClient.post<ApiResponse<IntegrationConfig>>('/integrations', input);
  return response.data.data!;
};

export const updateIntegration = async (
  integrationId: string,
  input: { name?: string; config?: Record<string, unknown>; is_active?: boolean }
): Promise<IntegrationConfig> => {
  const response = await apiClient.put<ApiResponse<IntegrationConfig>>(
    `/integrations/${integrationId}`, input
  );
  return response.data.data!;
};

export const deleteIntegration = async (integrationId: string): Promise<void> => {
  await apiClient.delete(`/integrations/${integrationId}`);
};

export const syncIntegration = async (integrationId: string): Promise<IntegrationConfig> => {
  const response = await apiClient.post<ApiResponse<IntegrationConfig>>(
    `/integrations/${integrationId}/sync`
  );
  return response.data.data!;
};

// ── Settings ──────────────────────────────────────────────────

export const fetchSettings = async (): Promise<UserSettings> => {
  const response = await apiClient.get<ApiResponse<UserSettings>>('/settings');
  return response.data.data!;
};

export const updateSettings = async (input: UserSettingsInput): Promise<UserSettings> => {
  const response = await apiClient.put<ApiResponse<UserSettings>>('/settings', input);
  return response.data.data!;
};

// ── AI Settings ──────────────────────────────────────────────

export interface AiSettings {
  id: string;
  provider: 'openai' | 'gemini' | 'anthropic';
  model: string;
  api_key_masked: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export const fetchAiSettings = async (): Promise<AiSettings[]> => {
  const response = await apiClient.get<ApiResponse<{ settings: AiSettings[] }>>('/ai/settings');
  return response.data.data?.settings ?? [];
};

export const saveAiSettings = async (input: {
  provider: 'openai' | 'gemini' | 'anthropic';
  api_key: string;
  model: string;
}): Promise<AiSettings> => {
  const response = await apiClient.put<ApiResponse<AiSettings>>('/ai/settings', input);
  return response.data.data!;
};

export const testAiConnection = async (provider: 'openai' | 'gemini' | 'anthropic'): Promise<void> => {
  await apiClient.post('/ai/test', { provider });
};

export const deleteAiSettings = async (provider: string): Promise<void> => {
  await apiClient.delete(`/ai/settings/${provider}`);
};

export const fetchAiModels = async (
  provider: 'openai' | 'gemini' | 'anthropic',
  apiKey: string
): Promise<ModelInfo[]> => {
  const response = await apiClient.post<ApiResponse<{ models: ModelInfo[] }>>('/ai/models/fetch', {
    provider,
    api_key: apiKey,
  });
  return response.data.data?.models ?? [];
};

// ── Notifications ─────────────────────────────────────────────

export const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await apiClient.get<ApiResponse<{ notifications: Notification[] }>>('/notifications');
  return response.data.data?.notifications ?? [];
};

export const markNotificationAsRead = async (notificationId: string): Promise<Notification> => {
  const response = await apiClient.patch<ApiResponse<Notification>>(
    `/notifications/${notificationId}/read`
  );
  return response.data.data!;
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  await apiClient.patch('/notifications/read-all');
};

// ── Alert acknowledgment ──────────────────────────────────────

export const acknowledgeAlert = async (childId: string, alertId: string): Promise<ChildAlert> => {
  const response = await apiClient.patch<ApiResponse<ChildAlert>>(
    `/children/${childId}/alerts/${alertId}/acknowledge`
  );
  return response.data.data!;
};

// ── Child management ──────────────────────────────────────────

export const updateChild = async (
  childId: string,
  input: { name?: string; birth_date?: string; daily_screen_time_limit_minutes?: number | null }
): Promise<ChildProfile> => {
  const response = await apiClient.put<ApiResponse<ChildProfile>>(
    `/children/${childId}`, input
  );
  return response.data.data!;
};

export const deleteChild = async (childId: string): Promise<void> => {
  await apiClient.delete(`/children/${childId}`);
};

export const updateChildPhone = async (childId: string, phone: string): Promise<ChildProfile> => {
  const response = await apiClient.put<ApiResponse<ChildProfile>>(
    `/child-users/${childId}/phone`, { phone_number: phone }
  );
  return response.data.data!;
};

// ── Admin API ──────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  trial_expires_at: string | null;
  subscription_updated_at: string | null;
  created_at: string;
  child_count: number;
  payment_count: number;
}

export interface AdminFeatureFlag {
  id: string;
  key: string;
  description: string | null;
  is_enabled: boolean;
  required_tier: string;
  updated_at: string;
}

export interface AdminSystemStats {
  total_users: number;
  free_users: number;
  active_trial_users: number;
  expired_trial_users: number;
  premium_users: number;
  admin_users: number;
  new_users_7d: number;
  new_users_30d: number;
}

export const fetchAdminStats = async (): Promise<AdminSystemStats> => {
  const response = await apiClient.get<ApiResponse<AdminSystemStats>>('/admin/stats');
  return response.data.data!;
};

export const fetchAdminUsers = async (
  page = 1, limit = 20, search?: string
): Promise<{ users: AdminUser[]; total: number }> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  const response = await apiClient.get<ApiResponse<{ users: AdminUser[]; total: number }>>(
    `/admin/users?${params}`
  );
  return response.data.data!;
};

export const fetchAdminUserById = async (userId: string): Promise<AdminUser> => {
  const response = await apiClient.get<ApiResponse<AdminUser>>(`/admin/users/${userId}`);
  return response.data.data!;
};

export const updateAdminUserSubscription = async (
  userId: string, tier: string, trial_days?: number
): Promise<AdminUser> => {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/users/${userId}/subscription`, { tier, trial_days }
  );
  return response.data.data!;
};

export const updateAdminUserRole = async (
  userId: string, role: string
): Promise<AdminUser> => {
  const response = await apiClient.patch<ApiResponse<AdminUser>>(
    `/admin/users/${userId}/role`, { role }
  );
  return response.data.data!;
};

export const fetchAdminFeatureFlags = async (): Promise<AdminFeatureFlag[]> => {
  const response = await apiClient.get<ApiResponse<AdminFeatureFlag[]>>('/admin/feature-flags');
  return response.data.data ?? [];
};

export const updateAdminFeatureFlag = async (
  key: string, patch: { is_enabled?: boolean; required_tier?: string }
): Promise<AdminFeatureFlag> => {
  const response = await apiClient.patch<ApiResponse<AdminFeatureFlag>>(
    `/admin/feature-flags/${key}`, patch
  );
  return response.data.data!;
};

// ── Subscription / Payment API ──────────────────────────────────────────────

export interface SubscriptionPlan {
  name: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key: string;
}

export const fetchSubscriptionPlans = async (): Promise<Record<string, SubscriptionPlan>> => {
  const response = await apiClient.get<ApiResponse<Record<string, SubscriptionPlan>>>('/subscriptions/plans');
  return response.data.data ?? {};
};

export const createRazorpayOrder = async (
  period: 'monthly' | 'yearly' = 'monthly'
): Promise<RazorpayOrderResponse> => {
  const response = await apiClient.post<ApiResponse<RazorpayOrderResponse>>(
    '/subscriptions/checkout/razorpay', { period }
  );
  return response.data.data!;
};

// ── Parental Consent ─────────────────────────────────────────

export const fetchConsents = async (childId: string): Promise<ParentalConsent[]> => {
  const response = await apiClient.get<ApiResponse<ParentalConsent[]>>(
    `/children/${childId}/consents`
  );
  return response.data.data ?? [];
};

export const grantConsent = async (
  childId: string,
  consentType: string
): Promise<ParentalConsent> => {
  const response = await apiClient.post<ApiResponse<ParentalConsent>>(
    `/children/${childId}/consents`, { consent_type: consentType }
  );
  return response.data.data!;
};

export const revokeConsent = async (
  childId: string,
  consentType: string
): Promise<void> => {
  await apiClient.delete(`/children/${childId}/consents/${encodeURIComponent(consentType)}`);
};
