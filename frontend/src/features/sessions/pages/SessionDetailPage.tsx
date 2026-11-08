import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';
import Badge from '../../../shared/components/ui/Badge';
import type { SessionStatus } from '../../../shared/types';

const decisionAr: Record<string, string> = {
  Recommended: 'يُوصى به',
  ConditionallyQualified: 'مؤهل',
  NotQualified: 'غير مؤهل',
  Employed: 'موظّف',
};

export default function SessionDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { user }   = useAppSelector(s => s.auth);
  const locale     = useAppSelector(s => s.ui.locale);
  const isAr       = locale === 'ar';

  const { activeRoleName } = useAppSelector(s => s.auth);
  const effectiveRole = activeRoleName ?? user?.roleName ?? '';

  const [session, setSession]           = useState<any>(null);
  const [candidates, setCandidates]     = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError]               = useState('');

  const label = (ar: string, en: string) => isAr ? ar : en;

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([
      api.sessions.get(id),
      api.candidates.list({ sessionId: id, pageSize: 100 }),
    ]).then(([sRes, cRes]) => {
      setSession(sRes.data);
      setCandidates(cRes.data.items ?? []);
    }).catch(() => setError(label('حدث خطأ أثناء تحميل البيانات', 'Failed to load session data')))
      .finally(() => setIsLoading(false));
  }, [id]);

  const reload = () => {
    if (!id) return;
    Promise.all([
      api.sessions.get(id),
      api.candidates.list({ sessionId: id, pageSize: 100 }),
    ]).then(([sRes, cRes]) => {
      setSession(sRes.data);
      setCandidates(cRes.data.items ?? []);
    });
  };

  const handleActivate = async () => {
    if (!id) return;
    setActionLoading(true);
    try { await api.sessions.activate(id); reload(); }
    catch (e: any) { setError(e?.response?.data?.message ?? label('فشل التفعيل', 'Activation failed')); }
    finally { setActionLoading(false); }
  };

  const handleClose = async () => {
    if (!id) return;
    if (!window.confirm(label('هل أنت متأكد من إغلاق هذه الجلسة؟', 'Are you sure you want to close this session?'))) return;
    setActionLoading(true);
    try { await api.sessions.close(id); reload(); }
    catch (e: any) { setError(e?.response?.data?.message ?? label('فشل الإغلاق', 'Close failed')); }
    finally { setActionLoading(false); }
  };

  const handleHardDelete = async () => {
    if (!id) return;
    if (!window.confirm(label('⚠️ سيتم حذف هذه الجلسة وجميع بياناتها نهائياً. هل أنت متأكد؟', '⚠️ This session and all its data will be permanently deleted. Are you sure?'))) return;
    setActionLoading(true);
    try {
      await api.sessions.hardDelete(id);
      navigate('/sessions');
    }
    catch (e: any) { setError(e?.response?.data?.message ?? label('فشل الحذف', 'Delete failed')); }
    finally { setActionLoading(false); }
  };

  if (isLoading) return <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{label('جارٍ التحميل...', 'Loading...')}</div>;
  if (!session)  return <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{error || label('الجلسة غير موجودة', 'Session not found')}</div>;

  const isAdmin      = effectiveRole === 'Admin';
  const canClose     = ['Admin', 'Manager', 'DataEntry'].includes(effectiveRole);
  const canRegister  = ['Admin', 'DataEntry'].includes(effectiveRole);
  const status: string   = session.status ?? '';

  return (
    <div>
      <button onClick={() => navigate('/sessions')} style={ghostBtnStyle}>
        {label('← العودة للقائمة', '← Back to sessions')}
      </button>

      {error && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-primary-dark)', fontWeight: 'var(--font-medium)' }}>
              {session.sessionCode}
            </span>
            <Badge variant="session" sessionStatus={status as SessionStatus}
              label={label({ Draft: 'مسودة', Active: 'نشطة', Closed: 'مغلقة', Archived: 'مؤرشفة' }[status] ?? status, status)}
            />
          </div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            {isAr ? session.titleAr : session.titleEn}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {session.jobPositionAr}
            {session.department ? ` · ${session.department}` : ''}
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {session.scheduledDate ? new Date(session.scheduledDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            {session.location ? ` · ${session.location}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {isAdmin && status === 'Draft' && (
            <button onClick={handleActivate} disabled={actionLoading} style={primaryBtnStyle}>
              {label('تفعيل الجلسة', 'Activate Session')}
            </button>
          )}
          {canClose && status === 'Active' && (
            <button onClick={handleClose} disabled={actionLoading}
              style={{ ...primaryBtnStyle, background: 'var(--color-danger)' }}>
              {label('إغلاق الجلسة', 'Close Session')}
            </button>
          )}
          {canRegister && status === 'Active' && (
            <button onClick={() => navigate(`/candidates/new?sessionId=${id}`)} style={primaryBtnStyle}>
              + {label('تسجيل مرشح', 'Register Candidate')}
            </button>
          )}
          {isAdmin && (
            <button onClick={handleHardDelete} disabled={actionLoading}
              style={{ ...primaryBtnStyle, background: '#7B2D2D' }}>
              {label('حذف نهائي', 'Hard Delete')}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[
          { labelAr: 'المرشحون', labelEn: 'Candidates', value: candidates.length },
          { labelAr: 'المقيّمون', labelEn: 'Evaluators', value: session.evaluators?.length ?? 0 },
          {
            labelAr: 'الموقع',
            labelEn: 'Location',
            value: session.location || label('غير محدد', 'N/A'),
          },
        ].map((info, i) => (
          <div key={i} style={statCardStyle}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              {isAr ? info.labelAr : info.labelEn}
            </p>
            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-thin)', color: 'var(--color-primary-dark)' }}>
              {info.value}
            </p>
          </div>
        ))}
      </div>

      {session.notes && (
        <div style={{ ...statCardStyle, marginBottom: 'var(--space-5)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <span style={{ color: 'var(--color-text-muted)', marginInlineEnd: 'var(--space-2)' }}>{label('ملاحظات:', 'Notes:')}</span>
          {session.notes}
        </div>
      )}

      {/* Evaluators */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <h3 style={sectionTitleStyle}>{label('المقيّمون المعيّنون', 'Assigned Evaluators')}</h3>
        </div>
        {(session.evaluators ?? []).length === 0 ? (
          <EmptyState text={label('لا يوجد مقيّمون مخصصون لهذه الجلسة', 'No evaluators assigned to this session')} />
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                {[label('الاسم', 'Name'), label('البريد الإلكتروني', 'Email'), label('تاريخ التعيين', 'Assigned At')].map((h, i) => (
                  <th key={i} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.evaluators.map((ev: any) => (
                <tr key={ev.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}>{isAr ? ev.fullNameAr : ev.fullNameEn}</td>
                  <td style={tdStyle}>{ev.email}</td>
                  <td style={tdStyle}>{new Date(ev.assignedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Candidates */}
      <div style={{ ...cardStyle, marginTop: 'var(--space-5)' }}>
        <div style={cardHeaderStyle}>
          <h3 style={sectionTitleStyle}>{label('المرشحون المسجّلون', 'Registered Candidates')}</h3>
        </div>
        {candidates.length === 0 ? (
          <EmptyState text={label('لا يوجد مرشحون مسجّلون في هذه الجلسة', 'No candidates registered in this session')} />
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                {[
                  label('رقم الهوية', 'National ID'),
                  label('الاسم', 'Name'),
                  label('الحالة', 'Status'),
                  label('متوسط الدرجات', 'Avg Score'),
                  label('قرار النظام', 'System Decision'),
                  label('بيانات المتقدم', 'Profile'),
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c: any, i: number) => (
                <tr key={c.id}
                  style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)', cursor: 'pointer' }}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)')}
                >
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{c.nationalId}</td>
                  <td style={tdStyle}>{isAr ? c.fullNameAr : c.fullNameEn}</td>
                  <td style={tdStyle}>
                    <CandidateStatusBadge status={c.candidateStatus} isAr={isAr} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {c.aggregateScore != null ? Number(c.aggregateScore).toFixed(1) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {c.systemDecision ? <DecisionBadge decision={c.systemDecision} isAr={isAr} /> : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button
                      title={label('عرض بيانات المتقدم', 'View candidate profile')}
                      onClick={e => { e.stopPropagation(); navigate(`/candidates/${c.id}`); }}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.315 0-10 1.668-10 5v1h20v-1c0-3.332-6.685-5-10-5z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
      {text}
    </div>
  );
}

function CandidateStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { ar: string; en: string; bg: string; color: string }> = {
    Pending:    { ar: 'قيد المراجعة',   en: 'Under Review', bg: 'var(--color-neutral-100)',    color: 'var(--color-text-secondary)' },
    InProgress: { ar: 'مرشح للمقابلة', en: 'Shortlisted',  bg: 'var(--color-warning-light)',  color: 'var(--color-warning)' },
    Completed:  { ar: 'تمت المقابلة',  en: 'Interviewed',  bg: 'var(--color-success-light)',  color: 'var(--color-success)' },
  };
  const s = map[status] ?? { ar: status, en: status, bg: 'var(--color-neutral-100)', color: 'var(--color-text-muted)' };
  return (
    <span style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: s.bg, color: s.color }}>
      {isAr ? s.ar : s.en}
    </span>
  );
}

const decisionTooltipAr: Record<string, string> = {
  Recommended:            'تم تصنيف المرشح كموصى به لأنه حصل على درجة تتراوح بين 24 و30 من أصل 30، مما يعكس أداءً متميزًا ويوصى باستكمال إجراءات التوظيف.',
  ConditionallyQualified: 'تم تصنيف المرشح كمؤهل لأنه حصل على درجة تتراوح بين 18 و23 من أصل 30، مما يدل على استيفائه الحد الأدنى من معايير التقييم.',
  NotQualified:           'تم تصنيف المرشح كغير مؤهل لأنه حصل على درجة تتراوح بين 0 و17 من أصل 30، وهي أقل من الحد الأدنى للاجتياز.',
  Employed:               'تم توظيف المرشح وإصدار القرار النهائي.',
};

const decisionTooltipEn: Record<string, string> = {
  Recommended:            'The candidate scored between 24–30 out of 30, reflecting outstanding performance. Proceeding with employment is recommended.',
  ConditionallyQualified: 'The candidate scored between 18–23 out of 30, meeting the minimum evaluation criteria.',
  NotQualified:           'The candidate scored between 0–17 out of 30, which is below the minimum passing threshold.',
  Employed:               'A final employment decision has been issued for this candidate.',
};

export function DecisionBadge({ decision, isAr }: { decision: string; isAr: boolean }) {
  const map: Record<string, { bg: string; color: string }> = {
    Recommended:           { bg: 'var(--color-recommended-bg)', color: 'var(--color-recommended)' },
    ConditionallyQualified:{ bg: 'var(--color-conditional-bg)', color: 'var(--color-conditional)' },
    NotQualified:          { bg: 'var(--color-danger-light)',    color: 'var(--color-danger)' },
    Employed:              { bg: 'var(--color-employed-bg)',     color: 'var(--color-employed)' },
  };
  const s       = map[decision] ?? { bg: 'var(--color-neutral-100)', color: 'var(--color-text-muted)' };
  const tooltip = isAr ? (decisionTooltipAr[decision] ?? '') : (decisionTooltipEn[decision] ?? '');
  return (
    <span
      title={tooltip}
      style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: s.bg, color: s.color, cursor: tooltip ? 'help' : 'default' }}
    >
      {isAr ? (decisionAr[decision] ?? decision) : decision}
    </span>
  );
}

// ── Shared styles ─────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-white)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
};
const cardHeaderStyle: React.CSSProperties = {
  padding: 'var(--space-4) var(--space-6)',
  borderBottom: '1px solid var(--color-border)',
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-base)',
  fontWeight: 'var(--font-regular)',
  color: 'var(--color-text-primary)',
};
const statCardStyle: React.CSSProperties = {
  background: 'var(--color-bg-white)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: 'var(--space-5)',
  boxShadow: 'var(--shadow-sm)',
};
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const theadRowStyle: React.CSSProperties = { background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' };
const thStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-4)',
  textAlign: 'start',
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-semibold)',
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const tdStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-primary)',
  verticalAlign: 'middle',
};
const primaryBtnStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-5)',
  background: 'var(--color-primary-dark)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-light)',
};
const ghostBtnStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-3)',
  background: 'transparent',
  color: 'var(--color-primary-dark)',
  border: '1px solid var(--color-primary-dark)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 'var(--text-xs)',
};
