import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import authReducer        from '../features/auth/authSlice';
import sessionsReducer    from '../features/sessions/sessionSlice';
import evaluationsReducer from '../features/evaluations/evaluationSlice';
import managerReducer     from '../features/manager/managerSlice';
import uiReducer          from './uiSlice';

export const store = configureStore({
  reducer: {
    auth:        authReducer,
    sessions:    sessionsReducer,
    evaluations: evaluationsReducer,
    manager:     managerReducer,
    ui:          uiReducer,
  },
  middleware: getDefault =>
    getDefault({ serializableCheck: { ignoredActionPaths: ['payload.config'] } }),
});

export type RootState    = ReturnType<typeof store.getState>;
export type AppDispatch  = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
