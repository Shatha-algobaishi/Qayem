import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchMyEvaluations } from '../evaluationSlice';
import { DecisionBadge } from '../../sessions/pages/SessionDetailPage';
import SignatureModal, { getSignature } from '../../../shared/components/ui/SignatureModal';

export default function MyEvaluationsPage() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const { myEvaluations, pendingCandidates, isLoading } = useAppSelector(s => s.evaluations);
  const locale    = useAppSelector(s => s.ui.locale);
  const user      = useAppSelector(s => s.auth.user);
  const isAr      = locale === 'ar';
  const label     = (ar: string, en: string) => isAr ? ar : en;

  const [showSigModal, setShowSigModal] = useState(false);
  const [, setSigRefresh] = useState(0);

  useEffect(() => { dispatch(fetchMyEvaluations()); }, [dispatch]);

  const currentSig = user ? getSignature(user.id) : null;

  const statusAr: Record<string, string> = {
    Draft:             'مسودة',
    Submitted:         'مقدَّم',
    ReviewedByManager: 'مراجَع من المدير',
  };
  const statusEn: Record<string, string> = {
    Draft:             'Draft',
    Submitted:         'Submitted',
    ReviewedByManager: 'Reviewed by Manager',
  };
  const statusStyle: Record<string, { bg: string; color: string }> = {
    Draft:             { bg: 'var(--color-neutral-100)',   color: 'var(--color-text-secondary)' },
    Submitted:         { bg: 'var(--color-info-light)',    color: 'var(--color-info)' },
    ReviewedByManager: { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
          {label('تقييماتي', 'My Evaluations')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label(`${myEvaluations.length} تقييم`, `${myEvaluations.length} evaluation(s)`)}
          {pendingCandidates.length > 0 && (
            <span style={{ marginInlineStart: 'var(--space-3)', color: 'var(--color-warning)', fontWeight: 'var(--font-medium)' }}>
              {label(` • ${pendingCandidates.length} مرشح بانتظار التقييم`, ` • ${pendingCandidates.length} candidate(s) awaiting evaluation`)}
            </span>
          )}
        </p>
      </div>

      {/* ── Electronic Signature Section ── */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)', borderColor: currentSig ? 'var(--color-primary-dark)' : 'var(--color-border)' }}>
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-primary-dark)">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
              {label('التوقيع الإلكتروني', 'Electronic Signature')}
            </span>
            {currentSig && (
              <span style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                {label('محفوظ', 'Saved')}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowSigModal(true)}
            style={currentSig ? ghostBtnStyle : primaryBtnStyle}
          >
            {currentSig ? label('تعديل التوقيع', 'Edit Signature') : label('إضافة توقيع', 'Add Signature')}
          </button>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          {currentSig ? (
            <>
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-neutral-50)',
                padding: 'var(--space-2)',
                display: 'inline-flex',
              }}>
                <img
                  src={currentSig}
                  alt={label('التوقيع الإلكتروني', 'Electronic Signature')}
                  style={{ height: 56, maxWidth: 200, objectFit: 'contain', display: 'block' }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {label('يظهر هذا التوقيع عند طباعة التقييمات', 'This signature appears when printing evaluations')}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {label('لم تُضَف توقيع بعد. أضف توقيعاً ليظهر في تقاريرك المطبوعة.', 'No signature added yet. Add one to appear on your printed evaluations.')}
            </p>
          )}
        </div>
      </div>

      {/* Pending candidates assigned at candidate level */}
      {pendingCandidates.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 'var(--space-5)', borderColor: 'var(--color-warning)' }}>
          <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', color: 'var(--color-text-primary)' }}>
              {label('مرشحون بانتظار تقييمك', 'Candidates Awaiting Your Evaluation')}
            </span>
          </div>
          <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {pendingCandidates.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-neutral-50)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{c.fullNameAr}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.nationalId}</p>
                  {!c.sessionId && (
                    <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>
                      {label('غير مسند لجلسة', 'No session assigned')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/evaluations/start?candidateId=${c.id}${c.sessionId ? `&sessionId=${c.sessionId}` : ''}`)}
                  style={primaryBtnStyle}
                >
                  {label('بدء التقييم', 'Start Evaluation')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        {isLoading ? (
          <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {label('جارٍ التحميل...', 'Loading...')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                {[
                  label('اسم المرشح', 'Candidate'),
                  label('الحالة', 'Status'),
                  label('الدرجة الإجمالية', 'Total Score'),
                  label('قرار النظام', 'Decision'),
                  label('تاريخ التقديم', 'Submitted At'),
                  '',
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {myEvaluations.map((ev, i) => {
                const ss = statusStyle[ev.status] ?? { bg: 'var(--color-neutral-100)', color: 'var(--color-text-muted)' };
                return (
                  <tr key={ev.id}
                    style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)', cursor: 'pointer' }}
                    onClick={() => navigate(`/evaluations/${ev.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)')}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 'var(--font-regular)' }}>{isAr ? ev.candidateNameAr : ev.candidateNameEn}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: ss.bg, color: ss.color }}>
                        {isAr ? (statusAr[ev.status] ?? ev.status) : (statusEn[ev.status] ?? ev.status)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {ev.totalScore != null ? (
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-thin)', color: 'var(--color-primary-dark)' }}>
                          {ev.totalScore}<span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>/30</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>
                      {ev.systemDecision ? <DecisionBadge decision={ev.systemDecision} isAr={isAr} /> : '—'}
                    </td>
                    <td style={tdStyle}>
                      {ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {ev.status === 'Draft' ? (
                        <button style={primaryBtnStyle} onClick={e => { e.stopPropagation(); navigate(`/evaluations/${ev.id}`); }}>
                          {label('إكمال', 'Continue')}
                        </button>
                      ) : (
                        <button style={ghostBtnStyle} onClick={e => { e.stopPropagation(); navigate(`/evaluations/${ev.id}`); }}>
                          {label('عرض', 'View')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {myEvaluations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا توجد تقييمات حتى الآن. ستظهر هنا الجلسات المعيّن فيها.', 'No evaluations yet. Sessions you are assigned to will appear here.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature modal */}
      {showSigModal && user && (
        <SignatureModal
          userId={user.id}
          isAr={isAr}
          onClose={() => { setShowSigModal(false); setSigRefresh(r => r + 1); }}
        />
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const thStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
const primaryBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const ghostBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
