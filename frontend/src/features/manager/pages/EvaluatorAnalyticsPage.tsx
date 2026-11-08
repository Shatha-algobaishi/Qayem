import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchEvaluatorAnalytics } from '../managerSlice';

const BIAS_COLOR: Record<string, string> = {
  PositiveBias:        'var(--color-recommended)',
  NegativeBias:        'var(--color-not-qualified)',
  StandardConsistency: 'var(--color-primary-dark)',
};
const BIAS_AR: Record<string, string> = {
  PositiveBias:        'انحياز إيجابي',
  NegativeBias:        'انحياز سلبي',
  StandardConsistency: 'اتساق معياري',
};
const BIAS_EN: Record<string, string> = {
  PositiveBias:        'Positive Bias',
  NegativeBias:        'Negative Bias',
  StandardConsistency: 'Standard Consistency',
};

// ── Tooltip component (portal-based — avoids overflow:hidden clipping) ──────
function Tooltip({ text, children, wide }: { text: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const handleEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top - 8 });
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setPos(null)}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
    >
      {children}
      {pos && createPortal(
        <span style={{
          position: 'fixed',
          left: pos.x, top: pos.y,
          transform: 'translate(-50%, -100%)',
          background: '#1a2433', color: '#fff',
          fontSize: '11px', lineHeight: '1.6',
          padding: '8px 12px', borderRadius: '6px',
          whiteSpace: 'pre-line', textAlign: 'start',
          width: wide ? '280px' : '220px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 99999, pointerEvents: 'none',
          fontWeight: 'normal', textTransform: 'none', letterSpacing: 'normal',
        }}>
          {text}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            border: '5px solid transparent', borderTopColor: '#1a2433',
          }} />
        </span>,
        document.body,
      )}
    </span>
  );
}

// ── Info icon ─────────────────────────────────────────────────
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginInlineStart: '4px', opacity: 0.5, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
}

// ── Column header with optional tooltip ───────────────────────
function ColHeader({ ar, en, isAr, tip }: { ar: string; en: string; isAr: boolean; tip?: { ar: string; en: string } }) {
  const text = isAr ? ar : en;
  return (
    <th style={{
      padding: 'var(--space-3) var(--space-4)', textAlign: 'start',
      fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
      color: 'var(--color-text-secondary)', textTransform: 'uppercase',
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {tip ? (
        <Tooltip text={isAr ? tip.ar : tip.en} wide>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {text}<InfoIcon />
          </span>
        </Tooltip>
      ) : text}
    </th>
  );
}

export default function EvaluatorAnalyticsPage() {
  const dispatch = useAppDispatch();
  const { evaluatorAnalytics, isLoading } = useAppSelector(s => s.manager);
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  useEffect(() => { dispatch(fetchEvaluatorAnalytics()); }, [dispatch]);

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        {label('جارٍ تحميل بيانات الأداء...', 'Loading performance data...')}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)' }}>
          {label('تحليلات أداء المقيّمين', 'Evaluator Performance Analytics')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label(
            'قياس الاتساق والانحياز لكل مقيّم — المقارنة تتم على مستوى المرشح الواحد',
            'Measure consistency and bias per evaluator — comparison is per candidate',
          )}
        </p>
      </div>

      {/* ── Global summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        {[
          { label: label('إجمالي المقيّمين', 'Total Evaluators'), value: evaluatorAnalytics.length, color: 'var(--color-primary-dark)' },
          { label: label('انحياز سلبي', 'Negative Bias'),         value: evaluatorAnalytics.filter(e => e.biasLabel === 'NegativeBias').length,        color: 'var(--color-not-qualified)' },
          { label: label('انحياز إيجابي', 'Positive Bias'),       value: evaluatorAnalytics.filter(e => e.biasLabel === 'PositiveBias').length,        color: 'var(--color-recommended)'   },
          { label: label('اتساق معياري', 'Standard Consistency'), value: evaluatorAnalytics.filter(e => e.biasLabel === 'StandardConsistency').length, color: 'var(--color-primary-dark)'  },
        ].map((card, i) => (
          <div key={i} style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', borderTop: `3px solid ${card.color}` }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>{card.label}</p>
            <p style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-thin)', color: card.color, margin: '4px 0 0' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Per-evaluator table ── */}
      <div style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', margin: 0 }}>
            {label('تفاصيل كل مقيّم', 'Per-Evaluator Details')}
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                <ColHeader ar="المقيّم"               en="Evaluator"              isAr={isAr} />
                <ColHeader ar="عدد التقييمات"         en="# Evals"               isAr={isAr} />
                <ColHeader ar="متوسط الدرجة"          en="Avg Score"             isAr={isAr} />
                <ColHeader ar="الأدنى"                en="Min"                   isAr={isAr} />
                <ColHeader ar="الأعلى"                en="Max"                   isAr={isAr} />
                <ColHeader
                  ar="الانحراف المعياري" en="Std Dev" isAr={isAr}
                  tip={{
                    ar: 'مقياس تشتّت الدرجات التي يمنحها هذا المقيّم.\nقيمة منخفضة = درجاته متقاربة ومتسقة.\nقيمة مرتفعة = تفاوت كبير بين مرشح وآخر.',
                    en: 'Measures how spread out this evaluator\'s scores are.\nLow value = consistent scores.\nHigh value = large variation between candidates.',
                  }}
                />
                <ColHeader
                  ar="متوسط الانحراف عن المرشح" en="Avg Deviation vs Candidate" isAr={isAr}
                  tip={{
                    ar: 'لكل مرشح يُحسَب متوسط درجات جميع المقيّمين عليه،\nثم يُحسَب فرق درجة هذا المقيّم عن ذلك المتوسط.\nالقيمة هنا = متوسط هذه الفوارق عبر كل تقييماته.\n\nمثال: +3.0 يعني أنه يمنح عادةً\n3 درجات أعلى من بقية المقيّمين للمرشح ذاته.',
                    en: 'For each candidate, the average score of all evaluators is computed.\nThis column = the evaluator\'s average deviation from that baseline.\n\nExample: +3.0 means they typically score\n3 points above their peers for the same candidate.',
                  }}
                />
                <ColHeader
                  ar="تصنيف الانحياز" en="Bias" isAr={isAr}
                  tip={{
                    ar: 'التصنيف بناءً على متوسط الانحراف:\n\n• > +5  ← انحياز إيجابي\n  (يمنح درجات أعلى من المعتاد)\n\n• < −5  ← انحياز سلبي\n  (يمنح درجات أقل من المعتاد)\n\n• ضمن ±5  ← اتساق معياري',
                    en: 'Classification based on mean deviation:\n\n• > +5  → Positive Bias\n  (scores higher than peers)\n\n• < −5  → Negative Bias\n  (scores lower than peers)\n\n• within ±5  → Standard Consistency',
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {evaluatorAnalytics.map((ev, i) => {
                const dev      = ev.meanDeviation ?? 0;
                const devStr   = dev >= 0 ? `+${dev.toFixed(2)}` : dev.toFixed(2);
                const devColor = dev > 5 ? 'var(--color-recommended)' : dev < -5 ? 'var(--color-not-qualified)' : 'var(--color-text-muted)';

                const biasTipAr = ev.biasLabel === 'PositiveBias'
                  ? `متوسط انحرافه ${devStr} — أعلى من الحد (+5)\n→ يمنح درجات أعلى من المعتاد`
                  : ev.biasLabel === 'NegativeBias'
                  ? `متوسط انحرافه ${devStr} — أقل من الحد (−5)\n→ يمنح درجات أقل من المعتاد`
                  : `متوسط انحرافه ${devStr} — ضمن النطاق المقبول ±5\n→ أداؤه متسق مع بقية المقيّمين`;

                const biasTipEn = ev.biasLabel === 'PositiveBias'
                  ? `Mean deviation ${devStr} — above threshold (+5)\n→ Scores higher than peers`
                  : ev.biasLabel === 'NegativeBias'
                  ? `Mean deviation ${devStr} — below threshold (−5)\n→ Scores lower than peers`
                  : `Mean deviation ${devStr} — within acceptable range ±5\n→ Consistent with other evaluators`;

                return (
                  <tr key={ev.evaluatorId} style={{
                    borderBottom: i < evaluatorAnalytics.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)',
                  }}>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {isAr ? ev.fullNameAr : ev.fullNameEn}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
                      {ev.totalEvaluations}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary-dark)' }}>
                      {ev.averageScoreGiven.toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-not-qualified)' }}>
                      {ev.minScoreGiven}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-recommended)' }}>
                      {ev.maxScoreGiven}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      {ev.stdDeviation.toFixed(2)}
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: devColor }}>
                      {devStr}
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <Tooltip text={isAr ? biasTipAr : biasTipEn} wide>
                        <span style={{
                          fontSize: 'var(--text-xs)', padding: '2px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: `${BIAS_COLOR[ev.biasLabel]}18`,
                          color: BIAS_COLOR[ev.biasLabel],
                          fontWeight: 'var(--font-medium)',
                          whiteSpace: 'nowrap', cursor: 'help',
                        }}>
                          {isAr ? BIAS_AR[ev.biasLabel] : BIAS_EN[ev.biasLabel]}
                        </span>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
              {evaluatorAnalytics.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا توجد بيانات تقييم بعد', 'No evaluation data yet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bias legend ── */}
      <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4) var(--space-5)', background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--color-text-secondary)' }}>{label('كيفية حساب الانحياز: ', 'Bias calculation: ')}</strong>
        {label(
          'لكل مرشح يُحسَب متوسط درجات جميع المقيّمين عليه، ثم يُحسَب انحراف كل مقيّم عن هذا المتوسط. متوسط الانحراف > +5 = انحياز إيجابي | < −5 = انحياز سلبي | ضمن ±5 = اتساق معياري',
          "Per candidate, the average score of all evaluators is computed; each evaluator's deviation from that average is measured. Mean deviation > +5 = Positive Bias | < −5 = Negative Bias | within ±5 = Standard Consistency",
        )}
      </div>
    </div>
  );
}
