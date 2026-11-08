import { useAppSelector } from '../../../app/store';
import type { DecisionType, SessionStatus, CandidateStatus } from '../../types';

interface BadgeProps {
  variant?: 'decision' | 'status' | 'session' | 'custom';
  decision?: DecisionType;
  sessionStatus?: SessionStatus;
  candidateStatus?: CandidateStatus;
  label?: string;
  color?: string;
  bg?: string;
}

const DECISION_MAP: Record<DecisionType, { labelAr: string; labelEn: string; color: string; bg: string }> = {
  Recommended:           { labelAr: 'يُوصى به',  labelEn: 'Recommended',   color: 'var(--color-recommended)',  bg: 'var(--color-recommended-bg)' },
  ConditionallyQualified:{ labelAr: 'مؤهل',      labelEn: 'Qualified',     color: 'var(--color-conditional)',  bg: 'var(--color-conditional-bg)' },
  NotQualified:          { labelAr: 'غير مؤهل',  labelEn: 'Not Qualified', color: 'var(--color-not-qualified)',bg: 'var(--color-not-qualified-bg)' },
  Employed:              { labelAr: 'موظَّف',     labelEn: 'Employed',      color: 'var(--color-primary-dark)', bg: 'rgba(0,93,69,0.08)' },
};

const SESSION_STATUS_MAP: Record<SessionStatus, { labelAr: string; labelEn: string; color: string; bg: string }> = {
  Draft:    { labelAr: 'مسودة',   labelEn: 'Draft',    color: 'var(--color-text-muted)',      bg: 'var(--color-neutral-100)' },
  Active:   { labelAr: 'نشطة',    labelEn: 'Active',   color: 'var(--color-recommended)',     bg: 'var(--color-recommended-bg)' },
  Closed:   { labelAr: 'مغلقة',   labelEn: 'Closed',   color: 'var(--color-not-qualified)',   bg: 'var(--color-not-qualified-bg)' },
  Archived: { labelAr: 'مؤرشفة',  labelEn: 'Archived', color: 'var(--color-text-secondary)',  bg: 'var(--color-neutral-100)' },
};

export default function Badge({ variant, decision, sessionStatus, label, color, bg }: BadgeProps) {
  const isAr = useAppSelector(s => s.ui.locale === 'ar');
  let text = label ?? '';
  let fgColor = color ?? 'var(--color-text-secondary)';
  let bgColor = bg ?? 'var(--color-neutral-100)';

  if (variant === 'decision' && decision) {
    const map   = DECISION_MAP[decision];
    text        = isAr ? map.labelAr : map.labelEn;
    fgColor     = map.color;
    bgColor     = map.bg;
  } else if (variant === 'session' && sessionStatus) {
    const map   = SESSION_STATUS_MAP[sessionStatus];
    text        = isAr ? map.labelAr : map.labelEn;
    fgColor     = map.color;
    bgColor     = map.bg;
  }

  return (
    <span
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        padding:      '2px var(--space-3)',
        borderRadius: 'var(--radius-full)',
        fontSize:     'var(--text-xs)',
        fontWeight:   'var(--font-medium)',
        background:   bgColor,
        color:        fgColor,
        whiteSpace:   'nowrap',
        border:       `1px solid ${fgColor}22`,
      }}
    >
      {text}
    </span>
  );
}
