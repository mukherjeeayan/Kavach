import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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
}

interface AuthState {
  // Presence of the in-memory token (or a restorable cookie session)
  // decides route protection. The token value itself is never kept in
  // the Redux store / localStorage.
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
