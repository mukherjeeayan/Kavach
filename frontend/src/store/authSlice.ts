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
  role: 'parent' | 'child' | null;
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