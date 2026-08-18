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