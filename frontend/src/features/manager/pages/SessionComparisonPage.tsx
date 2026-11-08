import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchSessionComparison, clearComparison } from '../managerSlice';

type SortKey = 'rank' | 'averageScore' | 'variance';
type FilterDecision = 'All' | 'Recommended' | 'ConditionallyQualified' | 'NotQualified';

const DECISION_COLOR: Record<string, string> = {
  Recommended:          'var(--color-recommended)',
  ConditionallyQualified:'var(--color-conditional)',
  NotQualified:         'var(--color-not-qualified)',
};

const DECISION_AR: Record<string, string> = {
  Recommended:          'يُوصى به',
  ConditionallyQualified:'مؤهل',
  NotQualified:         'غير مؤهل',
  Employed:             'موظَّف',
};

export default function SessionComparisonPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const { comparison, isLoading } = useAppSelector(s => s.manager);
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  const [sort,      setSort]      = useState<SortKey>('rank');
  const [filter,    setFilter]    = useState<FilterDecision>('All');
  const [summaryPopup, setSummaryPopup] = useState<{ name: string; json: any; r: any } | null>(null);

  useEffect(() => {
    if (sessionId) dispatch(fetchSessionComparison(sessionId));
    return () => { dispatch(clearComparison()); };
  }, [sessionId, dispatch]);

  if (isLoading || !comparison) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        {label('جارٍ تحميل بيانات المقارنة...', 'Loading comparison data...')}
      </div>
    );
  }

  // Filter + sort rankings
  let rankings = [...comparison.rankings];
  if (filter !== 'All')
    rankings = rankings.filter(r => r.systemDecision === filter || r.finalDecision === filter);
  if (sort === 'averageScore')
    rankings = rankings.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
  else if (sort === 'variance')
    rankings = rankings.sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0));

  const maxScore = 30;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', padding: 0 }}
          >
            {label('← العودة', '← Back')}
          </button>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', margin: 0 }}>
            {label('مقارنة المرشحين', 'Candidate Comparison')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {isAr ? comparison.titleAr : comparison.titleEn} — {comparison.sessionCode}
          </p>
        </div>

        {/* Bias alert */}
        {(() => {
          const biasCandidates = comparison.rankings.filter(r =>
            r.averageScore != null && r.submittedEvaluations >= 2 && (
              (r.highestScore != null && r.highestScore - r.averageScore > 5) ||
              (r.lowestScore  != null && r.averageScore - r.lowestScore  > 5)
            )
          );
          if (biasCandidates.length === 0) return null;
          return (
            <div style={{
              background:        '#FFF5F5',
              border:            '1px solid #FCA5A5',
              borderInlineStart: '3px solid #EF4444',
              borderRadius:      'var(--radius-md)',
              padding:           '6px 12px',
              display:           'flex',
              alignItems:        'center',
              gap:               'var(--space-2)',
              boxShadow:         '0 1px 3px rgba(239,68,68,0.08)',
              alignSelf:         'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 'var(--font-semibold)', color: '#991B1B', whiteSpace: 'nowrap' }}>
                {label('انحياز:', 'Bias:')}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {biasCandidates.map(r => {
                  const posDev = r.highestScore != null ? r.highestScore - r.averageScore! : 0;
                  const negDev = r.lowestScore  != null ? r.averageScore! - r.lowestScore  : 0;
                  const parts: string[] = [];
                  if (posDev > 5) parts.push(`+${posDev.toFixed(1)}`);
                  if (negDev > 5) parts.push(`-${negDev.toFixed(1)}`);
                  return (
                    <span key={r.candidateId} style={{
                      fontSize: '11px', background: '#FEE2E2', color: '#991B1B',
                      borderRadius: 'var(--radius-full)', padding: '1px 7px',
                      fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap',
                    }}>
                      {isAr ? r.fullNameAr : r.fullNameEn}
                      <span style={{ opacity: 0.65, marginInlineStart: '3px' }}>({parts.join('، ')})</span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <p className="comparison-rule">{label('المتوسط مبني على التقييمات المرسلة فقط. لا تُحسب المسودات أو الدرجات الغائبة؛ النتائج الجزئية غير نهائية.', 'Averages use submitted evaluations only. Drafts and missing scores are excluded; partial results are provisional.')}</p>
      {/* ── KPI summary strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[
          { ar: 'إجمالي المرشحين', en: 'Total Candidates',   v: comparison.totalCandidates,     color: 'var(--color-primary-dark)' },
          { ar: 'تمّ تقييمهم',     en: 'Evaluated',          v: comparison.evaluatedCandidates,  color: 'var(--color-primary)' },
          { ar: 'لم يُقيَّموا بعد',en: 'Not Yet Evaluated',  v: comparison.totalCandidates - comparison.evaluatedCandidates, color: 'var(--color-text-muted)' },
          { ar: 'يُوصى بهم',       en: 'Recommended',        v: comparison.rankings.filter(r => (r.finalDecision ?? r.systemDecision) === 'Recommended').length,           color: 'var(--color-recommended)' },
          { ar: 'مؤهلون',         en: 'Qualified',          v: comparison.rankings.filter(r => (r.finalDecision ?? r.systemDecision) === 'ConditionallyQualified').length, color: 'var(--color-conditional)' },
          { ar: 'غير مؤهلين',     en: 'Not Qualified',      v: comparison.rankings.filter(r => (r.finalDecision ?? r.systemDecision) === 'NotQualified').length,           color: 'var(--color-not-qualified)' },
        ].map(stat => (
          <div key={stat.en} style={{
            background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-4)',
            borderTop: `3px solid ${stat.color}`,
          }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
              {isAr ? stat.ar : stat.en}
            </p>
            <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-thin)', color: stat.color }}>
              {stat.v}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters + Sort controls ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap',
        marginBottom: 'var(--space-5)', background: 'var(--color-bg-white)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
      }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
          {label('فلترة:', 'Filter:')}
        </span>
        {(['All', 'Recommended', 'ConditionallyQualified', 'NotQualified'] as FilterDecision[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-sm)',
            border: filter === f ? '1px solid var(--color-primary-dark)' : '1px solid var(--color-border)',
            background: filter === f ? 'var(--color-primary-dark)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
          }}>
            {f === 'All' ? label('الكل', 'All') : (isAr ? DECISION_AR[f] : f.replace('ConditionallyQualified', 'Conditional'))}
          </button>
        ))}

        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            style={{
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)',
              color: 'var(--color-text-secondary)', background: 'var(--color-bg-white)',
            }}
          >
            <option value="rank">{label('ترتيب الترتيب', 'By Rank')}</option>
            <option value="averageScore">{label('متوسط الدرجة', 'By Avg Score')}</option>
            <option value="variance">{label('التباين', 'By Variance')}</option>
          </select>
        </div>
      </div>

      {/* ── Visual bar chart comparison ── */}
      <div style={{
        background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
          {label('مقارنة بصرية للنتائج', 'Visual Score Comparison')}
        </h3>
        {rankings.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-6)' }}>
            {label('لا توجد بيانات للعرض', 'No data to display')}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {rankings.map(r => {
              const decision = r.finalDecision ?? r.systemDecision;
              const hasScore = r.averageScore != null;
              const barColor = decision ? DECISION_COLOR[decision] ?? 'var(--color-primary)' : 'var(--color-primary-dark)';
              const pct = hasScore ? ((r.averageScore ?? 0) / maxScore) * 100 : 0;
              return (
                <div key={r.candidateId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ minWidth: '28px', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    #{r.rank}
                  </span>
                  <span
                    onClick={() => navigate(`/candidates/${r.candidateId}`)}
                    title={label('عرض ملف المرشح', 'View candidate profile')}
                    style={{ minWidth: '160px', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--color-primary-dark)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' }}
                  >
                    {isAr ? r.fullNameAr : r.fullNameEn}
                  </span>
                  <div style={{ flex: 1, height: '18px', background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`, height: '100%',
                      background: barColor, borderRadius: 'var(--radius-full)',
                      transition: 'width 0.8s ease',
                    }} />
                  </div>
                  <span style={{ minWidth: '50px', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: hasScore ? barColor : 'var(--color-text-muted)', textAlign: 'end' }}>
                    {hasScore ? r.averageScore!.toFixed(1) : label('لم يُقيَّم', 'No score')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Ranked candidates table ── */}
      <div style={{
        background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', margin: 0 }}>
            {label('جدول الترتيب التفصيلي', 'Detailed Ranking Table')}
          </h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
              {[
                label('#', '#'),
                label('المرشح', 'Candidate'),
                label('متوسط الدرجة', 'Avg Score'),
                label('الأعلى', 'High'),
                label('الأدنى', 'Low'),
                label('التباين', 'Variance'),
                label('عدد المقيّمين', 'Evaluators'),
                label('القرار', 'Decision'),
                label('ملاحظة', 'Note'),
                label('بيانات المتقدم', 'Profile'),
              ].map((h, i) => (
                <th key={i} style={{
                  padding: 'var(--space-3) var(--space-4)', textAlign: 'start',
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
                  color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankings.map((r, i) => {
              const decision = r.finalDecision ?? r.systemDecision;
              const decColor = decision ? DECISION_COLOR[decision] : 'var(--color-text-muted)';
              const decLabel = decision ? (isAr ? DECISION_AR[decision] : decision.replace('ConditionallyQualified', 'Conditional')) : '—';
              return (
                <tr key={r.candidateId} style={{
                  borderBottom: i < rankings.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background:   i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)',
                }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)' }}>
                    {r.rank}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {isAr ? r.fullNameAr : r.fullNameEn}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      {r.nationalId}
                    </div>
                    {r.submittedEvaluations < r.totalEvaluators && <small className="candidate-department">{label('لم يكتمل التقييم', 'Evaluation incomplete')}</small>}
                    {r.isOverridden && (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-dark)', background: 'rgba(0,93,69,0.08)', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                        {label('قرار نهائي', 'Final Decision')}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: decColor }}>
                    {r.averageScore != null ? r.averageScore.toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-recommended)' }}>
                    {r.highestScore ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-not-qualified)' }}>
                    {r.lowestScore ?? '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)' }}>
                    {r.variance != null ? (
                      <span style={{ color: r.hasDiscrepancy ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontWeight: 'var(--font-regular)' }}>
                        {r.variance.toFixed(1)}{r.hasDiscrepancy ? ' ⚠' : ''}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {r.submittedEvaluations}/{r.totalEvaluators}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{
                      fontSize: 'var(--text-xs)', padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: decision ? `${decColor}18` : 'var(--color-neutral-100)',
                      color: decColor, fontWeight: 'var(--font-medium)',
                    }}>
                      {decLabel}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                    {r.submittedEvaluations > 0 ? (() => {
                      let parsed: any = null;
                      try { if (r.aiSummary) parsed = JSON.parse(r.aiSummary); } catch { /* Summary may contain plain text from an older model. */ }
                      const name = isAr ? r.fullNameAr : r.fullNameEn;
                      return (
                        <button
                          onClick={() => setSummaryPopup({ name, json: parsed, r })}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '22px', height: '22px', borderRadius: '50%',
                            background: 'rgba(0,93,69,0.1)', color: 'var(--color-primary-dark)',
                            fontSize: '11px', fontWeight: 'bold', border: 'none',
                            cursor: 'pointer', fontFamily: 'serif',
                          }}
                        >
                          i
                        </button>
                      );
                    })() : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-neutral-200)' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                    <button
                      onClick={() => navigate(`/candidates/${r.candidateId}`)}
                      title={label('عرض بيانات المتقدم', 'View candidate profile')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '30px',
                        height: '30px',
                        background: 'var(--color-primary-dark)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.315 0-10 1.668-10 5v1h20v-1c0-3.332-6.685-5-10-5z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {rankings.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {label('لا توجد نتائج تطابق الفلتر', 'No results match the current filter')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── AI Summary Popup ── */}
      {summaryPopup && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setSummaryPopup(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', width: '500px', maxWidth: '95vw', maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{label('ملخص الذكاء الاصطناعي', 'AI Summary')}</p>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', margin: 'var(--space-1) 0 0' }}>{summaryPopup.name}</h3>
              </div>
              <button onClick={() => setSummaryPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
            </div>
            {/* Body */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Live stats from ranking */}
              <div style={{ display: 'flex', gap: 'var(--space-5)', fontSize: 'var(--text-sm)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label('المتوسط:', 'Avg:')}</span>
                <strong style={{ color: 'var(--color-primary-dark)' }}>{summaryPopup.r.averageScore?.toFixed(2) ?? '—'}</strong>
                <span style={{ color: 'var(--color-border)' }}>|</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{label('المقيّمون:', 'Evaluators:')}</span>
                <strong>{summaryPopup.r.submittedEvaluations}/{summaryPopup.r.totalEvaluators}</strong>
                {summaryPopup.r.highestScore != null && (<>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <span style={{ color: 'var(--color-recommended)', fontSize: 'var(--text-xs)' }}>{label('أعلى', 'H')}: {summaryPopup.r.highestScore}</span>
                  <span style={{ color: 'var(--color-not-qualified)', fontSize: 'var(--text-xs)' }}>{label('أدنى', 'L')}: {summaryPopup.r.lowestScore}</span>
                </>)}
              </div>
              {summaryPopup.json?.strengths?.length > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-recommended)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>{label('نقاط القوة', 'Strengths')}</p>
                  <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {summaryPopup.json.strengths.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                  </ul>
                </div>
              )}
              {summaryPopup.json?.areasForImprovement?.length > 0 && (
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-warning)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>{label('نقاط التطوير', 'Areas for Improvement')}</p>
                  <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                    {summaryPopup.json.areasForImprovement.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                  </ul>
                </div>
              )}
              {(summaryPopup.json?.agreements?.length > 0 || summaryPopup.json?.disagreements?.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  {summaryPopup.json?.agreements?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-info)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>{label('نقاط الاتفاق', 'Agreement')}</p>
                      <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {summaryPopup.json.agreements.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-xs)' }}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {summaryPopup.json?.disagreements?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-danger)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>{label('نقاط الاختلاف', 'Disagreement')}</p>
                      <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {summaryPopup.json.disagreements.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-xs)' }}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {!summaryPopup.json && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                  {label('لا يوجد ملخص ذكاء اصطناعي لهذا المرشح', 'No AI summary available for this candidate')}
                </p>
              )}
              {summaryPopup.json?.recommendation && (
                <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', borderInlineStart: '3px solid var(--color-primary-dark)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase' }}>{label('التوصية', 'Recommendation')}</p>
                  <p style={{ fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.6 }}>{summaryPopup.json?.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
