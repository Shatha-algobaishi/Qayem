import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchSessions, clearSessionsList } from '../sessionSlice';
import Badge from '../../../shared/components/ui/Badge';
import type { SessionStatus } from '../../../shared/types';
import { api } from '../../../core/api/apiClient';

export default function SessionsListPage() {
  const dispatch   = useAppDispatch();
  const navigate   = useNavigate();
  const { list, isLoading, error } = useAppSelector(s => s.sessions);
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  const effectiveRole = activeRoleName ?? user?.roleName ?? '';
  const locale     = useAppSelector(s => s.ui.locale);
  const isAr       = locale === 'ar';

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [reopening, setReopening]       = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchSessions({ page, pageSize: 20, status: statusFilter || undefined, search: search || undefined }));
  }, [dispatch, page, statusFilter, search]);

  useEffect(() => {
    return () => { dispatch(clearSessionsList()); };
  }, [dispatch]);

  const label = (ar: string, en: string) => isAr ? ar : en;

  const canCreate = ['Admin', 'DataEntry'].includes(effectiveRole);
  const canReopen = ['Admin', 'DataEntry'].includes(effectiveRole);

  const handleReopen = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!window.confirm(label('هل تريد إعادة فتح هذه الجلسة؟', 'Reopen this session?'))) return;
    setReopening(sessionId);
    try {
      await api.sessions.reopen(sessionId);
      dispatch(fetchSessions({ page, pageSize: 20, status: statusFilter || undefined, search: search || undefined }));
    } catch (err: any) {
      alert(err?.response?.data?.message ?? label('فشلت إعادة الفتح', 'Reopen failed'));
    } finally {
      setReopening(null);
    }
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'center',
        marginBottom:  'var(--space-6)',
      }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {label('جلسات المقابلة', 'Interview Sessions')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {list ? label(`${list.totalCount} جلسة إجمالاً`, `${list.totalCount} total sessions`) : ''}
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => navigate('/sessions/new')}
            style={primaryBtnStyle}
          >
            + {label('جلسة جديدة', 'New Session')}
          </button>
        )}
      </div>

      {error && <div className="form-error" role="alert">
        <p>{label('تعذر تحميل الجلسات. تحقق من الاتصال ثم أعد المحاولة.', 'Sessions could not be loaded. Check your connection and try again.')}</p>
        <button className="text-action" onClick={() => dispatch(fetchSessions({ page, pageSize: 20, status: statusFilter || undefined, search: search || undefined }))}>{label('إعادة المحاولة', 'Try again')}</button>
      </div>}
      {/* ── Filters ── */}
      <div style={{
        display:       'flex',
        gap:           'var(--space-3)',
        marginBottom:  'var(--space-5)',
        flexWrap:      'wrap',
      }}>
        <input
          type="search"
          aria-label={label('بحث في الجلسات', 'Search sessions')}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={label('بحث...', 'Search...')}
          style={{ ...filterInputStyle, width: '240px' }}
        />
        <select
          aria-label={label('حالة الجلسة', 'Session status')}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={filterInputStyle}
        >
          <option value="">{label('كل الجلسات', 'All Sessions')}</option>
          <option value="Active">{label('نشطة', 'Active')}</option>
          <option value="Closed">{label('مغلقة', 'Closed')}</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div style={{
        background:   'var(--color-bg-white)',
        borderRadius: 'var(--radius-lg)',
        border:       '1px solid var(--color-border)',
        overflow:     'hidden',
        boxShadow:    'var(--shadow-sm)',
      }}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {label('جارٍ التحميل...', 'Loading...')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                {[
                  label('رمز الجلسة', 'Session Code'),
                  label('المسمى الوظيفي', 'Job Position'),
                  label('القسم', 'Department'),
                  label('تاريخ الجلسة', 'Scheduled Date'),
                  label('المرشحون', 'Candidates'),
                  label('المقيّمون', 'Evaluators'),
                  label('الحالة', 'Status'),
                  '',
                ].map((col, i) => (
                  <th key={i} style={thStyle}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(list?.items ?? []).map((session, i) => (
                <tr
                  key={session.id}
                  style={{
                    borderBottom:    '1px solid var(--color-border)',
                    background:      i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)',
                    cursor:          'pointer',
                    transition:      'background var(--transition-fast)',
                  }}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)')}
                >
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 'var(--font-medium)', color: 'var(--color-primary-dark)', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                      {session.sessionCode}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 'var(--font-regular)', fontSize: 'var(--text-sm)' }}>
                      {isAr ? session.titleAr : session.titleEn}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {session.jobPositionAr}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {session.department}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>
                      {session.scheduledDate
                        ? new Date(session.scheduledDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'short', day: 'numeric' })
                        : '—'
                      }
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontSize:   'var(--text-sm)',
                      fontWeight: 'var(--font-medium)',
                      color:      'var(--color-text-primary)',
                    }}>
                      {session.candidateCount}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {session.evaluatorCount}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <Badge variant="session" sessionStatus={session.status as SessionStatus} label={isAr
                      ? ({ Draft: 'مسودة', Active: 'نشطة', Closed: 'مغلقة', Archived: 'مؤرشفة' }[session.status] ?? session.status)
                      : session.status
                    } />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'stretch', minWidth: '76px' }}>
                      <button
                        style={actionBtnStyle}
                        onClick={e => { e.stopPropagation(); navigate(`/sessions/${session.id}`); }}
                      >
                        {label('عرض', 'View')}
                      </button>
                      {canReopen && session.status === 'Closed' && (
                        <button
                          disabled={reopening === session.id}
                          style={{ ...actionBtnStyle, color: 'var(--color-success)', borderColor: 'var(--color-success)', opacity: reopening === session.id ? 0.6 : 1 }}
                          onClick={e => handleReopen(e, session.id)}
                        >
                          {reopening === session.id ? '...' : label('إعادة فتح', 'Reopen')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {(list?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {search || statusFilter ? label('لا توجد جلسات مطابقة. غيّر البحث أو امسح عوامل التصفية.', 'No matching sessions. Change your search or clear the filters.') : label('لا توجد جلسات بعد. أنشئ جلسة لتنظيم المقابلات وإسناد المقيّمين.', 'No sessions yet. Create a session to organize interviews and assign evaluators.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {list && list.totalPages > 1 && (
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            padding:        'var(--space-4) var(--space-6)',
            borderTop:      '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {isAr ? `صفحة ${list.page} من ${list.totalPages}` : `Page ${list.page} of ${list.totalPages}`}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtnStyle}>
                {isAr ? '›' : '‹'}
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= list.totalPages} style={paginationBtnStyle}>
                {isAr ? '‹' : '›'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding:       'var(--space-3) var(--space-4)',
  textAlign:     'start',
  fontSize:      'var(--text-xs)',
  fontWeight:    'var(--font-semibold)',
  color:         'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding:    'var(--space-4)',
  fontSize:   'var(--text-sm)',
  color:      'var(--color-text-primary)',
  verticalAlign: 'middle',
};

const primaryBtnStyle: React.CSSProperties = {
  padding:      'var(--space-3) var(--space-5)',
  background:   'var(--color-primary-dark)',
  color:        '#fff',
  border:       'none',
  borderRadius: 'var(--radius-md)',
  cursor:       'pointer',
  fontSize:     'var(--text-sm)',
  fontWeight:   'var(--font-light)',
  transition:   'all var(--transition-fast)',
};


const actionBtnStyle: React.CSSProperties = {
  padding:      'var(--space-1) 0',
  background:   'transparent',
  color:        'var(--color-primary-dark)',
  border:       '1px solid var(--color-primary-dark)',
  borderRadius: 'var(--radius-sm)',
  cursor:       'pointer',
  fontSize:     'var(--text-xs)',
  width:        '100%',
  textAlign:    'center',
  fontFamily:   'inherit',
};

const filterInputStyle: React.CSSProperties = {
  padding:      'var(--space-2) var(--space-3)',
  border:       '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize:     'var(--text-sm)',
  color:        'var(--color-text-primary)',
  background:   'var(--color-bg-white)',
  fontFamily:   'inherit',
  outline:      'none',
};

const paginationBtnStyle: React.CSSProperties = {
  width:        '32px',
  height:       '32px',
  border:       '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  background:   'var(--color-bg-white)',
  cursor:       'pointer',
  fontSize:     'var(--text-base)',
  color:        'var(--color-text-secondary)',
};
