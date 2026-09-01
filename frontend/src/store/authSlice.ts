import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import {
  clearStoredSession,
  getAccessToken,
  getStoredUser,
  persistSession,
  AuthSession,
} from '../services/session';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'child' | 'admin' | null;
  subscription_tier?: 'FREE' | 'TRIAL' | 'PREMIUM';
  trial_expires_at?: string | null;
}

interface AuthState {
  hasToken: boolean;
  user: AuthUser | null;
}

const initialState: AuthState = {
  hasToken: Boolean(getAccessToken()) || Boolean(getStoredUser()),
  user: getStoredUser(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<AuthSession>) {
      state.hasToken = true;
      state.user = action.payload.user;
      persistSession(action.payload);
    },
    clearSession(state) {
      state.hasToken = false;
      state.user = null;
      clearStoredSession();
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;

// Use selector to get auth state
export const useAuth = () => {
  const hasToken = useSelector((state: RootState) => state.auth.hasToken);
  const user = useSelector((state: RootState) => state.auth.user);
  return { hasToken, user };
};

// Role-based access control hook
export const useRole = (role: 'parent' | 'child') => {
  const { user } = useAuth();
  return user?.role === role;
};

// Check if user is admin
export const useIsAdmin = () => {
  const { user } = useAuth();
  return user?.role === 'admin';
};

// Check if user has active premium subscription
export const useIsPremium = () => {
  const { user } = useAuth();
  if (!user) return false;
  if (user.subscription_tier === 'PREMIUM') return true;
  if (user.subscription_tier === 'TRIAL' && user.trial_expires_at) {
    return new Date(user.trial_expires_at).getTime() > Date.now();
  }
  return false;
};

// Get current subscription tier (defaults to FREE)
export const useSubscriptionTier = (): 'FREE' | 'TRIAL' | 'PREMIUM' => {
  const { user } = useAuth();
  return user?.subscription_tier ?? 'FREE';
};