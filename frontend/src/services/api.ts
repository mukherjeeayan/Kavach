/**
 * Typed API layer — the only place that talks to the backend.
 * Every endpoint used by the UI is exposed as a function here so
 * pages and hooks never build URLs or touch apiClient directly.
 */
import apiClient from './apiClient';
import type {
  ApiResponse,
  AppBlockRule,
  ChildProfile,
  ContactInput,
  ContactRule,
  DeviceProfile,
  LocationPoint,
  LockInput,
  LoginPayload,
  ScheduledLock,
  ScreenTimeRow,
  ScreenTimeSummary,
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

export const fetchChildren = async (): Promise<ChildProfile[]> => {
  const response = await apiClient.get<ApiResponse<{ children: ChildProfile[] }>>('/children');
  return response.data.data?.children ?? [];
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
