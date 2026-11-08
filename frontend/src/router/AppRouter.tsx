import DemoGuidePage from '../features/auth/pages/DemoGuidePage';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../app/store';
import MainLayout from '../shared/components/layout/MainLayout';

import LoginPage              from '../features/auth/pages/LoginPage';
import RoleSelectionPage      from '../features/auth/pages/RoleSelectionPage';
import SessionsListPage       from '../features/sessions/pages/SessionsListPage';
import SessionDetailPage      from '../features/sessions/pages/SessionDetailPage';
import CreateSessionPage      from '../features/sessions/pages/CreateSessionPage';
import EvaluationFormPage     from '../features/evaluations/pages/EvaluationFormPage';
import EvaluationStartPage    from '../features/evaluations/pages/EvaluationStartPage';
import MyEvaluationsPage      from '../features/evaluations/pages/MyEvaluationsPage';
import ManagerDashboardPage   from '../features/manager/pages/ManagerDashboardPage';
import PendingDecisionsPage   from '../features/manager/pages/PendingDecisionsPage';
import AuditLogPage           from '../features/manager/pages/AuditLogPage';
import SessionComparisonPage  from '../features/manager/pages/SessionComparisonPage';
import EvaluatorAnalyticsPage from '../features/manager/pages/EvaluatorAnalyticsPage';
import CandidatesListPage     from '../features/candidates/pages/CandidatesListPage';
import RegisterCandidatePage  from '../features/candidates/pages/RegisterCandidatePage';
import CandidateDetailPage    from '../features/candidates/pages/CandidateDetailPage';
import UsersManagementPage    from '../features/admin/pages/UsersManagementPage';
import QuestionsManagementPage from '../features/admin/pages/QuestionsManagementPage';
import SystemSettingsPage     from '../features/admin/pages/SystemSettingsPage';
import ReferenceListsPage     from '../features/admin/pages/ReferenceListsPage';
import ReportsPage            from '../features/reports/pages/ReportsPage';

function RoleGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  if (!user) return <Navigate to="/login" replace />;
  const effectiveRole = activeRoleName ?? user.roleName;
  if (!roles.includes(effectiveRole)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRedirect() {
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  if (!user) return <Navigate to="/login" replace />;

  const hasMultipleRoles = (user.additionalRoles?.length ?? 0) > 0;
  if (hasMultipleRoles && !activeRoleName) return <Navigate to="/select-role" replace />;

  const effectiveRole = activeRoleName ?? user.roleName;
  const redirects: Record<string, string> = {
    Admin:     '/sessions',
    DataEntry: '/sessions',
    Evaluator: '/evaluations/my',
    Manager:   '/manager/dashboard',
  };

  return <Navigate to={redirects[effectiveRole] ?? '/sessions'} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Role selection — auth required, no sidebar */}
        <Route path="/select-role" element={
          <AuthGuard>
            <RoleSelectionPage />
          </AuthGuard>
        } />

        {/* Protected shell */}
        <Route
          path="/"
          element={
            <AuthGuard>
              <MainLayout />
            </AuthGuard>
          }
        >
          <Route index element={<RoleRedirect />} />
          <Route path="demo-guide" element={<DemoGuidePage />} />

          {/* Sessions */}
          <Route path="sessions">
            <Route index element={<SessionsListPage />} />
            <Route
              path="new"
              element={
                <RoleGuard roles={['Admin', 'DataEntry']}>
                  <CreateSessionPage />
                </RoleGuard>
              }
            />
            <Route path=":id" element={<SessionDetailPage />} />
          </Route>

          {/* Candidates */}
          <Route path="candidates">
            <Route index element={<CandidatesListPage />} />
            <Route
              path="new"
              element={
                <RoleGuard roles={['Admin', 'DataEntry']}>
                  <RegisterCandidatePage />
                </RoleGuard>
              }
            />
            <Route path=":id" element={<CandidateDetailPage />} />
          </Route>

          {/* Evaluations */}
          <Route path="evaluations">
            <Route
              path="my"
              element={
                <RoleGuard roles={['Evaluator']}>
                  <MyEvaluationsPage />
                </RoleGuard>
              }
            />
            <Route
              path="start"
              element={
                <RoleGuard roles={['Evaluator']}>
                  <EvaluationStartPage />
                </RoleGuard>
              }
            />
            <Route path=":id" element={<EvaluationFormPage />} />
          </Route>

          {/* Manager */}
          <Route
            path="manager"
            element={
              <RoleGuard roles={['Manager', 'Admin']}>
                <Outlet />
              </RoleGuard>
            }
          >
            <Route path="dashboard"                    element={<ManagerDashboardPage />} />
            <Route path="pending"                      element={<PendingDecisionsPage />} />
            <Route path="audit"                        element={<AuditLogPage />} />
            <Route path="sessions/:sessionId/compare"  element={<SessionComparisonPage />} />
            <Route path="evaluator-analytics"          element={<EvaluatorAnalyticsPage />} />
          </Route>

          {/* Reports */}
          <Route
            path="reports"
            element={
              <RoleGuard roles={['Admin', 'Manager']}>
                <ReportsPage />
              </RoleGuard>
            }
          />

          {/* Admin */}
          <Route
            path="admin"
            element={
              <RoleGuard roles={['Admin']}>
                <Outlet />
              </RoleGuard>
            }
          >
            <Route path="users"           element={<UsersManagementPage />} />
            <Route path="questions"       element={<QuestionsManagementPage />} />
            <Route path="settings"        element={<SystemSettingsPage />} />
            <Route path="reference-lists" element={<ReferenceListsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
