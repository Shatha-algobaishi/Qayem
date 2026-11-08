import { csvCell } from '../../../shared/utils/safeOutput';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const DownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';
import type { PagedResult } from '../../../shared/types';
import { DecisionBadge } from '../../sessions/pages/SessionDetailPage';

interface CandidateRow {
  id: string;
  sessionId?: string | null;
  nationalId: string;
  fullNameAr: string;
  fullNameEn: string;
  applicationType?: string;
  candidateStatus: string;
  aggregateScore?: number;
  systemDecision?: string;
  finalDecision?: string;
  isOverridden?: boolean;
  hasCv?: boolean;
  registeredAt: string;
}

const decisionLabel = (d?: string, isAr?: boolean): string => {
  if (!d) return '';
  if (d === 'Recommended') return isAr ? 'يُوصى به' : 'Recommended';
  if (d === 'ConditionallyQualified') return isAr ? 'مؤهل' : 'Qualified';
  if (d === 'NotQualified') return isAr ? 'غير مؤهل' : 'Not Qualified';
  if (d === 'Employed') return isAr ? 'موظّف' : 'Employed';
  return d;
};

const statusAr: Record<string, string> = {
  Pending:    'قيد المراجعة',
  InProgress: 'مرشح للمقابلة',
  Completed:  'تمت المقابلة',
};
const statusEn: Record<string, string> = {
  Pending:    'Under Review',
  InProgress: 'Shortlisted',
  Completed:  'Interviewed',
};
const statusTooltipAr: Record<string, string> = {
  Pending:    'تم تسجيل بيانات المتقدم، ولم يتم تحديد مقابلة له بعد.',
  InProgress: 'تم ترشيحه وإسناد مقابلة له',
  Completed:  'انتهت المقابلة وتم تقييمه',
};
const statusTooltipEn: Record<string, string> = {
  Pending:    'Applicant registered, no interview scheduled yet.',
  InProgress: 'Shortlisted and assigned to an interview session.',
  Completed:  'Interview completed and evaluated.',
};
const statusColors: Record<string, { bg: string; color: string }> = {
  Pending:    { bg: 'var(--color-neutral-100)',   color: 'var(--color-text-secondary)' },
  InProgress: { bg: 'var(--color-warning-light)', color: 'var(--color-warning)' },
  Completed:  { bg: 'var(--color-success-light)', color: 'var(--color-success)' },
};

function exportToCsv(rows: CandidateRow[], isAr: boolean) {
  const headers = isAr
    ? ['رقم الهوية', 'الاسم (عربي)', 'الاسم (إنجليزي)', 'نوع الطلب', 'الحالة', 'متوسط الدرجات', 'قرار النظام', 'القرار النهائي', 'سيرة ذاتية', 'تاريخ التسجيل']
    : ['National ID', 'Name (Arabic)', 'Name (English)', 'Application Type', 'Status', 'Avg Score', 'System Decision', 'Final Decision', 'Has CV', 'Registered At'];
  const csvRows = [
    headers.map(csvCell).join(','),
    ...rows.map(c => [
      c.nationalId, c.fullNameAr, c.fullNameEn,
      c.applicationType ?? '',
      c.candidateStatus,
      c.aggregateScore != null ? Number(c.aggregateScore).toFixed(1) : '',
      c.systemDecision ?? '', c.finalDecision ?? '',
      c.hasCv ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No'),
      new Date(c.registeredAt).toLocaleDateString('en-CA'),
    ].map(csvCell).join(','))
  ];
  const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `candidates_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

async function exportToXlsx(rows: CandidateRow[], isAr: boolean) {
  const data = rows.map(c => ({
    [isAr ? 'رقم الهوية' : 'National ID']: c.nationalId,
    [isAr ? 'الاسم (عربي)' : 'Name (Arabic)']: c.fullNameAr,
    [isAr ? 'الاسم (إنجليزي)' : 'Name (English)']: c.fullNameEn,
    [isAr ? 'نوع الطلب' : 'Application Type']: c.applicationType ?? '',
    [isAr ? 'الحالة' : 'Status']: isAr ? (statusAr[c.candidateStatus] ?? c.candidateStatus) : c.candidateStatus,
    [isAr ? 'متوسط الدرجات' : 'Avg Score']: c.aggregateScore != null ? Number(c.aggregateScore).toFixed(1) : '',
    [isAr ? 'قرار النظام' : 'System Decision']: decisionLabel(c.systemDecision, isAr),
    [isAr ? 'القرار النهائي' : 'Final Decision']: decisionLabel(c.finalDecision, isAr),
    [isAr ? 'سيرة ذاتية' : 'Has CV']: c.hasCv ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No'),
    [isAr ? 'تاريخ التسجيل' : 'Registered At']: new Date(c.registeredAt).toLocaleDateString('en-CA'),
  }));
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isAr ? 'المرشحون' : 'Candidates');
  XLSX.writeFile(wb, `candidates_${new Date().toISOString().slice(0,10)}.xlsx`);
}

export default function CandidatesListPage() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  const effectiveRole  = activeRoleName ?? user?.roleName ?? '';
  const locale         = useAppSelector(s => s.ui.locale);
  const isAr           = locale === 'ar';
  const label          = (ar: string, en: string) => isAr ? ar : en;

  const sessionIdFilter = params.get('sessionId') ?? '';

  const [data, setData]             = useState<PagedResult<CandidateRow> | null>(null);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter]         = useState('');
  const [sysDecisionFilter, setSysDecisionFilter] = useState('');
  const [finalDecisionFilter, setFinalDecisionFilter] = useState('');
  const [appTypeFilter, setAppTypeFilter]       = useState('');
  const [minScore, setMinScore]     = useState('');
  const [maxScore, setMaxScore]     = useState('');
  const [page, setPage]             = useState(1);
  const [isLoading, setIsLoading]   = useState(true);
  const [exporting, setExporting]   = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Decision modal
  const [decisionTarget, setDecisionTarget]   = useState<CandidateRow | null>(null);
  const [decisionChoice, setDecisionChoice]   = useState('');
  const [decisionReason, setDecisionReason]   = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError]     = useState('');

  const canRegister      = ['Admin', 'DataEntry'].includes(effectiveRole);
  const canIssueDecision = ['Admin', 'Manager', 'DataEntry'].includes(effectiveRole);

  const buildParams = (overridePage = page) => ({
    sessionId:       sessionIdFilter || undefined,
    hasSession:      sessionIdFilter ? undefined : undefined,
    search:          search || undefined,
    status:          statusFilter || undefined,
    systemDecision:  sysDecisionFilter || undefined,
    finalDecision:   finalDecisionFilter || undefined,
    applicationType: appTypeFilter || undefined,
    minScore:        minScore ? parseFloat(minScore) : undefined,
    maxScore:        maxScore ? parseFloat(maxScore) : undefined,
    page:            overridePage,
    pageSize:        20,
  });

  const fetchAllRows = async () => {
    const res = await api.candidates.list({
      ...buildParams(1),
      pageSize: 9999,
    });
    return res.data.items ?? [];
  };

  const handleExport = async () => {
    setExporting(true);
    try { exportToCsv(await fetchAllRows(), isAr); } finally { setExporting(false); }
  };

  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try { exportToXlsx(await fetchAllRows(), isAr); } finally { setExportingXlsx(false); }
  };

  const load = (p = page) => {
    setIsLoading(true);
    api.candidates.list(buildParams(p))
      .then(res => setData(res.data))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, statusFilter, sysDecisionFilter, finalDecisionFilter, appTypeFilter, minScore, maxScore, sessionIdFilter]);

  useEffect(() => { load(); }, [page]);

  const openDecisionModal = (e: React.MouseEvent, c: CandidateRow) => {
    e.stopPropagation();
    setDecisionTarget(c);
    setDecisionChoice(c.systemDecision ?? '');
    setDecisionReason('');
    setDecisionError('');
  };

  const handleIssueDecision = async (e: FormEvent) => {
    e.preventDefault();
    if (!decisionTarget || !decisionChoice || !decisionReason.trim()) {
      setDecisionError(label('اختر القرار واكتب السبب', 'Choose a decision and enter a reason'));
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError('');
    try {
      await api.manager.issueDecision({ candidateId: decisionTarget.id, decision: decisionChoice, reason: decisionReason });
      setDecisionTarget(null);
      load();
    } catch (e: any) {
      setDecisionError(e?.response?.data?.message ?? label('فشل إصدار القرار', 'Failed to issue decision'));
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const sysDecisions = [
    { value: 'Recommended',            ar: 'يُوصى به',  en: 'Recommended' },
    { value: 'ConditionallyQualified', ar: 'مؤهل',      en: 'Qualified'   },
    { value: 'NotQualified',           ar: 'غير مؤهل',  en: 'Not Qualified'},
  ];

  const decisions = [
    ...sysDecisions,
    { value: 'Employed', ar: 'موظّف', en: 'Employed' },
  ];

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {label('المتقدمون', 'Applicants')}
          </h2>
          {data && (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              {label(`${data.totalCount} إجمالاً`, `${data.totalCount} total`)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button onClick={handleExport} disabled={exporting} style={{ ...exportBtnStyle, opacity: exporting ? 0.6 : 1 }}>
            <DownIcon />
            {exporting ? label('جارٍ...', 'Exporting...') : label('تصدير CSV', 'Export CSV')}
          </button>
          <button onClick={handleExportXlsx} disabled={exportingXlsx} style={{ ...excelBtnStyle, opacity: exportingXlsx ? 0.6 : 1 }}>
            <DownIcon />
            {exportingXlsx ? label('جارٍ...', 'Exporting...') : label('تصدير Excel', 'Export Excel')}
          </button>
          {canRegister && (
            <button onClick={() => navigate('/candidates/new')} style={primaryBtnStyle}>
              + {label('تسجيل متقدم', 'Register Applicant')}
            </button>
          )}
        </div>
      </div>


      {/* ── Filters ── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        {/* Primary row: search + status + advanced toggle */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={label('البحث بالاسم أو رقم الهوية...', 'Search by name or national ID...')}
            style={{ ...inputStyle, flex: '1', minWidth: '180px' }}
          />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: '160px' }}>
            <option value="">{label('المتقدمون', 'All Applicants')}</option>
            <option value="Pending">{label('قيد المراجعة', 'Under Review')}</option>
            <option value="InProgress">{label('مرشح للمقابلة', 'Shortlisted')}</option>
            <option value="Completed">{label('تمت المقابلة', 'Interviewed')}</option>
          </select>
          <button
            onClick={() => setShowAdvanced(p => !p)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              background: showAdvanced ? 'var(--color-primary-dark)' : 'transparent',
              color: showAdvanced ? '#fff' : 'var(--color-primary-dark)',
              border: '1px solid var(--color-primary-dark)',
              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
              whiteSpace: 'nowrap',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {label('تصفية متقدمة', 'Advanced Filter')}
            {(sysDecisionFilter || finalDecisionFilter || appTypeFilter || minScore || maxScore) && (
              <span style={{ background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-full)', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {[sysDecisionFilter, finalDecisionFilter, appTypeFilter, minScore, maxScore].filter(Boolean).length}
              </span>
            )}
          </button>
          {(search || statusFilter || sysDecisionFilter || finalDecisionFilter || appTypeFilter || minScore || maxScore) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setSysDecisionFilter(''); setFinalDecisionFilter(''); setAppTypeFilter(''); setMinScore(''); setMaxScore(''); setPage(1); }}
              style={clearFilterBtnStyle}
            >
              {label('مسح الكل', 'Clear All')}
            </button>
          )}
        </div>

        {/* Advanced filters panel */}
        {showAdvanced && (
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-5)',
            background: 'var(--color-bg-white)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
                {label('قرار النظام', 'System Decision')}
              </label>
              <select value={sysDecisionFilter} onChange={e => { setSysDecisionFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: '170px' }}>
                <option value="">{label('الكل', 'All')}</option>
                {sysDecisions.map(d => (
                  <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
                {label('القرار النهائي', 'Final Decision')}
              </label>
              <select value={finalDecisionFilter} onChange={e => { setFinalDecisionFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: '170px' }}>
                <option value="">{label('الكل', 'All')}</option>
                {decisions.map(d => (
                  <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
                {label('نوع الطلب', 'Application Type')}
              </label>
              <select value={appTypeFilter} onChange={e => { setAppTypeFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: '160px' }}>
                <option value="">{label('الكل', 'All')}</option>
                <option value="وظيفة">{label('وظيفة', 'Employment')}</option>
                <option value="تمهير">{label('تمهير', 'Tamheer')}</option>
                <option value="تدريب تعاوني">{label('تدريب تعاوني', 'Co-op Training')}</option>
                <option value="تدريب صيفي">{label('تدريب صيفي', 'Summer Training')}</option>
                <option value="عقد">{label('عقد', 'Contract')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
                {label('متوسط الدرجات', 'Avg Score')}
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  type="number" min="0" max="30" step="0.1"
                  value={minScore}
                  onChange={e => { setMinScore(e.target.value); setPage(1); }}
                  placeholder={label('من', 'From')}
                  style={{ ...inputStyle, width: '80px' }}
                />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>—</span>
                <input
                  type="number" min="0" max="30" step="0.1"
                  value={maxScore}
                  onChange={e => { setMaxScore(e.target.value); setPage(1); }}
                  placeholder={label('إلى', 'To')}
                  style={{ ...inputStyle, width: '80px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ── */}
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
                  label('رقم الهوية', 'National ID'),
                  label('الاسم', 'Name'),
                  label('الحالة', 'Status'),
                  label('متوسط الدرجات', 'Avg Score'),
                  label('قرار النظام', 'System Decision'),
                  label('القرار النهائي', 'Final Decision'),
                  label('بيانات المتقدم', 'Profile'),
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((c, i) => {
                const sc = statusColors[c.candidateStatus] ?? { bg: 'var(--color-neutral-100)', color: 'var(--color-text-muted)' };
                const canDecide = canIssueDecision && c.aggregateScore != null && !c.finalDecision;
                return (
                  <tr key={c.id}
                    style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)', cursor: 'pointer' }}
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-neutral-100)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)')}
                  >
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>{c.nationalId}</td>
                    <td style={tdStyle}>{isAr ? c.fullNameAr : c.fullNameEn}</td>
                    <td style={tdStyle}>
                      <span
                        title={isAr ? (statusTooltipAr[c.candidateStatus] ?? '') : (statusTooltipEn[c.candidateStatus] ?? c.candidateStatus)}
                        style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: sc.bg, color: sc.color, cursor: 'default' }}
                      >
                        {isAr ? (statusAr[c.candidateStatus] ?? c.candidateStatus) : (statusEn[c.candidateStatus] ?? c.candidateStatus)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.aggregateScore != null ? Number(c.aggregateScore).toFixed(1) : '—'}
                    </td>
                    <td style={tdStyle}>
                      {c.systemDecision ? <DecisionBadge decision={c.systemDecision} isAr={isAr} /> : '—'}
                    </td>
                    <td style={tdStyle}>
                      {c.finalDecision
                        ? <DecisionBadge decision={c.finalDecision} isAr={isAr} />
                        : c.aggregateScore != null
                          ? canDecide
                            ? (
                              <button
                                onClick={e => { e.stopPropagation(); openDecisionModal(e, c); }}
                                title={label('اضغط لإصدار القرار النهائي', 'Click to issue final decision')}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--color-warning)', fontStyle: 'italic', textDecoration: 'none', fontFamily: 'inherit', borderBottom: '1px solid var(--color-warning)' }}
                              >
                                {label('بانتظار القرار النهائي', 'Awaiting final decision')}
                              </button>
                            )
                            : <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{label('بانتظار القرار النهائي', 'Awaiting final decision')}</span>
                          : '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        title={label('عرض بيانات المتقدم', 'View candidate profile')}
                        onClick={e => { e.stopPropagation(); navigate(`/candidates/${c.id}`); }}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.315 0-10 1.668-10 5v1h20v-1c0-3.332-6.685-5-10-5z"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {(data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا يوجد سجلات', 'No records found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {isAr ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} of ${data.totalPages}`}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtnStyle}>
                {isAr ? '›' : '‹'}
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages} style={paginationBtnStyle}>
                {isAr ? '‹' : '›'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Issue Decision Modal ── */}
      {decisionTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)' as any }}>
          <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', width: '480px', maxWidth: '95vw', boxShadow: 'var(--shadow-xl)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', marginBottom: 'var(--space-2)' }}>
              {label('إصدار قرار نهائي', 'Issue Final Decision')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
              {isAr ? decisionTarget.fullNameAr : decisionTarget.fullNameEn} — {decisionTarget.nationalId}
            </p>
            <form onSubmit={handleIssueDecision}>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={labelStyle}>{label('القرار *', 'Decision *')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {decisions.map(d => (
                    <label key={d.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${decisionChoice === d.value ? 'var(--color-primary-dark)' : 'var(--color-border)'}`, background: decisionChoice === d.value ? 'rgba(2,62,115,0.05)' : 'transparent' }}>
                      <input type="radio" name="decision" value={d.value} checked={decisionChoice === d.value} onChange={() => setDecisionChoice(d.value)} style={{ accentColor: 'var(--color-primary-dark)' }} />
                      <span style={{ fontSize: 'var(--text-sm)' }}>{isAr ? d.ar : d.en}</span>
                      {decisionTarget.systemDecision === d.value && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginInlineStart: 'auto' }}>
                          {label('قرار النظام', 'System')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={labelStyle}>{label('سبب القرار *', 'Reason *')}</label>
                <textarea
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  rows={3}
                  placeholder={label('اكتب مبرر القرار...', 'Enter the reason for this decision...')}
                  style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: 'var(--space-2)' }}
                />
              </div>
              {decisionError && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-3)' }}>{decisionError}</p>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setDecisionTarget(null)} style={cancelBtnStyle}>
                  {label('إلغاء', 'Cancel')}
                </button>
                <button type="submit" disabled={decisionSubmitting} style={primaryBtnStyle}>
                  {decisionSubmitting ? label('جارٍ...', 'Saving...') : label('تأكيد القرار', 'Confirm Decision')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const thStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
const primaryBtnStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-5)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };

const inputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-white)', fontFamily: 'inherit', outline: 'none' };
const paginationBtnStyle: React.CSSProperties = { width: '32px', height: '32px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-white)', cursor: 'pointer', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' };
const exportBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', transition: 'opacity var(--transition-fast)' };
const excelBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)', transition: 'opacity var(--transition-fast)' };
const clearFilterBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 'var(--space-2) var(--space-3)', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
const cancelBtnStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-5)', background: 'var(--color-bg-white)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
const labelStyle: React.CSSProperties = { fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', display: 'block' };
