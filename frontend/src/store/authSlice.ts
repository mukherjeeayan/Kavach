import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  clearStoredSession,
  getStoredToken,
  getStoredUser,
  persistSession,
  PersistedSession,
} from '../services/session';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  token: getStoredToken(),
  user: getStoredUser(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<PersistedSession>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      persistSession(action.payload);
    },
    clearSession(state) {
      state.token = null;
      state.user = null;
      clearStoredSession();
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;