import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Attach JWT to every request ───────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 ───────────────────────────────────────
let isRefreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

apiClient.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (original && error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        isRefreshing = false;
        clearSession();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
        localStorage.setItem('accessToken',  data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        queue.forEach(p => p.resolve(data.accessToken));
        queue = [];

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch {
        queue.forEach(p => p.reject(error));
        queue = [];
        clearSession();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('activeRoleName');
  window.location.href = '/login';
}

// ── Typed API helpers ─────────────────────────────────────────
export const api = {
  auth: {
    login:          (body: { username: string; password: string }) =>
                      apiClient.post('/auth/login', body),
    refreshToken:   (refreshToken: string) =>
                      apiClient.post('/auth/refresh-token', { refreshToken }),
    revokeToken:    (refreshToken: string) =>
                      apiClient.post('/auth/revoke-token', { refreshToken }),
    me:             () => apiClient.get('/auth/me'),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
                      apiClient.put('/auth/change-password', body),
  },

  sessions: {
    list:           (params?: Record<string, unknown>) => apiClient.get('/sessions', { params }),
    get:            (id: string)                       => apiClient.get(`/sessions/${id}`),
    create:         (body: unknown)                    => apiClient.post('/sessions', body),
    update:         (id: string, body: unknown)        => apiClient.put(`/sessions/${id}`, body),
    activate:       (id: string)                       => apiClient.post(`/sessions/${id}/activate`),
    close:          (id: string)                       => apiClient.post(`/sessions/${id}/close`),
    reopen:         (id: string)                       => apiClient.post(`/sessions/${id}/reopen`),
    hardDelete:     (id: string)                       => apiClient.delete(`/sessions/${id}`),
    getEvaluators:  (id: string)                       => apiClient.get(`/sessions/${id}/evaluators`),
    assignEvaluator:(id: string, userId: string)       => apiClient.post(`/sessions/${id}/evaluators`, { userId }),
    removeEvaluator:(id: string, userId: string)       => apiClient.delete(`/sessions/${id}/evaluators/${userId}`),
  },

  candidates: {
    list:              (params?: Record<string, unknown>) => apiClient.get('/candidates', { params }),
    get:               (id: string)                       => apiClient.get(`/candidates/${id}`),
    register:          (body: unknown)                    => apiClient.post('/candidates', body),
    update:            (id: string, body: unknown)        => apiClient.put(`/candidates/${id}`, body),
    scheduleInterview: (id: string, body: { scheduledAt: string; location?: string }) =>
                         apiClient.post(`/candidates/${id}/schedule-interview`, body),
    // CV
    uploadCv:      (id: string, file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post(`/candidates/${id}/cv`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    // AI: extract candidate fields from a CV before the candidate is created
    extractCv:     (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post('/candidates/cv/extract', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    downloadCvUrl: (id: string) => `${apiClient.defaults.baseURL}/candidates/${id}/cv/download`,
    previewCvUrl:  (id: string) => `${apiClient.defaults.baseURL}/candidates/${id}/cv/preview`,
    deleteCv:      (id: string) => apiClient.delete(`/candidates/${id}/cv`),
    assignSession:    (id: string, sessionId: string)     =>
                        apiClient.post(`/candidates/${id}/assign-session`, { sessionId }),
    // Per-candidate evaluator assignment
    getEvaluators:    (id: string)                        => apiClient.get(`/candidates/${id}/evaluators`),
    assignEvaluators: (id: string, evaluatorIds: string[]) =>
                        apiClient.post(`/candidates/${id}/evaluators`, { evaluatorIds }),
    removeEvaluator:  (id: string, userId: string)        =>
                        apiClient.delete(`/candidates/${id}/evaluators/${userId}`),
  },

  evaluations: {
    questions:   ()                          => apiClient.get('/evaluations/questions'),
    start:       (body: unknown)             => apiClient.post('/evaluations/start', body),
    get:         (id: string)               => apiClient.get(`/evaluations/${id}`),
    my:          ()                          => apiClient.get('/evaluations/my'),
    forSession:  (sessionId: string)         => apiClient.get(`/evaluations/session/${sessionId}`),
    save:        (id: string, body: unknown) => apiClient.post(`/evaluations/${id}/save`, body),
    submit:      (id: string)               => apiClient.post(`/evaluations/${id}/submit`),
  },

  manager: {
    dashboard:          ()                          => apiClient.get('/manager/dashboard'),
    pendingDecisions:   ()                          => apiClient.get('/manager/pending-decisions'),
    issueDecision:      (body: unknown)             => apiClient.post('/manager/decisions', body),
    sessionComparison:  (sessionId: string)         => apiClient.get(`/manager/sessions/${sessionId}/comparison`),
    evaluatorAnalytics: ()                          => apiClient.get('/manager/evaluator-analytics'),
    auditLog:           (params?: Record<string, unknown>) =>
                          apiClient.get('/manager/audit-log', { params }),
  },

  users: {
    list:          (params?: Record<string, unknown>) => apiClient.get('/users', { params }),
    get:           (id: string)                       => apiClient.get(`/users/${id}`),
    create:        (body: unknown)                    => apiClient.post('/users', body),
    update:        (id: string, body: unknown)        => apiClient.put(`/users/${id}`, body),
    activate:      (id: string)                       => apiClient.post(`/users/${id}/activate`),
    deactivate:    (id: string)                       => apiClient.post(`/users/${id}/deactivate`),
    softDelete:    (id: string)                       => apiClient.delete(`/users/${id}`),
    resetPassword: (id: string, newPassword: string)  => apiClient.post(`/users/${id}/reset-password`, { newPassword }),
    addRole:       (id: string, roleId: string)       => apiClient.post(`/users/${id}/roles/${roleId}`),
    removeRole:    (id: string, roleId: string)       => apiClient.delete(`/users/${id}/roles/${roleId}`),
    roles:         ()                                 => apiClient.get('/users/roles'),
    evaluators:    ()                                 => apiClient.get('/candidates/available-evaluators'),
  },

  admin: {
    // Questions
    questions:          ()                                => apiClient.get('/admin/questions'),
    createQuestion:     (body: unknown)                   => apiClient.post('/admin/questions', body),
    updateQuestion:     (id: string, body: unknown)       => apiClient.put(`/admin/questions/${id}`, body),
    activateQuestion:   (id: string)                      => apiClient.post(`/admin/questions/${id}/activate`),
    deactivateQuestion: (id: string)                      => apiClient.post(`/admin/questions/${id}/deactivate`),
    reorderQuestions:   (items: { id: string; orderIndex: number }[]) =>
                          apiClient.put('/admin/questions/reorder', { items }),
    deleteQuestion:     (id: string)                      => apiClient.delete(`/admin/questions/${id}`),
    // Settings
    settings:           ()                                => apiClient.get('/admin/settings'),
    updateSetting:      (key: string, value: string)      => apiClient.put(`/admin/settings/${key}`, { key, value }),
    // Reference lists
    referenceLists:       ()                              => apiClient.get('/admin/reference-lists'),
    getReferenceList:     (listName: string)              => apiClient.get(`/admin/reference-lists/${listName}`),
    addRefListItem:       (listName: string, body: { valueAr: string; valueEn: string }) =>
                            apiClient.post(`/admin/reference-lists/${listName}/items`, body),
    updateRefListItem:    (itemId: string, body: { valueAr: string; valueEn: string }) =>
                            apiClient.put(`/admin/reference-lists/items/${itemId}`, body),
    deleteRefListItem:    (itemId: string)                => apiClient.delete(`/admin/reference-lists/items/${itemId}`),
    deleteEvaluation:     (id: string)                    => apiClient.delete(`/admin/evaluations/${id}`),
    fixCandidateStatuses: ()                               => apiClient.post('/admin/fix-candidate-statuses'),
  },

  notifications: {
    list:       (params?: { unreadOnly?: boolean; page?: number; pageSize?: number }) =>
                  apiClient.get('/notifications', { params }),
    unreadCount:()                    => apiClient.get('/notifications/unread-count'),
    markRead:   (id: string)          => apiClient.post(`/notifications/${id}/read`),
    markAllRead:()                    => apiClient.post('/notifications/read-all'),
  },

  reports: {
    candidates: (params?: Record<string, unknown>) => apiClient.get('/reports/candidates', { params }),
    sessions:   (params?: Record<string, unknown>) => apiClient.get('/reports/sessions', { params }),
    evaluators: (params?: Record<string, unknown>) => apiClient.get('/reports/evaluators', { params }),
    results:    (params?: Record<string, unknown>) => apiClient.get('/reports/results', { params }),
    exportUrl:  (type: string, params?: Record<string, unknown>) => {
      const qs = new URLSearchParams({ exportCsv: 'true', ...Object.fromEntries(
        Object.entries(params ?? {}).filter(([,v]) => v != null).map(([k,v]) => [k, String(v)])
      )}).toString();
      return `${apiClient.defaults.baseURL}/reports/${type}?${qs}`;
    },
  },
};
