import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '../../core/api/apiClient';
import type { EvaluationDto, Question, CandidateEvaluationSummary } from '../../shared/types';

interface EvaluationsState {
  questions:         Question[];
  myEvaluations:     EvaluationDto[];
  pendingCandidates: any[];
  current:           EvaluationDto | null;
  sessionSummary:    CandidateEvaluationSummary[];
  isLoading:         boolean;
  isSubmitting:      boolean;
  error:             string | null;
}

const initialState: EvaluationsState = {
  questions:         [],
  myEvaluations:     [],
  pendingCandidates: [],
  current:           null,
  sessionSummary:    [],
  isLoading:         false,
  isSubmitting:      false,
  error:             null,
};

export const fetchQuestions = createAsyncThunk('evaluations/questions', async () => {
  const { data } = await api.evaluations.questions();
  return data as Question[];
});

export const fetchMyEvaluations = createAsyncThunk('evaluations/my', async () => {
  const { data } = await api.evaluations.my();
  return {
    evaluations:      (data.evaluations ?? data) as EvaluationDto[],
    pendingCandidates: data.pendingCandidates ?? [],
  };
});

export const fetchEvaluation = createAsyncThunk('evaluations/get', async (id: string) => {
  const { data } = await api.evaluations.get(id);
  return data as EvaluationDto;
});

export const fetchSessionEvaluations = createAsyncThunk(
  'evaluations/forSession',
  async (sessionId: string) => {
    const { data } = await api.evaluations.forSession(sessionId);
    return data as CandidateEvaluationSummary[];
  },
);

const evaluationSlice = createSlice({
  name: 'evaluations',
  initialState,
  reducers: {
    clearCurrent(state) { state.current = null; },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchQuestions.fulfilled,        (s, a) => { s.questions     = a.payload; })
      .addCase(fetchMyEvaluations.fulfilled,    (s, a) => {
        s.myEvaluations     = a.payload.evaluations;
        s.pendingCandidates = a.payload.pendingCandidates;
      })
      .addCase(fetchEvaluation.fulfilled,       (s, a) => { s.current       = a.payload; })
      .addCase(fetchSessionEvaluations.pending,   s    => { s.isLoading = true; })
      .addCase(fetchSessionEvaluations.fulfilled,(s, a) => { s.isLoading = false; s.sessionSummary = a.payload; })
      .addCase(fetchSessionEvaluations.rejected,  s    => { s.isLoading = false; });
  },
});

export const { clearCurrent } = evaluationSlice.actions;
export default evaluationSlice.reducer;
