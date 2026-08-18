import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const TOKEN_KEY = 'kavach_token';

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
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem(TOKEN_KEY, action.payload.token);
    },
    clearSession(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export default authSlice.reducer;