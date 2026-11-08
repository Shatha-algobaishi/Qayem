import { escapeHtml } from '../../../shared/utils/safeOutput';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { fetchEvaluation, fetchQuestions } from '../evaluationSlice';
import { api } from '../../../core/api/apiClient';
import ScoreMeter from '../../../shared/components/ui/ScoreMeter';
import SignatureModal, { getSignature } from '../../../shared/components/ui/SignatureModal';

interface CandidateDetail {
  id: string;
  nationalId: string;
  fullNameAr: string;
  fullNameEn: string;
  qualification?: string;
  gpa?: number;
  gpaSystem?: string;
  university?: string;
  specializationAr?: string;
  specializationEn?: string;
  yearsOfExperience?: number;
  currentEmployer?: string;
  currentTitle?: string;
  hasCv?: boolean;
  cvOriginalName?: string;
}

interface AnswerState {
  questionId: string;
  score:      number;
  comment:    string;
}

export default function EvaluationFormPage() {
  const { id }    = useParams<{ id: string }>();
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const locale    = useAppSelector(s => s.ui.locale);
  const { current, questions } = useAppSelector(s => s.evaluations);
  const isAr      = locale === 'ar';

  const user = useAppSelector(s => s.auth.user);

  const [answers, setAnswers]     = useState<AnswerState[]>([]);
  const [notes, setNotes]         = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');
  const [saveError, setSaveError] = useState('');
  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);

  useEffect(() => {
    dispatch(fetchQuestions());
    if (id) {
      dispatch(fetchEvaluation(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (current?.candidateId) {
      api.candidates.get(current.candidateId)
        .then(res => setCandidateDetail(res.data))
        .catch(() => {});
    }
  }, [current?.candidateId]);

  // Initialise answer state from existing evaluation or blank
  useEffect(() => {
    if (questions.length === 0) return;
    const init = questions.map(q => {
      const existing = current?.answers.find(a => a.questionId === q.id);
      return { questionId: q.id, score: existing?.score ?? 0, comment: existing?.comment ?? '' };
    });
    setAnswers(init);
    if (current?.notes) setNotes(current.notes);
  }, [questions, current]);

  const totalScore    = answers.reduce((s, a) => s + a.score, 0);
  const allAnswered   = answers.length > 0 && answers.length === questions.length && answers.every(a => a.score >= 1);
  const isSubmitted   = current?.status === 'Submitted' || current?.status === 'ReviewedByManager';

  const label = (ar: string, en: string) => isAr ? ar : en;

  const setScore = (questionId: string, score: number) =>
    setAnswers(prev => prev.map(a => a.questionId === questionId ? { ...a, score } : a));

  const setComment = (questionId: string, comment: string) =>
    setAnswers(prev => prev.map(a => a.questionId === questionId ? { ...a, comment } : a));

  const handlePreviewCv = () => {
    if (!current?.candidateId) return;
    const token = localStorage.getItem('accessToken');
    const url   = `${api.candidates.previewCvUrl(current.candidateId)}?token=${encodeURIComponent(token ?? '')}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await api.evaluations.save(id, { evaluationId: id, answers, notes });
      setSaveMsg(label('تم الحفظ', 'Saved'));
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? e?.response?.data?.message ?? label('فشل الحفظ، حاول مجدداً', 'Save failed, please try again'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!id || !allAnswered) return;
    setIsSubmitting(true);
    setSaveError('');
    try {
      await api.evaluations.save(id, { evaluationId: id, answers, notes });
      await api.evaluations.submit(id);
      navigate('/evaluations/my');
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? e?.response?.data?.message ?? label('فشل تقديم التقييم، حاول مجدداً', 'Submit failed, please try again'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!current || !user) return;
    const sig = getSignature(user.id);
    const ev = current as any;
    const dateStr = ev.submittedAt
      ? new Date(ev.submittedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-SA', { year: 'numeric', month: 'long', day: 'numeric' });

    const decisionMap: Record<string, { ar: string; en: string; color: string }> = {
      Recommended:            { ar: 'يُوصى به',    en: 'Recommended',             color: '#16a34a' },
      ConditionallyQualified: { ar: 'مؤهل مشروط', en: 'Conditionally Qualified',  color: '#d97706' },
      NotQualified:           { ar: 'غير مؤهل',   en: 'Not Qualified',            color: '#dc2626' },
      Employed:               { ar: 'موظّف',       en: 'Employed',                 color: '#2563eb' },
    };
    const dec      = ev.systemDecision as string | undefined;
    const decLabel = dec ? (isAr ? decisionMap[dec]?.ar : decisionMap[dec]?.en) ?? dec : '';
    const decColor = dec ? (decisionMap[dec]?.color ?? '#64748b') : '#64748b';

    const qRows = questions.map(q => {
      const ans   = answers.find(a => a.questionId === q.id);
      const score = ans?.score ?? 0;
      const note  = ans?.comment ?? '';
      const text  = isAr ? q.textAr : q.textEn;
      return `<tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${escapeHtml(text)}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:15px">${score}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:12px;color:#64748b">${escapeHtml(note)}</td>
      </tr>`;
    }).join('');

    const candRows = candidateDetail ? [
      ['', candidateDetail.nationalId, isAr ? 'رقم الهوية' : 'National ID'],
      ['', isAr ? candidateDetail.specializationAr ?? '' : (candidateDetail.specializationEn ?? candidateDetail.specializationAr ?? ''), isAr ? 'التخصص' : 'Specialization'],
      ['', candidateDetail.qualification ?? '', isAr ? 'المؤهل' : 'Qualification'],
      ['', candidateDetail.university ?? '', isAr ? 'الجامعة' : 'University'],
      ['', candidateDetail.yearsOfExperience != null ? String(candidateDetail.yearsOfExperience) : '', isAr ? 'سنوات الخبرة' : 'Experience (yrs)'],
    ].filter(r => r[1]).map(([, val, lbl]) => `
      <div class="info-item">
        <div class="info-label">${lbl}</div>
        <div class="info-val">${escapeHtml(val)}</div>
      </div>`).join('') : '';

    const sigHtml = sig && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig)
      ? `<img src="${sig}" alt="signature" style="max-width:200px;max-height:80px;border:1px solid #e2e8f0;border-radius:6px;padding:4px;display:block;margin-top:6px" />`
      : `<div style="width:200px;height:60px;border-bottom:2px solid #cbd5e1;margin-top:8px"></div>
         <p style="font-size:10px;color:#94a3b8;margin-top:4px">${isAr ? 'التوقيع' : 'Signature'}</p>`;

    const dir = isAr ? 'rtl' : 'ltr';
    const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<title>${isAr ? 'نموذج تقييم' : 'Evaluation Form'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Tahoma,sans-serif;color:#0f172a;font-size:14px;padding:32px;direction:${dir}}
h2{font-size:14px;font-weight:700;margin-bottom:12px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:6px;margin-top:22px}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;border-bottom:2px solid #1e3a5f;padding-bottom:16px}
.hdr-title{font-size:20px;font-weight:700}
.hdr-sub{font-size:11px;color:#64748b;margin-top:4px}
.hdr-meta{text-align:${isAr ? 'left' : 'right'};font-size:12px;color:#64748b}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
.info-item{padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}
.info-label{font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
.info-val{font-size:13px;color:#0f172a;font-weight:500}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#1e3a5f;color:#fff;padding:9px 12px;font-size:12px;text-align:${isAr ? 'right' : 'left'}}
td{padding:8px 12px;border:1px solid #e2e8f0;font-size:13px;vertical-align:top}
tr:nth-child(even) td{background:#f8fafc}
.row2{display:flex;gap:28px;margin-bottom:20px;align-items:flex-start}
.notes-box{padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;line-height:1.7;min-height:72px;white-space:pre-wrap;flex:1}
.footer{display:flex;justify-content:space-between;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;align-items:flex-end}
.dec{display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;border:2px solid;margin-top:8px}
@media print{body{padding:16px}}
</style>
</head>
<body>
<div class="hdr">
  <div>
    <div class="hdr-title">${isAr ? 'نموذج تقييم مرشح' : 'Candidate Evaluation Form'}</div>
    <img src="${window.location.origin}/qayem-logo-${isAr ? 'ar' : 'en'}.svg" alt="Qayem" style="width:150px;height:44px"/>
    <div class="hdr-sub">${isAr ? 'قيّم' : 'Qayem'}</div>
  </div>
  <div class="hdr-meta">
    <div>${isAr ? 'تاريخ التقديم' : 'Submitted'}: <strong>${dateStr}</strong></div>
    <div style="margin-top:4px;color:#16a34a;font-weight:600">${isAr ? 'مُقدَّم' : 'Submitted'}</div>
  </div>
</div>

<h2>${isAr ? 'بيانات المرشح' : 'Candidate Information'}</h2>
<div class="grid2">
  <div class="info-item">
    <div class="info-label">${isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}</div>
    <div class="info-val">${current.candidateNameAr ?? '—'}</div>
  </div>
  <div class="info-item">
    <div class="info-label">${isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}</div>
    <div class="info-val">${current.candidateNameEn ?? '—'}</div>
  </div>
  ${candRows}
</div>

<h2>${isAr ? 'معايير التقييم' : 'Evaluation Criteria'}</h2>
<table>
  <thead><tr>
    <th style="width:55%">${isAr ? 'المعيار' : 'Criterion'}</th>
    <th style="width:15%;text-align:center">${isAr ? 'الدرجة /5' : 'Score /5'}</th>
    <th>${isAr ? 'ملاحظات' : 'Notes'}</th>
  </tr></thead>
  <tbody>${qRows}</tbody>
</table>

<div class="row2">
  <div style="min-width:160px">
    <h2 style="margin-top:0">${isAr ? 'الدرجة الإجمالية' : 'Total Score'}</h2>
    <div style="font-size:40px;font-weight:700;color:#1e3a5f;line-height:1">${totalScore}<span style="font-size:16px;color:#64748b"> / 30</span></div>
    ${dec ? `<div class="dec" style="color:${decColor};border-color:${decColor}">${decLabel}</div>` : ''}
  </div>
  <div style="flex:1">
    <h2 style="margin-top:0">${isAr ? 'الملاحظات والتوصيات' : 'Notes & Recommendations'}</h2>
    <div class="notes-box">${escapeHtml(notes) || (isAr ? 'لا توجد ملاحظات' : 'No notes added')}</div>
  </div>
</div>

<div class="footer">
  <div>
    <div style="font-size:11px;color:#64748b;margin-bottom:4px">${isAr ? 'المقيِّم' : 'Evaluator'}</div>
    <div style="font-size:15px;font-weight:700;color:#0f172a">${escapeHtml(isAr ? user.fullNameAr : (user.fullNameEn || user.fullNameAr))}</div>
    ${sigHtml}
  </div>
  <div style="text-align:${isAr ? 'left' : 'right'}">
    <div style="font-size:11px;color:#64748b;margin-bottom:4px">${isAr ? 'قيّم' : 'Qayem'}</div>
    <div style="font-size:12px;color:#64748b">${dateStr}</div>
  </div>
</div>

<script>window.onload=function(){window.print()}</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=850,height=1100');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  if (!current && !questions.length) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        {label('جارٍ التحميل...', 'Loading...')}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* ── Page title ── */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)' }}>
          {label('نموذج التقييم', 'Evaluation Form')}
        </h2>
        {current && (
          <p style={{ marginTop: 'var(--space-1)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {label('المرشح:', 'Candidate:')} {isAr ? current.candidateNameAr : current.candidateNameEn}
          </p>
        )}
        {isSubmitted && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{
              padding:      'var(--space-3) var(--space-4)',
              background:   'var(--color-info-light)',
              borderRadius: 'var(--radius-md)',
              fontSize:     'var(--text-sm)',
              color:        'var(--color-info)',
              flex: 1,
              minWidth: 200,
            }}>
              {label('تم تقديم هذا التقييم ولا يمكن تعديله.', 'This evaluation has been submitted and is read-only.')}
            </div>
            <button
              onClick={() => setShowSigModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-bg-white)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              {label('التوقيع الإلكتروني', 'Electronic Signature')}
            </button>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: 'var(--space-2) var(--space-4)',
                background: 'var(--color-primary-dark)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: '#fff',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
              </svg>
              {label('طباعة التقييم', 'Print Evaluation')}
            </button>
          </div>
        )}
      </div>

      {/* ── Candidate info card ── */}
      {candidateDetail && (
        <div style={{ background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: 'var(--space-5)', marginBottom: 'var(--space-6)', boxShadow: 'var(--shadow-sm)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-4)' }}>
            {label('بيانات المرشح', 'Candidate Profile')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
            <InfoItem label={label('رقم الهوية', 'National ID')} value={candidateDetail.nationalId} mono />
            <InfoItem label={label('الاسم (عربي)', 'Name (Arabic)')} value={candidateDetail.fullNameAr} />
            <InfoItem label={label('الاسم (إنجليزي)', 'Name (English)')} value={candidateDetail.fullNameEn} />
            {candidateDetail.qualification && <InfoItem label={label('المؤهل', 'Qualification')} value={candidateDetail.qualification} />}
            {candidateDetail.university && <InfoItem label={label('الجامعة', 'University')} value={candidateDetail.university} />}
            {candidateDetail.gpa != null && (
              <InfoItem label={label('المعدل التراكمي', 'GPA')} value={`${candidateDetail.gpa} / ${candidateDetail.gpaSystem ?? '4.0'}`} />
            )}
            {candidateDetail.specializationAr && <InfoItem label={label('التخصص', 'Specialization')} value={isAr ? candidateDetail.specializationAr : (candidateDetail.specializationEn ?? candidateDetail.specializationAr)} />}
            {candidateDetail.yearsOfExperience != null && <InfoItem label={label('سنوات الخبرة', 'Experience (yrs)')} value={String(candidateDetail.yearsOfExperience)} />}
            {candidateDetail.currentEmployer && <InfoItem label={label('جهة العمل', 'Employer')} value={candidateDetail.currentEmployer} />}
            {candidateDetail.currentTitle && <InfoItem label={label('المسمى الوظيفي', 'Job Title')} value={candidateDetail.currentTitle} />}
            {candidateDetail.hasCv && current?.candidateId && (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label('السيرة الذاتية', 'CV')}</p>
                <button
                  onClick={handlePreviewCv}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-primary)', textDecoration: 'underline' }}
                >
                  {candidateDetail.cvOriginalName ?? label('عرض السيرة الذاتية', 'View CV')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Questions ── */}
      <div style={{
        background:   'var(--color-bg-white)',
        borderRadius: 'var(--radius-lg)',
        border:       '1px solid var(--color-border)',
        boxShadow:    'var(--shadow-sm)',
        overflow:     'hidden',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Table header */}
        <div style={{
          display:       'grid',
          gridTemplateColumns: '2fr repeat(5,1fr) 2fr',
          padding:       'var(--space-3) var(--space-6)',
          background:    'var(--color-neutral-50)',
          borderBottom:  '1px solid var(--color-border)',
          gap:           'var(--space-2)',
        }}>
          <div style={colHeaderStyle}>{label('معيار التقييم', 'Evaluation Criterion')}</div>
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} style={{ ...colHeaderStyle, textAlign: 'center' }}>{n}</div>
          ))}
          <div style={colHeaderStyle}>{label('ملاحظات', 'Notes')}</div>
        </div>

        {/* Question rows */}
        {questions.map((question, idx) => {
          const answer = answers.find(a => a.questionId === question.id);
          const score  = answer?.score ?? 0;

          return (
            <div
              key={question.id}
              style={{
                display:       'grid',
                gridTemplateColumns: '2fr repeat(5,1fr) 2fr',
                padding:       'var(--space-4) var(--space-6)',
                borderBottom:  idx < questions.length - 1 ? '1px solid var(--color-border)' : 'none',
                alignItems:    'center',
                gap:           'var(--space-2)',
                background:    score > 0 ? 'var(--color-neutral-50)' : 'var(--color-bg-white)',
              }}
            >
              {/* Question text */}
              <div>
                <span style={{
                  fontSize:   'var(--text-xs)',
                  color:      'var(--color-text-muted)',
                  display:    'block',
                  marginBottom: '2px',
                }}>
                  {idx + 1}.
                </span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)', color: 'var(--color-text-primary)' }}>
                  {isAr ? question.textAr : question.textEn}
                </span>
                {question.category && (
                  <span style={{
                    display:    'inline-block',
                    marginTop:  'var(--space-1)',
                    fontSize:   'var(--text-xs)',
                    color:      'var(--color-text-muted)',
                    background: 'var(--color-neutral-100)',
                    padding:    '1px var(--space-2)',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {question.category}
                  </span>
                )}
              </div>

              {/* Score radio buttons */}
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    disabled={isSubmitted}
                    onClick={() => !isSubmitted && setScore(question.id, n)}
                    title={`${label('النتيجة:', 'Score:')} ${n}`}
                    style={{
                      width:        '36px',
                      height:       '36px',
                      borderRadius: 'var(--radius-full)',
                      border:       score === n
                        ? '2px solid var(--color-primary-dark)'
                        : '2px solid var(--color-border)',
                      background:   score === n
                        ? 'var(--color-primary-dark)'
                        : 'transparent',
                      color:        score === n ? '#fff' : 'var(--color-text-secondary)',
                      cursor:       isSubmitted ? 'default' : 'pointer',
                      fontSize:     'var(--text-sm)',
                      fontWeight:   'var(--font-medium)',
                      transition:   'all var(--transition-fast)',
                    }}
                  >
                    {n}
                  </button>
                </div>
              ))}

              {/* Comment */}
              <input
                type="text"
                disabled={isSubmitted}
                value={answer?.comment ?? ''}
                onChange={e => setComment(question.id, e.target.value)}
                placeholder={label('ملاحظة اختيارية', 'Optional note')}
                style={{
                  width:        '100%',
                  padding:      'var(--space-2) var(--space-3)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize:     'var(--text-xs)',
                  color:        'var(--color-text-primary)',
                  background:   isSubmitted ? 'var(--color-neutral-100)' : 'var(--color-bg-white)',
                  fontFamily:   'inherit',
                  outline:      'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* ── Score summary ── */}
      <div style={{
        display:      'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:          'var(--space-5)',
        marginBottom: 'var(--space-6)',
      }}>
        {/* Total score */}
        <div style={{
          background:   'var(--color-bg-white)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--color-border)',
          padding:      'var(--space-6)',
          boxShadow:    'var(--shadow-sm)',
        }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
            {label('النتيجة الإجمالية', 'Total Score')}
          </p>
          <ScoreMeter score={totalScore} max={30} locale={locale} showDecision />
        </div>

        {/* Notes */}
        <div style={{
          background:   'var(--color-bg-white)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--color-border)',
          padding:      'var(--space-6)',
          boxShadow:    'var(--shadow-sm)',
        }}>
          <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-3)' }}>
            {label('الانطباع العام (نقاط القوة والضعف) والتوصيات النهائية', 'General Impression (Strengths & Weaknesses) and Final Recommendations')}
          </label>
          <textarea
            disabled={isSubmitted}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={5}
            style={{
              width:        '100%',
              border:       '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding:      'var(--space-3)',
              fontSize:     'var(--text-sm)',
              fontFamily:   'inherit',
              resize:       'vertical',
              background:   isSubmitted ? 'var(--color-neutral-100)' : 'var(--color-bg-white)',
              color:        'var(--color-text-primary)',
              outline:      'none',
            }}
            placeholder={label('أضف ملاحظاتك حول المرشح', 'Add your notes about the candidate')}
          />
        </div>
      </div>

      {/* ── Actions ── */}
      {!isSubmitted && (
        <div style={{
          display:   'flex',
          gap:       'var(--space-3)',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {saveError && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 'var(--font-medium)' }}>
              {saveError}
            </span>
          )}
          {saveMsg && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-recommended)', fontWeight: 'var(--font-medium)' }}>
              ✓ {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding:      'var(--space-3) var(--space-6)',
              border:       '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              background:   'var(--color-bg-white)',
              cursor:       'pointer',
              fontSize:     'var(--text-sm)',
              color:        'var(--color-text-secondary)',
            }}
          >
            {isSaving ? label('جارٍ الحفظ...', 'Saving...') : label('حفظ مسودة', 'Save Draft')}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            style={{
              padding:      'var(--space-3) var(--space-6)',
              background:   allAnswered ? 'var(--color-primary-dark)' : 'var(--color-neutral-300)',
              color:        '#fff',
              border:       'none',
              borderRadius: 'var(--radius-md)',
              cursor:       allAnswered ? 'pointer' : 'not-allowed',
              fontSize:     'var(--text-sm)',
              fontWeight:   'var(--font-light)',
            }}
          >
            {isSubmitting
              ? label('جارٍ التقديم...', 'Submitting...')
              : label('تقديم التقييم', 'Submit Evaluation')}
          </button>
        </div>
      )}

      {!allAnswered && !isSubmitted && (
        <p style={{ textAlign: 'end', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
          {label('يجب الإجابة على جميع الأسئلة قبل التقديم', 'All questions must be answered before submitting')}
        </p>
      )}

      {showSigModal && user && (
        <SignatureModal
          userId={user.id}
          isAr={isAr}
          onClose={() => setShowSigModal(false)}
        />
      )}
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</p>
    </div>
  );
}

const colHeaderStyle: React.CSSProperties = {
  fontSize:      'var(--text-xs)',
  fontWeight:    'var(--font-semibold)',
  color:         'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
