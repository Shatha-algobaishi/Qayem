import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';

interface AuditEntry {
  id: number;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const locale  = useAppSelector(s => s.ui.locale);
  const isAr    = locale === 'ar';
  const label   = (ar: string, en: string) => isAr ? ar : en;

  const [items, setItems]             = useState<AuditEntry[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [entityType, setEntityType]   = useState('');
  const [isLoading, setIsLoading]     = useState(true);
  const [expanded, setExpanded]       = useState<number | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api.manager.auditLog({ page, pageSize: 25, entityType: entityType || undefined })
      .then(res => {
        setItems(res.data.items ?? []);
        setTotal(res.data.totalCount ?? 0);
        setTotalPages(res.data.totalPages ?? 1);
      })
      .finally(() => setIsLoading(false));
  }, [page, entityType]);

  const actionLabels: Record<string, { ar: string; color: string }> = {
    EVALUATION_SUBMITTED: { ar: 'تقديم تقييم',   color: 'var(--color-info)' },
    MANAGER_DECISION:     { ar: 'قرار المدير',    color: 'var(--color-recommended)' },
  };

  const entityLabels: Record<string, string> = {
    Evaluation: label('تقييم', 'Evaluation'),
    Candidate:  label('مرشح', 'Candidate'),
    User:       label('مستخدم', 'User'),
    Session:    label('جلسة', 'Session'),
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {label('سجل المراجعة', 'Audit Log')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {label(`${total} سجل`, `${total} entries`)}
          </p>
        </div>
        <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }} style={filterStyle}>
          <option value="">{label('كل الأنواع', 'All types')}</option>
          <option value="Evaluation">{label('التقييمات', 'Evaluations')}</option>
          <option value="Candidate">{label('المرشحون', 'Candidates')}</option>
          <option value="User">{label('المستخدمون', 'Users')}</option>
          <option value="Session">{label('الجلسات', 'Sessions')}</option>
        </select>
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
                  label('التاريخ والوقت', 'Timestamp'),
                  label('الإجراء', 'Action'),
                  label('نوع الكيان', 'Entity Type'),
                  label('معرّف الكيان', 'Entity ID'),
                  label('عنوان IP', 'IP Address'),
                  '',
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((entry, i) => {
                const al = actionLabels[entry.action];
                const isExpanded = expanded === entry.id;
                return (
                  <>
                    <tr key={entry.id}
                      style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                          {new Date(entry.timestamp).toLocaleString(isAr ? 'ar-SA' : 'en-SA')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-neutral-100)', color: al?.color ?? 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                          {isAr && al ? al.ar : entry.action}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {entityLabels[entry.entityType] ?? entry.entityType}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {entry.entityId ? entry.entityId.substring(0, 8) + '...' : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{entry.ipAddress ?? '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {(entry.oldValues || entry.newValues) && (
                          <button style={ghostBtnStyle} onClick={() => setExpanded(isExpanded ? null : entry.id)}>
                            {isExpanded ? label('إخفاء', 'Hide') : label('تفاصيل', 'Details')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${entry.id}-detail`} style={{ background: 'var(--color-neutral-50)' }}>
                        <td colSpan={6} style={{ padding: 'var(--space-4) var(--space-6)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                            {entry.oldValues && (
                              <div>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 'var(--font-semibold)' }}>{label('القيم القديمة', 'Old Values')}</p>
                                <pre style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--color-neutral-100)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                                  {JSON.stringify(JSON.parse(entry.oldValues), null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.newValues && (
                              <div>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 'var(--font-semibold)' }}>{label('القيم الجديدة', 'New Values')}</p>
                                <pre style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--color-neutral-100)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                                  {JSON.stringify(JSON.parse(entry.newValues), null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا توجد سجلات', 'No audit records')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtnStyle}>
                {isAr ? '›' : '‹'}
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={paginationBtnStyle}>
                {isAr ? '‹' : '›'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const thStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
const ghostBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const filterStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-white)', fontFamily: 'inherit', outline: 'none' };
const paginationBtnStyle: React.CSSProperties = { width: '32px', height: '32px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-white)', cursor: 'pointer', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' };
