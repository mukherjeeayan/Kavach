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
  DeviceProfile,
  LoginPayload,
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
