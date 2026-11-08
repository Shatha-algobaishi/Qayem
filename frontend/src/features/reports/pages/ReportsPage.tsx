import BrandLoader from '../../../shared/components/ui/BrandLoader';
import { csvCell } from '../../../shared/utils/safeOutput';
import { useState, useEffect } from 'react';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';

const DownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
  </svg>
);

type TabKey = 'candidates' | 'sessions' | 'evaluators' | 'results';

const TABS: { key: TabKey; ar: string; en: string }[] = [
  { key: 'candidates', ar: 'المتقدمون',         en: 'Candidates'    },
  { key: 'sessions',   ar: 'الجلسات',           en: 'Sessions'      },
  { key: 'evaluators', ar: 'المقيّمون',         en: 'Evaluators'    },
  { key: 'results',    ar: 'النتائج النهائية',   en: 'Final Results' },
];

const colsByTab: Record<TabKey, { key: string; ar: string; en: string }[]> = {
  candidates: [
    { key: 'nationalId',      ar: 'رقم الهوية',    en: 'National ID'     },
    { key: 'fullNameAr',      ar: 'الاسم',          en: 'Name'            },
    { key: 'department', ar: 'القسم', en: 'Department' },
    { key: 'sessionCode',     ar: 'الجلسة',         en: 'Session'         },
    { key: 'candidateStatus', ar: 'الحالة',         en: 'Status'          },
    { key: 'aggregateScore',  ar: 'متوسط الدرجات', en: 'Avg Score'       },
    { key: 'systemDecision',  ar: 'قرار النظام',    en: 'System Decision' },
    { key: 'finalDecision',   ar: 'القرار النهائي', en: 'Final Decision'  },
  ],
  sessions: [
    { key: 'sessionCode',     ar: 'الكود',         en: 'Code'       },
    { key: 'titleAr',         ar: 'العنوان',        en: 'Title'      },
    { key: 'department',      ar: 'القسم',          en: 'Dept.'      },
    { key: 'agency',          ar: 'الجهة',          en: 'Agency'     },
    { key: 'scheduledDate',   ar: 'تاريخ الجلسة',  en: 'Date'       },
    { key: 'status',          ar: 'الحالة',         en: 'Status'     },
    { key: 'totalCandidates', ar: 'المرشحون',       en: 'Candidates' },
    { key: 'recommended',     ar: 'يُوصى',          en: 'Rec.'       },
    { key: 'conditional',     ar: 'مؤهل',           en: 'Qualified'  },
    { key: 'notQualified',    ar: 'غير مؤهل',       en: 'NQ'         },
  ],
  evaluators: [
    { key: 'fullNameAr',       ar: 'الاسم',         en: 'Name'        },
    { key: 'totalEvaluations', ar: 'عدد التقييمات', en: 'Evaluations' },
    { key: 'averageScore',     ar: 'متوسط الدرجة',  en: 'Avg Score'   },
    { key: 'minScore',         ar: 'أدنى درجة',     en: 'Min'         },
    { key: 'maxScore',         ar: 'أعلى درجة',     en: 'Max'         },
    { key: 'biasLabel',        ar: 'التصنيف',        en: 'Bias'        },
  ],
  results: [
    { key: 'nationalId',     ar: 'رقم الهوية',    en: 'National ID'  },
    { key: 'fullNameAr',     ar: 'الاسم',          en: 'Name'         },
    { key: 'sessionCode',    ar: 'الجلسة',         en: 'Session'      },
    { key: 'aggregateScore', ar: 'الدرجة',         en: 'Score'        },
    { key: 'highestScore',   ar: 'أعلى',           en: 'High'         },
    { key: 'lowestScore',    ar: 'أدنى',           en: 'Low'          },
    { key: 'finalDecision',  ar: 'القرار النهائي', en: 'Final Dec.'   },
    { key: 'isOverridden',   ar: 'تعديل يدوي',    en: 'Override'     },
  ],
};

const SCORE_KEYS    = new Set(['aggregateScore','averageScore','highestScore','lowestScore','minScore','maxScore']);
const DECISION_KEYS = new Set(['finalDecision','systemDecision']);

const columnsFor = (tab: TabKey, ar: boolean) => colsByTab[tab].map(col => !ar && col.key==='fullNameAr' ? {...col,key:'fullNameEn'} : col);

const sysDecisions = [
  { value: 'Recommended',            ar: 'يُوصى به', en: 'Recommended'   },
  { value: 'ConditionallyQualified', ar: 'مؤهل',     en: 'Qualified'     },
  { value: 'NotQualified',           ar: 'غير مؤهل', en: 'Not Qualified' },
];
const finalDecisions = [
  { value: 'Recommended',            ar: 'يُوصى به', en: 'Recommended'   },
  { value: 'ConditionallyQualified', ar: 'مؤهل',     en: 'Qualified'     },
  { value: 'NotQualified',           ar: 'غير مؤهل', en: 'Not Qualified' },
  { value: 'Employed',               ar: 'موظَّف',   en: 'Employed'      },
];

function decisionInfo(val: string, isAr: boolean) {
  if (val === 'Recommended')            return { label: isAr ? 'يُوصى به' : 'Recommended',   color: 'var(--color-recommended)',   bg: 'var(--color-recommended-bg)'   };
  if (val === 'ConditionallyQualified') return { label: isAr ? 'مؤهل'     : 'Qualified',      color: 'var(--color-conditional)',   bg: 'var(--color-conditional-bg)'   };
  if (val === 'NotQualified')           return { label: isAr ? 'غير مؤهل' : 'Not Qualified',  color: 'var(--color-not-qualified)', bg: 'var(--color-not-qualified-bg)' };
  if (val === 'Employed')               return { label: isAr ? 'موظّف'    : 'Employed',       color: 'var(--color-employed)',      bg: 'var(--color-employed-bg)'      };
  return null;
}

function biasInfo(val: string, isAr: boolean) {
  if (val === 'Strict')   return { label: isAr ? 'صارم'   : 'Strict',   color: 'var(--color-not-qualified)', bg: 'var(--color-not-qualified-bg)' };
  if (val === 'Lenient')  return { label: isAr ? 'متساهل' : 'Lenient',  color: 'var(--color-conditional)',   bg: 'var(--color-conditional-bg)'   };
  if (val === 'Balanced') return { label: isAr ? 'متوازن' : 'Balanced', color: 'var(--color-recommended)',   bg: 'var(--color-recommended-bg)'   };
  return null;
}

function statusInfo(val: string, isAr: boolean) {
  if (val === 'Active') return { label: isAr ? 'نشطة'  : 'Active', color: 'var(--color-success)',    bg: 'var(--color-success-light)'  };
  if (val === 'Closed') return { label: isAr ? 'مغلقة' : 'Closed', color: 'var(--color-text-muted)', bg: 'var(--color-neutral-100)'    };
  if (val === 'Draft')  return { label: isAr ? 'مسودة' : 'Draft',  color: 'var(--color-conditional)',bg: 'var(--color-conditional-bg)' };
  return null;
}

const candidateStatusMap: Record<string, { ar: string; en: string; bg: string; color: string }> = {
  Pending:    { ar: 'قيد المراجعة',   en: 'Under Review', bg: 'var(--color-neutral-100)',   color: 'var(--color-text-secondary)' },
  InProgress: { ar: 'مرشح للمقابلة', en: 'Shortlisted',  bg: 'var(--color-warning-light)', color: 'var(--color-warning)'        },
  Completed:  { ar: 'تمت المقابلة',  en: 'Interviewed',  bg: 'var(--color-success-light)', color: 'var(--color-success)'        },
};

function formatCellValue(colKey: string, val: unknown, isAr: boolean): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
  if (typeof val === 'number') return val.toFixed(SCORE_KEYS.has(colKey) ? 1 : 0);
  const s = String(val);
  if (DECISION_KEYS.has(colKey)) {
    if (s === 'Recommended')            return isAr ? 'يُوصى به' : 'Recommended';
    if (s === 'ConditionallyQualified') return isAr ? 'مؤهل'     : 'Qualified';
    if (s === 'NotQualified')           return isAr ? 'غير مؤهل' : 'Not Qualified';
    if (s === 'Employed')               return isAr ? 'موظَّف'   : 'Employed';
  }
  if (colKey === 'candidateStatus') {
    const info = candidateStatusMap[s];
    if (info) return isAr ? info.ar : info.en;
  }
  if (colKey === 'status') {
    if (s === 'Active') return isAr ? 'نشطة'  : 'Active';
    if (s === 'Closed') return isAr ? 'مغلقة' : 'Closed';
    if (s === 'Draft')  return isAr ? 'مسودة' : 'Draft';
  }
  if (colKey === 'biasLabel') {
    if (s === 'Strict')   return isAr ? 'صارم'   : 'Strict';
    if (s === 'Lenient')  return isAr ? 'متساهل' : 'Lenient';
    if (s === 'Balanced') return isAr ? 'متوازن' : 'Balanced';
  }
  return s;
}

export default function ReportsPage() {
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  const [activeTab, setActiveTab]   = useState<TabKey>('candidates');
  const [data, setData]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);

  // Sessions list for the results-tab picker
  const [sessions, setSessions] = useState<any[]>([]);

  // ── Candidates-tab filters ───────────────────────────────────
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSysDec,   setFilterSysDec]   = useState('');
  const [filterFinalDec, setFilterFinalDec] = useState('');
  const [filterAppType,  setFilterAppType]  = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterMaxScore, setFilterMaxScore] = useState('');
  const [showAdvanced,   setShowAdvanced]   = useState(false);

  // ── Sessions-tab filter ──────────────────────────────────────
  const [filterSessionStatus, setFilterSessionStatus] = useState('');

  // ── Results-tab filters ──────────────────────────────────────
  const [filterSession,  setFilterSession]  = useState('');
  const [filterDecision, setFilterDecision] = useState('');

  // ── Load sessions list once ──────────────────────────────────
  useEffect(() => {
    api.sessions.list({ pageSize: 200 })
      .then(r => setSessions(r.data.items ?? []))
      .catch(() => {});
  }, []);

  // ── Re-fetch whenever any filter or tab changes ──────────────
  useEffect(() => { loadData(); }, [
    activeTab,
    search, filterStatus, filterSysDec, filterFinalDec, filterAppType, filterMinScore, filterMaxScore,
    filterSessionStatus,
    filterSession, filterDecision,
  ]);

  const clearCandidateFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterSysDec('');
    setFilterFinalDec(''); setFilterAppType(''); setFilterMinScore(''); setFilterMaxScore('');
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    clearCandidateFilters();
    setFilterSessionStatus('');
    setFilterSession(''); setFilterDecision('');
    setShowAdvanced(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      let res: any;

      if (activeTab === 'candidates') {
        const p: Record<string, unknown> = { pageSize: 200 };
        if (search)         p.search          = search;
        if (filterStatus)   p.status          = filterStatus;
        if (filterSysDec)   p.systemDecision  = filterSysDec;
        if (filterFinalDec) p.finalDecision   = filterFinalDec;
        if (filterAppType)  p.applicationType = filterAppType;
        if (filterMinScore) p.minScore        = filterMinScore;
        if (filterMaxScore) p.maxScore        = filterMaxScore;
        res = await api.candidates.list(p);
        const items = [...res.data.items];
        for (let page = 2; page <= res.data.totalPages; page++) {
          const next = await api.candidates.list({ ...p, page });
          items.push(...next.data.items);
        }
        res = { data: { items } };

      } else if (activeTab === 'sessions') {
        res = await api.reports.sessions({});

      } else if (activeTab === 'evaluators') {
        res = await api.reports.evaluators({});

      } else {
        const p: Record<string, unknown> = {};
        if (filterSession)  p.sessionId = filterSession;
        if (filterDecision) p.decision  = filterDecision;
        res = await api.reports.results(p);
      }

      setData(res.data.items ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Sessions tab: client-side status filter
  const displayedData: any[] = activeTab === 'sessions' && filterSessionStatus
    ? data.filter(row => row.status === filterSessionStatus)
    : data;

  const total = displayedData.length;

  // ── Export helpers ───────────────────────────────────────────
  const buildExportRows = () => {
    const cols = columnsFor(activeTab,isAr);
    return displayedData.map(row => {
      const obj: Record<string, string> = {};
      for (const col of cols) obj[isAr ? col.ar : col.en] = formatCellValue(col.key, row[col.key], isAr);
      return obj;
    });
  };

  const handleExportCsv = () => {
    const cols = columnsFor(activeTab,isAr);
    const header = cols.map(c => csvCell(isAr ? c.ar : c.en)).join(',');
    const body = displayedData.map(row =>
      cols.map(c => csvCell(formatCellValue(c.key, row[c.key], isAr))).join(',')
    ).join('\n');
    const csv = '﻿' + header + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    const rows = buildExportRows();
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    wb.Props={Title:'Qayem evaluation report',Author:'Qayem'};
    XLSX.utils.book_append_sheet(wb, ws, TABS.find(t => t.key === activeTab)?.[isAr ? 'ar' : 'en'] ?? activeTab);
    XLSX.writeFile(wb, `${activeTab}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Cell renderer ────────────────────────────────────────────
  const renderCell = (colKey: string, val: unknown) => {
    if (val === null || val === undefined) return <span style={{ color: 'var(--color-gray-blue)' }}>—</span>;

    if (DECISION_KEYS.has(colKey)) {
      const info = decisionInfo(String(val), isAr);
      if (!info) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
      return <Badge color={info.color} bg={info.bg}>{info.label}</Badge>;
    }
    if (colKey === 'biasLabel') {
      const info = biasInfo(String(val), isAr);
      if (!info) return String(val);
      return <Badge color={info.color} bg={info.bg}>{info.label}</Badge>;
    }
    if (colKey === 'status') {
      const info = statusInfo(String(val), isAr);
      if (info) return <Badge color={info.color} bg={info.bg}>{info.label}</Badge>;
    }
    if (colKey === 'candidateStatus') {
      const info = candidateStatusMap[String(val)];
      if (info) return <Badge color={info.color} bg={info.bg}>{isAr ? info.ar : info.en}</Badge>;
    }
    if (SCORE_KEYS.has(colKey)) {
      const num = Number(val);
      if (isNaN(num)) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
      return <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-neutral-100)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>{num.toFixed(1)}</span>;
    }
    if (typeof val === 'boolean') return val
      ? <span style={{ color: 'var(--color-conditional)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)' }}>{label('نعم', 'Yes')}</span>
      : <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{label('لا', 'No')}</span>;

    if (typeof val === 'number') return String(val);
    return String(val);
  };

  const cols = columnsFor(activeTab,isAr);
  const hasAdvancedFilter = !!(filterSysDec || filterFinalDec || filterAppType || filterMinScore || filterMaxScore);
  const advancedCount = [filterSysDec, filterFinalDec, filterAppType, filterMinScore, filterMaxScore].filter(Boolean).length;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div>
          <img className="report-brand" src={isAr?'/qayem-logo-ar.svg':'/qayem-logo-en.svg'} alt={isAr?'قيّم':'Qayem'}/>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {label('التقارير', 'Reports')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {loading ? label('جارٍ التحميل...', 'Loading...') : label(`${total} سجل`, `${total} records`)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={handleExportCsv} disabled={loading || displayedData.length === 0}
            style={{ ...exportBtnStyle, background: 'var(--color-primary-dark)', opacity: (loading || displayedData.length === 0) ? 0.5 : 1 }}>
            <DownIcon />
            {label('تصدير CSV', 'Export CSV')}
          </button>
          <button onClick={handleExportXlsx} disabled={loading || displayedData.length === 0}
            style={{ ...exportBtnStyle, background: 'var(--color-success)', opacity: (loading || displayedData.length === 0) ? 0.5 : 1 }}>
            <DownIcon />
            {label('تصدير Excel', 'Export Excel')}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', marginBottom: 'var(--space-5)', borderBottom: '2px solid var(--color-border)' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => handleTabChange(tab.key)}
            style={{
              padding: 'var(--space-3) var(--space-6)', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary-dark)' : '2px solid transparent',
              marginBottom: '-2px', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab.key ? 'var(--font-medium)' : 'var(--font-regular)',
              color: activeTab === tab.key ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
              transition: 'color var(--transition-fast)',
            }}>
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* ── Filters: candidates tab ── */}
      {activeTab === 'candidates' && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={label('البحث بالاسم أو رقم الهوية...', 'Search by name or national ID...')}
              style={{ ...inputStyle, flex: '1', minWidth: '180px' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: '165px' }}>
              <option value="">{label('المتقدمون', 'All Candidates')}</option>
              <option value="Pending">{label('قيد المراجعة', 'Under Review')}</option>
              <option value="InProgress">{label('مرشح للمقابلة', 'Shortlisted')}</option>
              <option value="Completed">{label('تمت المقابلة', 'Interviewed')}</option>
            </select>
            <button onClick={() => setShowAdvanced(p => !p)}
              style={{ display:'inline-flex', alignItems:'center', gap:'var(--space-2)', padding:'var(--space-2) var(--space-4)', background: showAdvanced ? 'var(--color-primary-dark)' : 'transparent', color: showAdvanced ? '#fff' : 'var(--color-primary-dark)', border:'1px solid var(--color-primary-dark)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:'var(--text-sm)', fontWeight:'var(--font-medium)', whiteSpace:'nowrap' }}>
              <FilterIcon />
              {label('تصفية متقدمة', 'Advanced')}
              {hasAdvancedFilter && (
                <span style={{ background:'var(--color-accent)', color:'#fff', borderRadius:'var(--radius-full)', width:'16px', height:'16px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'bold' }}>
                  {advancedCount}
                </span>
              )}
            </button>
            {(search || filterStatus || hasAdvancedFilter) && (
              <button onClick={() => { clearCandidateFilters(); setShowAdvanced(false); }} style={clearBtnStyle}>
                {label('مسح الكل', 'Clear All')}
              </button>
            )}
          </div>

          {showAdvanced && (
            <div style={{ marginTop:'var(--space-3)', padding:'var(--space-4) var(--space-5)', background:'var(--color-bg-white)', border:'1px solid var(--color-border)', borderRadius:'var(--radius-md)', display:'flex', flexWrap:'wrap', gap:'var(--space-4)', alignItems:'flex-end' }}>
              <FilterField label={label('قرار النظام', 'System Decision')}>
                <select value={filterSysDec} onChange={e => setFilterSysDec(e.target.value)} style={{ ...inputStyle, width:'170px' }}>
                  <option value="">{label('الكل', 'All')}</option>
                  {sysDecisions.map(d => <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>)}
                </select>
              </FilterField>
              <FilterField label={label('القرار النهائي', 'Final Decision')}>
                <select value={filterFinalDec} onChange={e => setFilterFinalDec(e.target.value)} style={{ ...inputStyle, width:'170px' }}>
                  <option value="">{label('الكل', 'All')}</option>
                  {finalDecisions.map(d => <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>)}
                </select>
              </FilterField>
              <FilterField label={label('نوع الطلب', 'Application Type')}>
                <select value={filterAppType} onChange={e => setFilterAppType(e.target.value)} style={{ ...inputStyle, width:'160px' }}>
                  <option value="">{label('الكل', 'All')}</option>
                  <option value="وظيفة">{label('وظيفة', 'Employment')}</option>
                  <option value="تمهير">{label('تمهير', 'Tamheer')}</option>
                  <option value="تدريب تعاوني">{label('تدريب تعاوني', 'Co-op Training')}</option>
                  <option value="تدريب صيفي">{label('تدريب صيفي', 'Summer Training')}</option>
                  <option value="عقد">{label('عقد', 'Contract')}</option>
                </select>
              </FilterField>
              <FilterField label={label('متوسط الدرجات', 'Avg Score')}>
                <div style={{ display:'flex', gap:'var(--space-2)', alignItems:'center' }}>
                  <input type="number" min="0" max="30" step="0.1" value={filterMinScore} onChange={e => setFilterMinScore(e.target.value)} placeholder={label('من','From')} style={{ ...inputStyle, width:'80px' }} />
                  <span style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)' }}>—</span>
                  <input type="number" min="0" max="30" step="0.1" value={filterMaxScore} onChange={e => setFilterMaxScore(e.target.value)} placeholder={label('إلى','To')} style={{ ...inputStyle, width:'80px' }} />
                </div>
              </FilterField>
            </div>
          )}
        </div>
      )}

      {/* ── Filter: sessions tab (status) ── */}
      {activeTab === 'sessions' && (
        <div style={{ display:'flex', gap:'var(--space-3)', marginBottom:'var(--space-4)', alignItems:'center' }}>
          <select value={filterSessionStatus} onChange={e => setFilterSessionStatus(e.target.value)} style={{ ...inputStyle, width:'180px' }}>
            <option value="">{label('كل الجلسات', 'All Sessions')}</option>
            <option value="Active">{label('النشطة', 'Active')}</option>
            <option value="Closed">{label('المغلقة', 'Closed')}</option>
          </select>
          {filterSessionStatus && (
            <button onClick={() => setFilterSessionStatus('')} style={clearBtnStyle}>{label('مسح', 'Clear')}</button>
          )}
        </div>
      )}

      {/* ── Filters: results tab ── */}
      {activeTab === 'results' && (
        <div style={{ display:'flex', gap:'var(--space-3)', marginBottom:'var(--space-4)', flexWrap:'wrap', alignItems:'center' }}>
          <select value={filterSession} onChange={e => setFilterSession(e.target.value)} style={{ ...inputStyle, minWidth:'220px' }}>
            <option value="">{label('جميع الجلسات', 'All Sessions')}</option>
            {sessions.map((s: any) => (
              <option key={s.id} value={s.id}>{s.sessionCode} — {s.titleAr}</option>
            ))}
          </select>
          <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)} style={{ ...inputStyle, width:'160px' }}>
            <option value="">{label('كل القرارات', 'All Decisions')}</option>
            {finalDecisions.map(d => <option key={d.value} value={d.value}>{isAr ? d.ar : d.en}</option>)}
          </select>
          {(filterSession || filterDecision) && (
            <button onClick={() => { setFilterSession(''); setFilterDecision(''); }} style={clearBtnStyle}>{label('مسح', 'Clear')}</button>
          )}
        </div>
      )}

      {/* ── Table ── */}
      <div style={cardStyle}>
        {loading ? (
          <div style={{ padding:'var(--space-16)', textAlign:'center', color:'var(--color-text-muted)' }}>
            <BrandLoader />
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--color-neutral-50)', borderBottom:'2px solid var(--color-border)' }}>
                  {cols.map(c => <th key={c.key} style={thStyle}>{isAr ? c.ar : c.en}</th>)}
                </tr>
              </thead>
              <tbody>
                {displayedData.map((row: any, i: number) => (
                  <tr key={i}
                    style={{ borderBottom:'1px solid var(--color-border)', background: i%2===0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-pale-blue)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i%2===0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)')}
                  >
                    {cols.map(c => <td key={c.key} style={tdStyle}>{renderCell(c.key, row[c.key])}</td>)}
                  </tr>
                ))}
                {displayedData.length === 0 && (
                  <tr>
                    <td colSpan={cols.length}>
                      <div style={{ padding:'var(--space-16)', textAlign:'center' }}>
                        <div style={{ fontSize:'var(--text-2xl)', marginBottom:'var(--space-3)', opacity:0.25 }}>📋</div>
                        <p style={{ fontSize:'var(--text-sm)', color:'var(--color-text-muted)', margin:0 }}>
                          {label('لا توجد بيانات لعرضها', 'No data available')}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────
function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:'var(--radius-full)', fontSize:'var(--text-xs)', fontWeight:'var(--font-medium)', color, background: bg, whiteSpace:'nowrap' }}>
      {children}
    </span>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-1)' }}>
      <label style={{ fontSize:'var(--text-xs)', color:'var(--color-text-muted)', fontWeight:'var(--font-medium)' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background:'var(--color-bg-white)', borderRadius:'var(--radius-lg)',
  border:'1px solid var(--color-border)', overflow:'hidden', boxShadow:'var(--shadow-sm)',
};
const thStyle: React.CSSProperties = {
  padding:'var(--space-3) var(--space-4)', textAlign:'start',
  fontSize:'var(--text-xs)', fontWeight:'var(--font-semibold)',
  color:'var(--color-text-secondary)', textTransform:'uppercase',
  letterSpacing:'0.05em', whiteSpace:'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding:'var(--space-3) var(--space-4)', fontSize:'var(--text-sm)',
  color:'var(--color-text-primary)', verticalAlign:'middle', whiteSpace:'nowrap',
};
const exportBtnStyle: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', gap:'6px',
  padding:'var(--space-2) var(--space-4)', color:'#fff',
  border:'none', borderRadius:'var(--radius-md)', cursor:'pointer',
  fontSize:'var(--text-sm)', fontWeight:'var(--font-light)',
  transition:'opacity var(--transition-fast)',
};
const clearBtnStyle: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', gap:'6px',
  padding:'var(--space-2) var(--space-3)', background:'transparent',
  color:'var(--color-danger)', border:'1px solid var(--color-danger)',
  borderRadius:'var(--radius-md)', cursor:'pointer', fontSize:'var(--text-sm)',
};
const inputStyle: React.CSSProperties = {
  padding:'var(--space-2) var(--space-3)',
  border:'1px solid var(--color-border-strong)', borderRadius:'var(--radius-md)',
  fontSize:'var(--text-sm)', color:'var(--color-text-primary)',
  background:'var(--color-bg-white)', fontFamily:'inherit', minWidth:'120px',
};
