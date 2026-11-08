import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../core/api/apiClient';
import type {
  ManagerDashboard,
  CandidateEvaluationSummary,
  SessionComparisonDto,
  EvaluatorAnalyticsDto,
} from '../../shared/types';

interface ManagerState {
  dashboard:          ManagerDashboard | null;
  pendingDecisions:   CandidateEvaluationSummary[];
  comparison:         SessionComparisonDto | null;
  evaluatorAnalytics: EvaluatorAnalyticsDto[];
  isLoading:          boolean;
  error:              string | null;
}

const initialState: ManagerState = {
  dashboard:          null,
  pendingDecisions:   [],
  comparison:         null,
  evaluatorAnalytics: [],
  isLoading:          false,
  error:              null,
};

export const fetchDashboard = createAsyncThunk('manager/dashboard', async () => {
  const { data } = await api.manager.dashboard();
  return data as ManagerDashboard;
});

export const fetchPendingDecisions = createAsyncThunk('manager/pending', async () => {
  const { data } = await api.manager.pendingDecisions();
  return data as CandidateEvaluationSummary[];
});

export const fetchSessionComparison = createAsyncThunk(
  'manager/comparison',
  async (sessionId: string) => {
    const { data } = await api.manager.sessionComparison(sessionId);
    return data as SessionComparisonDto;
  },
);

export const fetchEvaluatorAnalytics = createAsyncThunk(
  'manager/evaluatorAnalytics',
  async () => {
    const { data } = await api.manager.evaluatorAnalytics();
    return data as EvaluatorAnalyticsDto[];
  },
);

const managerSlice = createSlice({
  name: 'manager',
  initialState,
  reducers: {
    clearComparison: s => { s.comparison = null; },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchDashboard.pending,           s    => { s.isLoading = true; s.error = null; })
      .addCase(fetchDashboard.fulfilled,         (s,a)=> { s.isLoading = false; s.dashboard = a.payload; })
      .addCase(fetchDashboard.rejected,          (s,a)=> { s.isLoading = false; s.error = a.error.message ?? null; })

      .addCase(fetchPendingDecisions.pending,    s    => { s.isLoading = true; })
      .addCase(fetchPendingDecisions.fulfilled,  (s,a)=> { s.isLoading = false; s.pendingDecisions = a.payload; })
      .addCase(fetchPendingDecisions.rejected,   (s,a)=> { s.isLoading = false; s.error = a.error.message ?? null; })

      .addCase(fetchSessionComparison.pending,   s    => { s.isLoading = true; s.comparison = null; })
      .addCase(fetchSessionComparison.fulfilled, (s,a)=> { s.isLoading = false; s.comparison = a.payload; })
      .addCase(fetchSessionComparison.rejected,  (s,a)=> { s.isLoading = false; s.error = a.error.message ?? null; })

      .addCase(fetchEvaluatorAnalytics.pending,  s    => { s.isLoading = true; })
      .addCase(fetchEvaluatorAnalytics.fulfilled,(s,a)=> { s.isLoading = false; s.evaluatorAnalytics = a.payload; })
      .addCase(fetchEvaluatorAnalytics.rejected, (s,a)=> { s.isLoading = false; s.error = a.error.message ?? null; });
  },
});

export const { clearComparison } = managerSlice.actions;
export default managerSlice.reducer;
