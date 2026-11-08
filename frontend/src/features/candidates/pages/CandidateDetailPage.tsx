import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';
import { DecisionBadge } from '../../sessions/pages/SessionDetailPage';
import ScoreMeter from '../../../shared/components/ui/ScoreMeter';

export default function CandidateDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  const effectiveRole = activeRoleName ?? user?.roleName;
  const locale     = useAppSelector(s => s.ui.locale);
  const isAr       = locale === 'ar';
  const label      = (ar: string, en: string) => isAr ? ar : en;

  const [candidate, setCandidate]       = useState<any>(null);
  const [evaluations, setEvaluations]   = useState<any[]>([]);
  const [expandedEval, setExpandedEval] = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [cvUploading, setCvUploading]   = useState(false);

  const [cvError, setCvError]           = useState('');
  const [cvSuccess, setCvSuccess]       = useState('');

  // Decision form state (Manager only)
  const [decisionOpen, setDecisionOpen]         = useState(false);
  const [decisionValue, setDecisionValue]       = useState('');
  const [decisionReason, setDecisionReason]     = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError]       = useState('');
  const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', location: '' });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assign evaluators state
  const [availableEvaluators, setAvailableEvaluators] = useState<any[]>([]);
  const [assignedIds, setAssignedIds]   = useState<string[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError]   = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const load = () => {
    if (!id) return;
    setIsLoading(true);
    api.candidates.get(id)
      .then(res => {
        const cand = res.data;
        setCandidate(cand);
        setAssignedIds((cand.assignedEvaluators ?? []).map((e: any) => e.userId));
        // Evaluations are now included directly in the candidate response
        setEvaluations(cand.evaluations ?? []);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [id]);

  const canAssignEvaluators = effectiveRole === 'Admin' || effectiveRole === 'DataEntry';
  useEffect(() => {
    if (!canAssignEvaluators) return;
    api.users.evaluators().then(res => setAvailableEvaluators(res.data ?? [])).catch(() => {});
  }, [canAssignEvaluators]);

  const handleCvUpload = async (file: File) => {
    if (!id) return;
    setCvUploading(true); setCvError(''); setCvSuccess('');
    try {
      await api.candidates.uploadCv(id, file);
      setCvSuccess(label('تم رفع السيرة الذاتية بنجاح', 'CV uploaded successfully'));
      load();
    } catch (e: any) {
      setCvError(e?.response?.data?.message ?? label('فشل رفع الملف', 'Upload failed'));
    } finally {
      setCvUploading(false);
    }
  };

  const handleCvDelete = async () => {
    if (!id || !candidate?.hasCv) return;
    if (!window.confirm(label('هل أنت متأكد من حذف السيرة الذاتية؟', 'Delete the CV file?'))) return;
    try {
      await api.candidates.deleteCv(id);
      setCvSuccess(label('تم حذف السيرة الذاتية', 'CV deleted'));
      load();
    } catch { setCvError(label('فشل الحذف', 'Delete failed')); }
  };

  const handleCvAction = (action: 'download' | 'preview') => {
    if (!id) return;
    setCvError('');
    const token = localStorage.getItem('accessToken');
    const base  = action === 'download'
      ? api.candidates.downloadCvUrl(id)
      : api.candidates.previewCvUrl(id);
    window.open(`${base}?token=${encodeURIComponent(token ?? '')}`, '_blank', 'noopener');
  };

  const handleSaveEvaluators = async () => {
    if (!id) return;
    setAssignSaving(true);
    setAssignError('');
    setAssignSuccess('');
    try {
      await api.candidates.assignEvaluators(id, assignedIds);
      setAssignSuccess(label('تم حفظ المقيّمين بنجاح', 'Evaluators saved successfully'));
      load();
    } catch (e: any) {
      setAssignError(e?.response?.data?.message ?? label('فشل الحفظ', 'Save failed'));
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!id || !scheduleForm.scheduledAt) return;
    try {
      await api.candidates.scheduleInterview(id, {
        scheduledAt: scheduleForm.scheduledAt,
        location: scheduleForm.location || undefined,
      });
      setScheduleOpen(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? label('فشل تحديد الموعد', 'Failed to schedule'));
    }
  };

  if (isLoading) return (
    <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      {label('جارٍ التحميل...', 'Loading...')}
    </div>
  );
  if (!candidate) return (
    <div style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
      {label('المرشح غير موجود', 'Candidate not found')}
    </div>
  );

  const submittedEvals = evaluations.filter((e: any) => e.status !== 'Draft' && e.totalScore != null);
  const avgScore = submittedEvals.length > 0
    ? submittedEvals.reduce((s: number, e: any) => s + (e.totalScore ?? 0), 0) / submittedEvals.length
    : null;

  const statusColors: Record<string, string> = {
    Pending: 'var(--color-neutral-500)',
    InProgress: 'var(--color-warning)',
    Completed: 'var(--color-recommended)',
  };
  const statusArMap: Record<string, string> = { Pending: 'قيد المراجعة', InProgress: 'مرشح للمقابلة', Completed: 'تمت المقابلة' };
  const evalStatusAr: Record<string, string> = { Draft: 'مسودة', Submitted: 'مقدَّم', ReviewedByManager: 'مراجَع' };

  const canEditCv = effectiveRole === 'Admin' || effectiveRole === 'DataEntry';
  const canSchedule = effectiveRole === 'Admin' || effectiveRole === 'DataEntry';

  // Build full display name
  const displayNameAr = candidate.firstNameAr
    ? [candidate.firstNameAr, candidate.secondNameAr, candidate.lastNameAr].filter(Boolean).join(' ')
    : candidate.fullNameAr;

  return (
    <div>
      <button onClick={() => navigate(-1)} style={ghostBtnStyle}>
        {label('← رجوع', '← Back')}
      </button>

      {/* ── Page header ── */}
      <div style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
            {isAr ? displayNameAr : candidate.fullNameEn}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>
            {candidate.nationalId}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: statusColors[candidate.candidateStatus] ?? 'var(--color-text-muted)' }}>
              {isAr ? (statusArMap[candidate.candidateStatus] ?? candidate.candidateStatus) : candidate.candidateStatus}
            </span>
            {candidate.applicationType && (
              <span style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                {candidate.applicationType}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {canEditCv && (
            <button onClick={() => navigate(`/candidates/new?candidateId=${id}`)} style={ghostBtnStyle}>
              {label('تعديل البيانات', 'Edit Info')}
            </button>
          )}
          {['Manager', 'Admin', 'DataEntry'].includes(effectiveRole ?? '') && (
            <button
              onClick={() => { setDecisionOpen(true); setDecisionError(''); setDecisionValue(''); setDecisionReason(''); }}
              style={primaryBtnStyle}
            >
              {label('إصدار قرار', 'Issue Decision')}
            </button>
          )}
        </div>
      </div>

      {/* ── Info cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        {/* Personal Info */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>{label('البيانات الشخصية', 'Personal Information')}</div>
          <div style={cardBodyStyle}>
            {[
              [label('الاسم الأول', 'First Name'), candidate.firstNameAr || '—'],
              [label('الاسم الثاني', 'Second Name'), candidate.secondNameAr || '—'],
              [label('الاسم الأخير', 'Last Name'), candidate.lastNameAr || candidate.fullNameAr],
              [label('الاسم (إنجليزي)', 'Name (English)'), candidate.fullNameEn || '—'],
              [label('البريد الإلكتروني', 'Email'), candidate.email || '—'],
              [label('الجوال', 'Phone'), candidate.phoneNumber || '—'],
              [label('نوع الطلب', 'Application Type'), candidate.applicationType || '—'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-regular)', textAlign: 'end', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Academic & Work */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>{label('المؤهلات والخبرة', 'Qualifications & Experience')}</div>
          <div style={cardBodyStyle}>
            {[
              [label('المؤهل', 'Qualification'), candidate.qualification || '—'],
              [label('التخصص', 'Specialization'), (isAr ? candidate.specializationAr : candidate.specializationEn) || '—'],
              [label('الجامعة', 'University'), candidate.university || '—'],
              [label('المعدل', 'GPA'), candidate.gpa != null ? `${candidate.gpa} (${candidate.gpaSystem})` : '—'],
              [label('سنوات الخبرة', 'Experience'), candidate.yearsOfExperience != null ? `${candidate.yearsOfExperience} ${label('سنة', 'yr')}` : '—'],
              [label('جهة العمل', 'Employer'), candidate.currentEmployer || '—'],
              [label('المسمى الحالي', 'Current Title'), candidate.currentTitle || '—'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--color-text-primary)', textAlign: 'end', maxWidth: '60%' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scores */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>{label('نتائج التقييم', 'Evaluation Results')}</div>
          <div style={cardBodyStyle}>
            {avgScore != null ? (
              <ScoreMeter score={avgScore} max={30} locale={locale} showDecision />
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-6)' }}>
                {label('لا توجد تقييمات مكتملة', 'No completed evaluations yet')}
              </p>
            )}
            {candidate.highestScore != null && (
              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                <span>{label('الأعلى', 'High')}: <b>{candidate.highestScore}</b></span>
                <span>{label('الأدنى', 'Low')}: <b>{candidate.lowestScore}</b></span>
                <span style={{ color: candidate.hasDiscrepancy ? 'var(--color-warning)' : 'inherit' }}>
                  {label('التباين', 'Var')}: <b>{candidate.scoreVariance}</b>
                </span>
              </div>
            )}
            <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {[
                [label('قرار النظام', 'System Decision'), candidate.systemDecision],
                [label('القرار النهائي', 'Final Decision'), candidate.finalDecision],
              ].map(([k, v]: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                  {v ? <DecisionBadge decision={v} isAr={isAr} /> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </div>
              ))}
              {candidate.isOverridden && candidate.overrideReason && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-warning-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  <strong>{label('سبب التعديل:', 'Override Reason:')}</strong> {candidate.overrideReason}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bias Analysis card — Manager only, placed next to Scores card in same grid */}
        {effectiveRole === 'Manager' && submittedEvals.length > 0 && avgScore != null && (() => {
          const rows = submittedEvals.map((ev: any) => {
            const deviation = (ev.totalScore ?? 0) - avgScore!;
            const bias = deviation > 5 ? 'positive' : deviation < -5 ? 'negative' : 'consistent';
            return { ev, deviation, bias };
          });
          const hasBias = rows.some(r => r.bias !== 'consistent');
          return (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>{label('تحليل الانحياز', 'Bias Analysis')}</div>
              <div style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {!hasBias ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-recommended)', fontWeight: 'var(--font-medium)' }}>
                    ✓ {label('لا يوجد انحياز', 'No bias detected')}
                  </p>
                ) : (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', fontWeight: 'var(--font-medium)' }}>
                    ⚠ {label('يوجد انحياز لدى بعض المقيّمين', 'Bias detected in some evaluators')}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {rows.map(({ ev, deviation, bias }, i) => {
                    const color = bias === 'positive'
                      ? 'var(--color-recommended)'
                      : bias === 'negative'
                        ? 'var(--color-not-qualified)'
                        : 'var(--color-primary-dark)';
                    const biasLbl = bias === 'positive'
                      ? label('انحياز إيجابي', 'Positive Bias')
                      : bias === 'negative'
                        ? label('انحياز سلبي', 'Negative Bias')
                        : label('اتساق معياري', 'Consistent');
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', border: `1px solid ${color}33` }}>
                        <span style={{ flex: 1, fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.evaluatorNameAr || label('مقيّم', 'Evaluator')}
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary-dark)', minWidth: '28px', textAlign: 'center' }}>
                          {ev.totalScore}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', minWidth: '44px', textAlign: 'center', fontFamily: 'monospace' }}>
                          {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: `${color}18`, color, fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap' }}>
                          {biasLbl}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Bias legend */}
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 'var(--space-1)', color: 'var(--color-text-secondary)', fontWeight: 'var(--font-medium)' }}>
                    {label(`المتوسط العام لهذا المرشح: ${avgScore.toFixed(1)} / 30`, `Overall avg for this candidate: ${avgScore.toFixed(1)} / 30`)}
                  </div>
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    {label('الانحراف = درجة المقيّم − المتوسط العام', 'Deviation = evaluator score − overall average')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <span style={{ color: 'var(--color-recommended)', fontWeight: 'var(--font-medium)' }}>
                      {'>'}&nbsp;+5 → {label('انحياز إيجابي', 'Positive Bias')}
                    </span>
                    <span style={{ color: 'var(--color-not-qualified)', fontWeight: 'var(--font-medium)' }}>
                      {'<'}&nbsp;−5 → {label('انحياز سلبي', 'Negative Bias')}
                    </span>
                    <span style={{ color: 'var(--color-primary-dark)', fontWeight: 'var(--font-medium)' }}>
                      ±5 → {label('اتساق', 'Consistent')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Issue Decision Modal ── */}
      {['Manager', 'Admin', 'DataEntry'].includes(effectiveRole ?? '') && decisionOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => { if (e.target === e.currentTarget) setDecisionOpen(false); }}
        >
          <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', width: '480px', maxWidth: '95vw', maxHeight: '90vh', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal header */}
            <div style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', margin: 0 }}>
                  {label('إصدار قرار نهائي', 'Issue Final Decision')}
                </h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 'var(--space-1) 0 0' }}>
                  {isAr ? (candidate.fullNameAr ?? candidate.firstNameAr) : candidate.fullNameEn}
                </p>
              </div>
              <button onClick={() => setDecisionOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--color-text-muted)', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <div style={{ padding: 'var(--space-5) var(--space-6)', overflowY: 'auto', flex: 1 }}>
              {candidate.systemDecision && (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>{label('قرار النظام:', 'System decision:')}</span>
                  <DecisionBadge decision={candidate.systemDecision} isAr={isAr} />
                </div>
              )}

              <label style={{ display: 'block', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                {label('القرار النهائي *', 'Final Decision *')}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {([
                  { value: 'Recommended',            labelAr: 'يُوصى به',  labelEn: 'Recommended',   color: 'var(--color-recommended)' },
                  { value: 'ConditionallyQualified', labelAr: 'مؤهل',      labelEn: 'Qualified',     color: 'var(--color-conditional)' },
                  { value: 'NotQualified',           labelAr: 'غير مؤهل',  labelEn: 'Not Qualified', color: 'var(--color-danger)' },
                  { value: 'Employed',               labelAr: 'توظيف',     labelEn: 'Employed',      color: 'var(--color-primary-dark)' },
                ] as const).map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', border: `1px solid ${decisionValue === opt.value ? opt.color : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: decisionValue === opt.value ? 'var(--color-neutral-50)' : 'var(--color-bg-white)', transition: 'all 0.15s' }}>
                    <input type="radio" name="cdDecision" value={opt.value}
                      checked={decisionValue === opt.value}
                      onChange={() => setDecisionValue(opt.value)}
                      style={{ accentColor: opt.color }} />
                    <span style={{ fontSize: 'var(--text-sm)', color: decisionValue === opt.value ? opt.color : 'var(--color-text-primary)', fontWeight: decisionValue === opt.value ? 'var(--font-medium)' : 'var(--font-regular)' }}>
                      {isAr ? opt.labelAr : opt.labelEn}
                    </span>
                  </label>
                ))}
              </div>

              <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                {label('مبرر القرار * (إلزامي)', 'Justification * (Required)')}
              </label>
              <textarea
                value={decisionReason}
                onChange={e => setDecisionReason(e.target.value)}
                rows={3}
                placeholder={label('أدخل مبرر القرار النهائي...', 'Enter justification for this decision...')}
                style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--color-text-primary)', boxSizing: 'border-box' }}
              />

              {decisionError && (
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                  {decisionError}
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button onClick={() => setDecisionOpen(false)} style={ghostBtnStyle}>
                {label('إلغاء', 'Cancel')}
              </button>
              <button
                disabled={decisionSubmitting || !decisionValue || !decisionReason.trim()}
                onClick={async () => {
                  if (!id || !decisionValue || !decisionReason.trim()) return;
                  setDecisionSubmitting(true);
                  setDecisionError('');
                  try {
                    await api.manager.issueDecision({ candidateId: id, decision: decisionValue, reason: decisionReason.trim() });
                    setDecisionOpen(false);
                    load();
                  } catch (e: any) {
                    setDecisionError(e?.response?.data?.message ?? label('فشل إصدار القرار', 'Failed to issue decision'));
                  } finally {
                    setDecisionSubmitting(false);
                  }
                }}
                style={{ ...primaryBtnStyle, opacity: (!decisionValue || !decisionReason.trim()) ? 0.6 : 1 }}
              >
                {decisionSubmitting ? label('جارٍ...', 'Processing...') : label('تأكيد القرار', 'Confirm Decision')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Interview Schedule ── */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <div style={{ ...cardHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label('موعد المقابلة', 'Interview Schedule')}</span>
          {canSchedule && (
            <button onClick={() => setScheduleOpen(o => !o)} style={{ ...ghostBtnStyle, fontSize: 'var(--text-xs)' }}>
              {candidate.interviewScheduledAt ? label('تعديل الموعد', 'Edit Schedule') : label('تحديد موعد', 'Set Schedule')}
            </button>
          )}
        </div>
        <div style={cardBodyStyle}>
          {candidate.interviewScheduledAt ? (
            <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>{label('التاريخ والوقت:', 'Date & Time:')}</span>{' '}
                <span style={{ fontWeight: 'var(--font-medium)' }}>
                  {new Date(candidate.interviewScheduledAt).toLocaleString(isAr ? 'ar-SA' : 'en-SA', { dateStyle: 'full', timeStyle: 'short' })}
                </span>
              </div>
              {candidate.interviewLocation && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)' }}>{label('المكان:', 'Location:')}</span>{' '}
                  <span>{candidate.interviewLocation}</span>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {label('لم يُحدَّد موعد للمقابلة بعد', 'No interview scheduled yet')}
            </p>
          )}

          {scheduleOpen && canSchedule && (
            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                  {label('تاريخ ووقت المقابلة', 'Interview Date & Time')}
                </label>
                <input type="datetime-local" value={scheduleForm.scheduledAt}
                  onChange={e => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  style={inlineInputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
                  {label('المكان', 'Location')}
                </label>
                <input type="text" value={scheduleForm.location}
                  onChange={e => setScheduleForm(f => ({ ...f, location: e.target.value }))}
                  placeholder={label('قاعة الاجتماعات أ', 'Meeting Room A')}
                  style={inlineInputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button onClick={handleSchedule} style={primaryBtnStyle}>{label('حفظ', 'Save')}</button>
                <button onClick={() => setScheduleOpen(false)} style={ghostBtnStyle}>{label('إلغاء', 'Cancel')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CV Section ── */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <div style={cardHeaderStyle}>{label('السيرة الذاتية', 'Curriculum Vitae')}</div>
        <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
          {cvError && <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>{cvError}</div>}
          {cvSuccess && <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-success-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>{cvSuccess}</div>}

          {candidate.hasCv ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                  📎 {candidate.cvOriginalName ?? label('ملف مرفق', 'Attached file')}
                </p>
                {candidate.cvUploadedAt && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                    {label('رُفع في', 'Uploaded')} {new Date(candidate.cvUploadedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA')}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {candidate.cvOriginalName?.toLowerCase().endsWith('.pdf') && (
                  <button
                    onClick={() => handleCvAction('preview')}
                    style={{ ...ghostBtnStyle, fontSize: 'var(--text-xs)' }}
                  >
                    {label('معاينة', 'Preview')}
                  </button>
                )}
                <button
                  onClick={() => handleCvAction('download')}
                  style={{ ...primaryBtnStyle, fontSize: 'var(--text-xs)' }}
                >
                  {label('تنزيل', 'Download')}
                </button>
                {canEditCv && (
                  <>
                    <button onClick={() => fileInputRef.current?.click()} disabled={cvUploading}
                      style={{ ...ghostBtnStyle, fontSize: 'var(--text-xs)' }}>
                      {label('استبدال', 'Replace')}
                    </button>
                    <button onClick={handleCvDelete}
                      style={{ padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                      {label('حذف', 'Delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {label('لم يتم رفع سيرة ذاتية بعد', 'No CV uploaded yet')}
              </p>
              {canEditCv && (
                <button onClick={() => fileInputRef.current?.click()} disabled={cvUploading}
                  style={{ ...primaryBtnStyle, fontSize: 'var(--text-xs)' }}>
                  {cvUploading ? label('جارٍ الرفع...', 'Uploading...') : label('رفع سيرة ذاتية', 'Upload CV')}
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleCvUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* ── AI Summary ── */}
      {(candidate.aggregateScore != null || submittedEvals.length > 0 || candidate.aiSummary) && (() => {
        let parsed: any = null;
        try { if (candidate.aiSummary) parsed = JSON.parse(candidate.aiSummary); } catch { /* Summary may contain plain text from an older model. */ }
        const evalCount  = submittedEvals.length > 0 ? submittedEvals.length : (parsed?.evaluatorCount ?? 0);
        // Prefer live-computed average from loaded evaluations; fall back to stored value only if evals not loaded
        const scoreValue = avgScore != null
          ? avgScore.toFixed(1)
          : candidate.aggregateScore != null
            ? Number(candidate.aggregateScore).toFixed(1)
            : (parsed?.averageScore ?? '—');
        return (
          <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
            <div style={cardHeaderStyle}>{label('ملخص الذكاء الاصطناعي', 'AI Summary')}</div>
            <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Stats row — always visible when there are evaluations */}
                <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', flexWrap: 'wrap' }}>
                  <span>{label('متوسط الدرجة:', 'Avg Score:')} <b>{scoreValue}</b></span>
                  <span>{label('عدد المقيّمين الذين قيّموا:', 'Evaluators who submitted:')} <b>{evalCount}</b></span>
                  {assignedIds.length > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {label(`من أصل ${assignedIds.length} مقيّم`, `out of ${assignedIds.length} assigned`)}
                    </span>
                  )}
                </div>
                {parsed && (
                  <>
                    {parsed.strengths?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-recommended)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                          {label('نقاط القوة', 'Strengths')}
                        </p>
                        <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          {parsed.strengths.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {parsed.areasForImprovement?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-warning)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                          {label('نقاط التطوير', 'Areas for Improvement')}
                        </p>
                        <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          {parsed.areasForImprovement.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {parsed.observations?.length > 0 && (
                      <div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                          {label('ملاحظات عامة', 'General Observations')}
                        </p>
                        <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                          {parsed.observations.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {(parsed.agreements?.length > 0 || parsed.disagreements?.length > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        {parsed.agreements?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-info)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                              {label('نقاط اتفاق المقيّمين', 'Evaluator Agreement')}
                            </p>
                            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              {parsed.agreements.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {parsed.disagreements?.length > 0 && (
                          <div>
                            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-danger)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                              {label('نقاط اختلاف المقيّمين', 'Evaluator Disagreement')}
                            </p>
                            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                              {parsed.disagreements.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-sm)' }}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {parsed.recommendation && (
                      <div style={{ padding: 'var(--space-3)', background: 'var(--color-neutral-50)', borderRadius: 'var(--radius-md)', borderRight: '3px solid var(--color-primary-dark)' }}>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0 }}>{parsed.recommendation}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Evaluations with per-evaluator answers ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          {label('التقييمات التفصيلية', 'Detailed Evaluations')}
          {submittedEvals.length > 0 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginInlineStart: 'var(--space-2)' }}>
              ({submittedEvals.length} {label('مقيّم', 'evaluator(s)')})
            </span>
          )}
        </div>
        {evaluations.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            {label('لا توجد تقييمات بعد', 'No evaluations yet')}
          </div>
        ) : (
          <div>
            {evaluations.map((ev: any, i: number) => (
              <div key={ev.id} style={{ borderBottom: i < evaluations.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                {/* Evaluator summary row */}
                <div
                  onClick={() => setExpandedEval(expandedEval === ev.id ? null : ev.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                    padding: 'var(--space-4) var(--space-6)',
                    cursor: 'pointer',
                    background: expandedEval === ev.id ? 'var(--color-neutral-50)' : 'transparent',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', flexShrink: 0 }}>
                    {(ev.evaluatorNameAr || 'م').charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                      {ev.evaluatorNameAr || label('مجهول', 'Unknown')}
                    </p>
                    {ev.notes && (
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.notes}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
                    {ev.totalScore != null ? (
                      <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-thin)', color: 'var(--color-primary-dark)' }}>
                        {ev.totalScore}
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>—</span>
                    )}
                    {ev.systemDecision && <DecisionBadge decision={ev.systemDecision} isAr={isAr} />}
                    <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: ev.status === 'Submitted' ? 'var(--color-info-light)' : 'var(--color-neutral-100)', color: ev.status === 'Submitted' ? 'var(--color-info)' : 'var(--color-text-muted)' }}>
                      {isAr ? (evalStatusAr[ev.status] ?? ev.status) : ev.status}
                    </span>
                    {effectiveRole === 'Admin' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(label(`هل أنت متأكد من حذف تقييم ${ev.evaluatorNameAr}؟`, `Delete evaluation by ${ev.evaluatorNameAr}?`))) return;
                          try {
                            await api.admin.deleteEvaluation(ev.id);
                            load();
                          } catch {
                            alert(label('فشل الحذف', 'Delete failed'));
                          }
                        }}
                        style={{ background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', padding: '2px 8px', fontSize: 'var(--text-xs)', cursor: 'pointer', lineHeight: 1.4 }}
                      >
                        {label('حذف', 'Delete')}
                      </button>
                    )}
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>
                      {expandedEval === ev.id ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Per-answer breakdown */}
                {expandedEval === ev.id && ev.answers && ev.answers.length > 0 && (
                  <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)', background: 'var(--color-neutral-50)', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {ev.answers
                        .slice()
                        .sort((a: any, b: any) => a.questionOrder - b.questionOrder)
                        .map((ans: any, ai: number) => (
                          <div key={ai} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--color-bg-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-medium)' }}>
                                {ans.questionOrder}. {isAr ? ans.questionTextAr : ans.questionTextEn}
                              </p>
                              {ans.comment && (
                                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                                  {ans.comment}
                                </p>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '48px' }}>
                              <span style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-thin)', color: 'var(--color-primary-dark)' }}>
                                {ans.score}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                    {ev.notes && (
                      <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(0,93,69,0.04)', borderRadius: 'var(--radius-md)', borderRight: '2px solid var(--color-primary-dark)' }}>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase' }}>
                          {label('ملاحظات المقيّم', 'Evaluator Notes')}
                        </p>
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.6 }}>{ev.notes}</p>
                      </div>
                    )}
                    {ev.aiSummary && (() => {
                      let evSummary: any = null;
                      try { evSummary = JSON.parse(ev.aiSummary); } catch { return null; }
                      if (!evSummary) return null;
                      return (
                        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg-white)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-strong)' }}>
                          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary-dark)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>
                            {label('🤖 ملخص الذكاء الاصطناعي لهذا التقييم', '🤖 AI Summary for This Evaluation')}
                          </p>
                          {evSummary.overallSummary && (
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-3)', lineHeight: 1.6 }}>
                              {evSummary.overallSummary}
                            </p>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            {evSummary.strengths?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-recommended)', marginBottom: 'var(--space-1)' }}>
                                  {label('نقاط القوة', 'Strengths')}
                                </p>
                                <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
                                  {evSummary.strengths.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-xs)' }}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            {evSummary.weaknesses?.length > 0 && (
                              <div>
                                <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-warning)', marginBottom: 'var(--space-1)' }}>
                                  {label('نقاط الضعف', 'Weaknesses')}
                                </p>
                                <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
                                  {evSummary.weaknesses.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-xs)' }}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                          {evSummary.keyNotes?.length > 0 && (
                            <div style={{ marginTop: 'var(--space-2)' }}>
                              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                                {label('ملاحظات إضافية', 'Key Notes')}
                              </p>
                              <ul style={{ margin: 0, paddingInlineStart: 'var(--space-4)' }}>
                                {evSummary.keyNotes.map((s: string, i: number) => <li key={i} style={{ fontSize: 'var(--text-xs)' }}>{s}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {ev.submittedAt && (
                      <p style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'end' }}>
                        {label('قُدِّم في', 'Submitted')} {new Date(ev.submittedAt).toLocaleString(isAr ? 'ar-SA' : 'en-SA')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Assign Evaluators (editable for DataEntry/Admin, read-only for Manager) ── */}
      {(canAssignEvaluators || (effectiveRole === 'Manager' && candidate.assignedEvaluators?.length > 0)) && (
        <div style={{ ...cardStyle, marginTop: 'var(--space-5)' }}>
          <div style={{ ...cardHeaderStyle, justifyContent: 'space-between' }}>
            <span>{label('تحديد المقيّمين', 'Assign Evaluators')}</span>
          </div>
          <div style={{ padding: 'var(--space-5) var(--space-6)' }}>
            {canAssignEvaluators ? (
              <>
                {assignError && (
                  <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>{assignError}</div>
                )}
                {assignSuccess && (
                  <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-success-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>{assignSuccess}</div>
                )}
                {availableEvaluators.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    {label('لا يوجد مقيّمون متاحون', 'No evaluators available')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {availableEvaluators.map((ev: any) => {
                      const checked = assignedIds.includes(ev.id);
                      return (
                        <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', border: `1px solid ${checked ? 'var(--color-primary-dark)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-full)', cursor: 'pointer', background: checked ? 'rgba(0,93,69,0.06)' : 'transparent', fontSize: 'var(--text-sm)' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setAssignedIds(prev => checked ? prev.filter(x => x !== ev.id) : [...prev, ev.id])}
                            style={{ accentColor: 'var(--color-primary-dark)' }}
                          />
                          <span style={{ color: checked ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)' }}>
                            {isAr ? ev.fullNameAr : ev.fullNameEn}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={handleSaveEvaluators} disabled={assignSaving} style={primaryBtnStyle}>
                    {assignSaving ? label('جارٍ الحفظ...', 'Saving...') : label('حفظ التحديد', 'Save Selection')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                {(candidate.assignedEvaluators ?? []).map((ev: any) => (
                  <div key={ev.userId} style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {isAr ? ev.fullNameAr : ev.fullNameEn}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const cardHeaderStyle: React.CSSProperties = { padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center' };
const cardBodyStyle: React.CSSProperties = { padding: 'var(--space-5) var(--space-6)' };
const primaryBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };
const ghostBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const inlineInputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-white)', fontFamily: 'inherit', outline: 'none', width: '100%' };
