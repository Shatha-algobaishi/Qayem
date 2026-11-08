import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchPendingDecisions } from '../managerSlice';
import { api } from '../../../core/api/apiClient';
import { DecisionBadge } from '../../sessions/pages/SessionDetailPage';

type DecisionType = 'NotQualified' | 'ConditionallyQualified' | 'Recommended' | 'Employed';

interface DecisionModalState {
  candidateId: string;
  candidateNameAr: string;
  candidateNameEn: string;
  systemDecision?: string;
}

export default function PendingDecisionsPage() {
  const dispatch   = useAppDispatch();
  const { pendingDecisions, isLoading } = useAppSelector(s => s.manager);
  const locale     = useAppSelector(s => s.ui.locale);
  const isAr       = locale === 'ar';
  const label      = (ar: string, en: string) => isAr ? ar : en;

  const [modal, setModal]       = useState<DecisionModalState | null>(null);
  const [decision, setDecision] = useState<DecisionType | ''>('');
  const [reason, setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { dispatch(fetchPendingDecisions()); }, [dispatch]);

  const openModal = (c: any) => {
    setModal({ candidateId: c.candidateId, candidateNameAr: c.fullNameAr, candidateNameEn: c.fullNameEn, systemDecision: c.systemDecision });
    setDecision('');
    setReason('');
    setError('');
  };

  const handleIssue = async () => {
    if (!modal || !decision || !reason.trim()) {
      setError(label('يرجى اختيار القرار وإدخال المبرر', 'Please select a decision and enter a justification'));
      return;
    }
    setSubmitting(true);
    try {
      await api.manager.issueDecision({ candidateId: modal.candidateId, decision, reason: reason.trim() });
      setModal(null);
      dispatch(fetchPendingDecisions());
    } catch (e: any) {
      setError(e?.response?.data?.message ?? label('فشل إصدار القرار', 'Failed to issue decision'));
    } finally {
      setSubmitting(false);
    }
  };

  const decisionOptions: { value: DecisionType; labelAr: string; labelEn: string; color: string }[] = [
    { value: 'Recommended',            labelAr: 'يُوصى به',  labelEn: 'Recommended',   color: 'var(--color-recommended)' },
    { value: 'ConditionallyQualified', labelAr: 'مؤهل',      labelEn: 'Qualified',     color: 'var(--color-conditional)' },
    { value: 'NotQualified',           labelAr: 'غير مؤهل',  labelEn: 'Not Qualified', color: 'var(--color-danger)' },
    { value: 'Employed',               labelAr: 'توظيف',     labelEn: 'Employed',      color: 'var(--color-primary-dark)' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
          {label('القرارات المعلقة', 'Pending Decisions')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label('المرشحون الذين يحتاجون إلى قرار نهائي من المدير', 'Candidates awaiting a final manager decision')}
        </p>
      </div>

      <div style={cardStyle}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {label('جارٍ التحميل...', 'Loading...')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                {[
                  label('المرشح', 'Candidate'),
                  label('رقم الهوية', 'National ID'),
                  label('متوسط الدرجات', 'Avg Score'),
                  label('قرار النظام', 'System Decision'),
                  label('عدد التقييمات', 'Evaluations'),
                  label('إجراء', 'Action'),
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {pendingDecisions.map((c, i) => (
                <tr key={c.candidateId}
                  style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 'var(--font-regular)' }}>{isAr ? c.fullNameAr : c.fullNameEn}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{c.nationalId}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {c.averageScore != null ? (
                      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-thin)', color: 'var(--color-primary-dark)' }}>
                        {Number(c.averageScore).toFixed(1)}<span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>/30</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td style={tdStyle}>
                    {c.systemDecision ? <DecisionBadge decision={c.systemDecision} isAr={isAr} /> : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {c.submittedEvaluations}/{c.totalAssignedEvaluators}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => openModal(c)} style={primaryBtnStyle}>
                      {label('إصدار قرار', 'Issue Decision')}
                    </button>
                  </td>
                </tr>
              ))}
              {pendingDecisions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا توجد قرارات معلقة', 'No pending decisions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Decision Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', width: '540px', maxWidth: '95vw', boxShadow: 'var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.2))', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', margin: 0 }}>
                {label('إصدار قرار نهائي', 'Issue Final Decision')}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)' }}>
                ×
              </button>
            </div>

            <div style={{ padding: 'var(--space-6)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
                {label('المرشح:', 'Candidate:')} <strong style={{ color: 'var(--color-text-primary)' }}>{isAr ? modal.candidateNameAr : modal.candidateNameEn}</strong>
              </p>

              {modal.systemDecision && (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{label('قرار النظام: ', 'System decision: ')}</span>
                  <DecisionBadge decision={modal.systemDecision} isAr={isAr} />
                </div>
              )}

              {/* Decision selection */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                  {label('القرار النهائي *', 'Final Decision *')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {decisionOptions.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', border: `1px solid ${decision === opt.value ? opt.color : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: decision === opt.value ? 'var(--color-neutral-50)' : 'var(--color-bg-white)' }}>
                      <input type="radio" name="decision" value={opt.value}
                        checked={decision === opt.value}
                        onChange={() => setDecision(opt.value)}
                        style={{ accentColor: opt.color }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: decision === opt.value ? opt.color : 'var(--color-text-primary)', fontWeight: decision === opt.value ? 'var(--font-medium)' : 'var(--font-regular)' }}>
                        {isAr ? opt.labelAr : opt.labelEn}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                  {label('مبرر القرار * (إلزامي)', 'Justification * (Required)')}
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  placeholder={label('أدخل مبرر القرار النهائي...', 'Enter justification for this decision...')}
                  style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--color-text-primary)' }}
                />
              </div>

              {error && (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button onClick={() => setModal(null)} style={cancelBtnStyle}>
                {label('إلغاء', 'Cancel')}
              </button>
              <button onClick={handleIssue} disabled={submitting || !decision || !reason.trim()} style={{ ...primaryBtnStyle, opacity: (!decision || !reason.trim()) ? 0.6 : 1 }}>
                {submitting ? label('جارٍ...', 'Processing...') : label('تأكيد القرار', 'Confirm Decision')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const thStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
const primaryBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };
const cancelBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg-white)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
