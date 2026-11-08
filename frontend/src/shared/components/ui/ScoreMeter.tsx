interface ScoreMeterProps {
  score: number;
  max?: number;
  showDecision?: boolean;
  locale?: 'ar' | 'en';
}

function getDecisionInfo(score: number, _locale: 'ar' | 'en') {
  if (score >= 24) return { labelAr: 'يُوصى به',  labelEn: 'Recommended',  color: 'var(--color-recommended)' };
  if (score >= 18) return { labelAr: 'مؤهل',      labelEn: 'Qualified',    color: 'var(--color-conditional)' };
  return            { labelAr: 'غير مؤهل',  labelEn: 'Not Qualified', color: 'var(--color-not-qualified)' };
}

export default function ScoreMeter({ score, max = 30, showDecision = true, locale = 'ar' }: ScoreMeterProps) {
  const pct       = Math.min((score / max) * 100, 100);
  const info      = getDecisionInfo(score, locale);
  const barColor  = info.color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {/* Score row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: barColor }}>
          {score.toFixed(1)}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {locale === 'ar' ? `من ${max}` : `/ ${max}`}
        </span>
      </div>

      {/* Track */}
      <div style={{
        height:       '6px',
        background:   'var(--color-neutral-200)',
        borderRadius: 'var(--radius-full)',
        overflow:     'hidden',
        position:     'relative',
      }}>
        {/* Threshold markers */}
        <div style={{ position: 'absolute', left: `${(17 / max) * 100}%`, top: 0, bottom: 0, width: '1px', background: 'var(--color-not-qualified)', opacity: 0.4 }} />
        <div style={{ position: 'absolute', left: `${(23 / max) * 100}%`, top: 0, bottom: 0, width: '1px', background: 'var(--color-conditional)', opacity: 0.4 }} />
        {/* Fill */}
        <div style={{
          height:           '100%',
          width:            `${pct}%`,
          background:       barColor,
          borderRadius:     'var(--radius-full)',
          transition:       'width 0.6s ease',
        }} />
      </div>

      {/* Threshold labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        <span>0</span>
        <span style={{ color: 'var(--color-not-qualified)' }}>17</span>
        <span style={{ color: 'var(--color-conditional)' }}>23</span>
        <span style={{ color: 'var(--color-recommended)' }}>30</span>
      </div>

      {/* Decision label */}
      {showDecision && (
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: barColor }}>
          {locale === 'ar' ? info.labelAr : info.labelEn}
        </span>
      )}
    </div>
  );
}
