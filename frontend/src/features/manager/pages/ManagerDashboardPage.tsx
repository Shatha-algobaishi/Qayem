import BrandLoader from '../../../shared/components/ui/BrandLoader';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchDashboard } from '../managerSlice';
import { api } from '../../../core/api/apiClient';

// ── Donut segment type ────────────────────────────────────────────────────────
interface DonutSegment {
  key: string;
  value: number;
  color: string;
  labelAr: string;
  labelEn: string;
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────
function DonutChart({
  segments, total, centerAr, centerEn, isAr, activeIdx, onSliceClick,
}: {
  segments: DonutSegment[];
  total: number;
  centerAr: string;
  centerEn: string;
  isAr: boolean;
  activeIdx: number | null;
  onSliceClick: (seg: DonutSegment, idx: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = 90, cy = 90, R = 72, ri = 48;
  const sum = segments.reduce((s, sg) => s + sg.value, 0) || 1;
  const toRad = (d: number) => (d * Math.PI) / 180;

  let startDeg = -90;
  const arcs = segments.map((seg, i) => {
    const sweep = (seg.value / sum) * 360;
    const endDeg = startDeg + Math.max(sweep, 0.5);
    const s = toRad(startDeg), e = toRad(endDeg);
    const large = sweep > 180 ? 1 : 0;
    const mid = toRad(startDeg + sweep / 2);
    const isActive = activeIdx === i || hovered === i;
    const push = isActive ? 7 : 0;

    const d = [
      `M ${cx + R * Math.cos(s)} ${cy + R * Math.sin(s)}`,
      `A ${R} ${R} 0 ${large} 1 ${cx + R * Math.cos(e)} ${cy + R * Math.sin(e)}`,
      `L ${cx + ri * Math.cos(e)} ${cy + ri * Math.sin(e)}`,
      `A ${ri} ${ri} 0 ${large} 0 ${cx + ri * Math.cos(s)} ${cy + ri * Math.sin(s)}`,
      'Z',
    ].join(' ');

    const result = { seg, d, i, tx: push * Math.cos(mid), ty: push * Math.sin(mid) };
    startDeg = endDeg;
    return result;
  });

  return (
    <svg viewBox="0 0 180 180" style={{ width: '170px', height: '170px', overflow: 'visible', flexShrink: 0 }}>
      {arcs.map(({ seg, d, i, tx, ty }) => (
        <path
          key={seg.key}
          d={d}
          fill={seg.color}
          stroke="var(--color-bg-white)"
          strokeWidth="2.5"
          opacity={activeIdx !== null && activeIdx !== i && hovered !== i ? 0.35 : 1}
          style={{
            cursor: 'pointer',
            transition: 'transform 0.18s ease, opacity 0.18s',
            transform: `translate(${tx}px, ${ty}px)`,
          }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSliceClick(seg, i)}
        />
      ))}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="22" fontWeight="300" fill="var(--color-text-primary)">
        {total}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
        {isAr ? centerAr : centerEn}
      </text>
    </svg>
  );
}

// ── Main dashboard page ───────────────────────────────────────────────────────
export default function ManagerDashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { dashboard, isLoading } = useAppSelector(s => s.manager);
  const locale = useAppSelector(s => s.ui.locale);
  const isAr = locale === 'ar';
  const label = (ar: string, en: string) => isAr ? ar : en;

  const [activeSession, setActiveSession] = useState<{ idx: number; key: string } | null>(null);
  const [activeCand, setActiveCand]       = useState<{ idx: number; seg: DonutSegment } | null>(null);
  const [candList, setCandList]           = useState<any[]>([]);
  const [candLoading, setCandLoading]     = useState(false);

  useEffect(() => { dispatch(fetchDashboard()); }, [dispatch]);

  if (isLoading || !dashboard) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <BrandLoader />
      </div>
    );
  }

  // Sessions segments
  const closedCount = Math.max((dashboard.totalSessions ?? dashboard.totalActiveSessions) - dashboard.totalActiveSessions, 0);
  const sessionSegments: DonutSegment[] = [
    { key: 'active', value: dashboard.totalActiveSessions, color: 'var(--color-primary)',      labelAr: 'مفتوحة', labelEn: 'Active' },
    { key: 'closed', value: closedCount,                   color: 'var(--color-neutral-200)',  labelAr: 'مغلقة',  labelEn: 'Closed' },
  ].filter(s => s.value > 0);

  // Candidates segments (mutually exclusive from backend)
  const pendingCount = Math.max(
    dashboard.totalCandidates
      - dashboard.employedCount
      - dashboard.recommendedCount
      - dashboard.conditionalCount
      - dashboard.notQualifiedCount,
    0,
  );
  const candSegments: DonutSegment[] = [
    { key: 'Recommended',            value: dashboard.recommendedCount,  color: 'var(--color-recommended)',  labelAr: 'يُوصى به',      labelEn: 'Recommended'   },
    { key: 'ConditionallyQualified', value: dashboard.conditionalCount,  color: 'var(--color-conditional)',  labelAr: 'مؤهل',          labelEn: 'Qualified'     },
    { key: 'NotQualified',           value: dashboard.notQualifiedCount, color: 'var(--color-not-qualified)',labelAr: 'غير مؤهل',      labelEn: 'Not Qualified' },
    { key: 'Employed',               value: dashboard.employedCount,     color: 'var(--color-primary-dark)', labelAr: 'موظَّف',         labelEn: 'Employed'      },
    { key: 'pending',                value: pendingCount,                color: 'var(--color-neutral-100)',  labelAr: 'لم يُقيَّم بعد', labelEn: 'Not Evaluated' },
  ].filter(s => s.value > 0);

  const handleSessionSlice = (seg: DonutSegment, idx: number) => {
    setActiveSession(prev => prev?.key === seg.key ? null : { idx, key: seg.key });
  };

  const handleCandSlice = async (seg: DonutSegment, idx: number) => {
    if (activeCand?.seg.key === seg.key) { setActiveCand(null); setCandList([]); return; }
    setActiveCand({ idx, seg });
    setCandLoading(true);
    try {
      const params: Record<string, string> = { pageSize: '6', page: '1' };
      if (seg.key === 'pending') params.unscored = 'true';
      else params.effectiveDecision = seg.key;
      const res = await api.candidates.list(params);
      const data = res.data;
      setCandList(Array.isArray(data) ? data : (data?.items ?? []));
    } catch { setCandList([]); }
    finally { setCandLoading(false); }
  };

  return (
    <div className="manager-dashboard">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)' }}>
          {label('لوحة تحكم المدير', 'Manager Dashboard')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label('الأعداد تجمع القرار النهائي إن وجد، وإلا التوصية المبنية على التقييمات المرسلة. النتائج الجزئية غير نهائية.', 'Counts use the final decision where available, otherwise the submitted-score recommendation. Partial results are provisional.')}
        </p>
      </div>

      {/* ── Two donut charts ─────────────────────────────────────────────────── */}
      <div className="dashboard-charts" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>

        {/* Sessions chart */}
        <div style={{
          background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-5)' }}>
            {label('الجلسات', 'Sessions')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
            <DonutChart
              segments={sessionSegments}
              total={dashboard.totalSessions ?? dashboard.totalActiveSessions}
              centerAr="جلسة" centerEn="Sessions"
              isAr={isAr}
              activeIdx={activeSession?.idx ?? null}
              onSliceClick={handleSessionSlice}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sessionSegments.map((seg, i) => (
                <div
                  key={seg.key}
                  onClick={() => handleSessionSlice(seg, i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    cursor: 'pointer', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: activeSession?.key === seg.key ? `${seg.color}18` : 'transparent',
                    opacity: activeSession && activeSession.key !== seg.key ? 0.45 : 1,
                    transition: 'all 0.18s',
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {isAr ? seg.labelAr : seg.labelEn}
                  </span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                    {seg.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Candidates chart */}
        <div style={{
          background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', boxShadow: 'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-5)' }}>
            {label('المتقدمون المرشحون', 'Candidates in Sessions')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
            <DonutChart
              segments={candSegments}
              total={dashboard.totalCandidates}
              centerAr="مرشح" centerEn="Candidates"
              isAr={isAr}
              activeIdx={activeCand?.idx ?? null}
              onSliceClick={handleCandSlice}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {candSegments.map((seg, i) => (
                <div
                  key={seg.key}
                  onClick={() => handleCandSlice(seg, i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    cursor: 'pointer', padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: activeCand?.seg.key === seg.key ? `${seg.color}18` : 'transparent',
                    opacity: activeCand && activeCand.seg.key !== seg.key ? 0.45 : 1,
                    transition: 'all 0.18s',
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {isAr ? seg.labelAr : seg.labelEn}
                  </span>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                    {seg.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Session slice popup ───────────────────────────────────────────────── */}
      {activeSession && (
        <div style={{
          background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)',
          boxShadow: 'var(--shadow-sm)',
          borderTop: `3px solid ${sessionSegments.find(s => s.key === activeSession.key)?.color ?? 'var(--color-primary)'}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)' }}>
              {isAr
                ? sessionSegments.find(s => s.key === activeSession.key)?.labelAr
                : sessionSegments.find(s => s.key === activeSession.key)?.labelEn}
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginInlineStart: 'var(--space-2)' }}>
                ({sessionSegments.find(s => s.key === activeSession.key)?.value ?? 0})
              </span>
            </span>
            <button onClick={() => setActiveSession(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
          </div>

          {activeSession.key === 'active' ? (
            dashboard.recentSessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {dashboard.recentSessions.map(s => (
                  <div key={s.sessionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>{s.titleAr}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{s.sessionCode}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {s.totalCandidates} {label('مرشح', 'candidates')}
                      </span>
                      <button
                        onClick={() => navigate(`/manager/sessions/${s.sessionId}/compare`)}
                        style={{ padding: '2px 10px', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                      >
                        {label('مقارنة', 'Compare')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
                {label('لا توجد جلسات نشطة', 'No active sessions')}
              </p>
            )
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', padding: 'var(--space-2) 0' }}>
              {label(`تم إغلاق ${closedCount} جلسة`, `${closedCount} sessions have been closed`)}
            </p>
          )}
        </div>
      )}

      {/* ── Candidates slice popup ────────────────────────────────────────────── */}
      {activeCand && (
        <div style={{
          background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', marginBottom: 'var(--space-5)',
          boxShadow: 'var(--shadow-sm)',
          borderTop: `3px solid ${activeCand.seg.color}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{
                display: 'inline-block', padding: '2px 12px',
                background: `${activeCand.seg.color}18`, color: activeCand.seg.color,
                borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)',
              }}>
                {isAr ? activeCand.seg.labelAr : activeCand.seg.labelEn}
              </span>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-thin)', color: activeCand.seg.color }}>
                {activeCand.seg.value}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {activeCand.seg.key !== 'pending' && (
                <button
                  onClick={() => navigate('/candidates?effectiveDecision='+activeCand.seg.key)}
                  style={{
                    padding: '4px 14px',
                    background: activeCand.seg.color, color: '#fff',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)',
                  }}
                >
                  {label('عرض الكل', 'View All')}
                </button>
              )}
              <button onClick={() => { setActiveCand(null); setCandList([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', lineHeight: 1 }}>×</button>
            </div>
          </div>

          {activeCand.seg.key === 'pending' ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {label(`${activeCand.seg.value} مرشح لم تُرسَل تقييماتهم بعد`, `${activeCand.seg.value} candidates have not been evaluated yet`)}
            </p>
          ) : candLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              <BrandLoader />
            </div>
          ) : candList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {candList.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${activeCand.seg.color}10`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-neutral-50)')}
                >
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {isAr ? c.fullNameAr : c.fullNameEn}
                    </div>
                    {c.nationalId && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{c.nationalId}</div>
                    )}
                  </div>
                  {c.aggregateScore != null && (
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: activeCand.seg.color }}>
                      {Number(c.aggregateScore).toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-4)' }}>
              {label('لا توجد نتائج', 'No results')}
            </p>
          )}
        </div>
      )}

      {/* ── Top / Bottom Candidates ───────────────────────────────────────────── */}
      {((dashboard.topCandidates?.length ?? 0) > 0 || (dashboard.bottomCandidates?.length ?? 0) > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
          {[
            { titleAr: 'الأعلى تقييماً', titleEn: 'Top Candidates',    list: dashboard.topCandidates ?? [],    accent: 'var(--color-recommended)' },
            { titleAr: 'الأدنى تقييماً', titleEn: 'Bottom Candidates', list: dashboard.bottomCandidates ?? [], accent: 'var(--color-not-qualified)' },
          ].map(panel => (
            <div key={panel.titleEn} style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', borderTop: `3px solid ${panel.accent}`, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
                {isAr ? panel.titleAr : panel.titleEn}
              </div>
              <div>
                {panel.list.map((c, idx) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', borderBottom: idx < panel.list.length - 1 ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}
                  >
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isAr ? c.fullNameAr : c.fullNameEn}
                    </span>
                    {c.aggregateScore != null && (
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: panel.accent, flexShrink: 0 }}>
                        {c.aggregateScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
                {panel.list.length === 0 && (
                  <div style={{ padding: 'var(--space-5)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {label('لا توجد بيانات', 'No data')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Active Sessions table ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', margin: 0 }}>
            {label('الجلسات النشطة', 'Active Sessions')}
          </h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
              {[
                label('الجلسة', 'Session'),
                label('المرشحون', 'Candidates'),
                label('القرارات المكتملة', 'Completed'),
                label('معلق', 'Pending'),
                label('تباين', 'Disc.'),
                label('تاريخ الجلسة', 'Date'),
                label('مقارنة', 'Compare'),
              ].map((h, i) => (
                <th key={i} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dashboard.recentSessions.map((session, i) => (
              <tr key={session.sessionId} style={{ borderBottom: i < dashboard.recentSessions.length - 1 ? '1px solid var(--color-border)' : 'none', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}>
                <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ fontWeight: 'var(--font-medium)' }}>{session.titleAr}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{session.sessionCode}</div>
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>{session.totalCandidates}</td>
                <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center', color: 'var(--color-recommended)' }}>{session.completedDecisions}</td>
                <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center', color: 'var(--color-conditional)' }}>{session.pendingDecisions}</td>
                <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                  {session.hasDiscrepancy
                    ? <span title={label('يوجد تباين عالٍ', 'High discrepancy detected')} style={{ color: 'var(--color-accent)', fontSize: 'var(--text-base)' }}>⚠</span>
                    : <span title={label('لا يوجد تباين', 'No discrepancy')} style={{ color: 'var(--color-recommended)', fontSize: 'var(--text-sm)' }}>✓</span>
                  }
                </td>
                <td style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  {session.scheduledDate
                    ? new Date(session.scheduledDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'short', day: 'numeric' })
                    : '—'}
                </td>
                <td style={{ padding: 'var(--space-4)' }}>
                  <button
                    onClick={() => navigate(`/manager/sessions/${session.sessionId}/compare`)}
                    style={{ padding: 'var(--space-1) var(--space-3)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                  >
                    {label('مقارنة', 'Compare')}
                  </button>
                </td>
              </tr>
            ))}
            {dashboard.recentSessions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {label('لا توجد جلسات نشطة', 'No active sessions')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
