import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../core/api/apiClient';
import type { SessionSummary, SessionDetail, PagedResult } from '../../shared/types';

interface SessionsState {
  list:        PagedResult<SessionSummary> | null;
  current:     SessionDetail | null;
  isLoading:   boolean;
  error:       string | null;
}

const initialState: SessionsState = {
  list:      null,
  current:   null,
  isLoading: false,
  error:     null,
};

export const fetchSessions = createAsyncThunk(
  'sessions/list',
  async (params: Record<string, unknown> = {}) => {
    const { data } = await api.sessions.list(params);
    return data as PagedResult<SessionSummary>;
  },
);

export const fetchSession = createAsyncThunk(
  'sessions/get',
  async (id: string) => {
    const { data } = await api.sessions.get(id);
    return data as SessionDetail;
  },
);

const sessionSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    clearCurrentSession(state) { state.current = null; },
    clearSessionsList(state)   { state.list = null; },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchSessions.pending,  state => { state.isLoading = true;  state.error = null; })
      .addCase(fetchSessions.fulfilled,(state, a) => { state.isLoading = false; state.list = a.payload; })
      .addCase(fetchSessions.rejected, (state, a) => { state.isLoading = false; state.error = a.error.message ?? null; })
      .addCase(fetchSession.pending,   state => { state.isLoading = true;  })
      .addCase(fetchSession.fulfilled, (state, a) => { state.isLoading = false; state.current = a.payload; })
      .addCase(fetchSession.rejected,  (state, a) => { state.isLoading = false; state.error = a.error.message ?? null; });
  },
});

export const { clearCurrentSession, clearSessionsList } = sessionSlice.actions;
export default sessionSlice.reducer;
