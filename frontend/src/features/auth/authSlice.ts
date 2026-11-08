import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../../core/api/apiClient';
import type { AuthState, UserDto } from '../../shared/types';

function readUser(): UserDto | null {
  try { return JSON.parse(localStorage.getItem('user') ?? 'null'); }
  catch { localStorage.removeItem('user'); return null; }
}
const persistedUser = readUser();
const initialState: AuthState = {
  user:            persistedUser,
  accessToken:     localStorage.getItem('accessToken'),
  refreshToken:    localStorage.getItem('refreshToken'),
  isAuthenticated: !!persistedUser && !!localStorage.getItem('accessToken'),
  isLoading:       false,
  error:           null,
  activeRoleName:  localStorage.getItem('activeRoleName'),
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.auth.login(credentials);
      return data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string; message?: string } } };
      return rejectWithValue(error.response?.data?.message ?? error.response?.data?.detail ?? 'Unable to sign in. Check your connection and try again.');
    }
  },
);

export const logout = createAsyncThunk('auth/logout', async (_, { getState }) => {
  const state = getState() as { auth: AuthState };
  if (state.auth.refreshToken) {
    await api.auth.revokeToken(state.auth.refreshToken).catch(() => undefined);
  }
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: UserDto; accessToken: string; refreshToken: string }>) {
      state.user            = action.payload.user;
      state.accessToken     = action.payload.accessToken;
      state.refreshToken    = action.payload.refreshToken;
      state.isAuthenticated = true;
      localStorage.setItem('accessToken',  action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      localStorage.setItem('user',         JSON.stringify(action.payload.user));
    },
    switchRole(state, action: PayloadAction<string>) {
      const roles = [state.user?.roleName, ...(state.user?.additionalRoles ?? []).map(r => r.roleName)];
      if (!roles.includes(action.payload)) return;
      state.activeRoleName = action.payload;
      localStorage.setItem('activeRoleName', action.payload);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.isLoading = true;
        state.error     = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading       = false;
        state.isAuthenticated = true;
        state.user            = action.payload.user;
        state.accessToken     = action.payload.accessToken;
        state.refreshToken    = action.payload.refreshToken;
        // Clear active role on fresh login so multi-role users get the selection screen
        state.activeRoleName  = null;
        localStorage.setItem('accessToken',  action.payload.accessToken);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
        localStorage.setItem('user',         JSON.stringify(action.payload.user));
        localStorage.removeItem('activeRoleName');
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error     = action.payload as string;
      })
      .addCase(logout.fulfilled, state => {
        state.user            = null;
        state.accessToken     = null;
        state.refreshToken    = null;
        state.isAuthenticated = false;
        state.activeRoleName  = null;
        localStorage.removeItem('activeRoleName');
      });
  },
});

export const { setCredentials, switchRole, clearError } = authSlice.actions;
export default authSlice.reducer;
