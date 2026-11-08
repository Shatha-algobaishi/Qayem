import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';

export default function RegisterCandidatePage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const locale         = useAppSelector(s => s.ui.locale);
  const isAr           = locale === 'ar';
  const label          = (ar: string, en: string) => isAr ? ar : en;

  const editCandidateId = searchParams.get('candidateId') ?? '';
  const isEditMode      = !!editCandidateId;

  const [sessions, setSessions]             = useState<any[]>([]);
  const [qualifications, setQualifications] = useState<{ ar: string; en: string }[]>([]);
  const [appTypes, setAppTypes]             = useState<{ ar: string; en: string }[]>([]);
  const [availableEvaluators, setEvaluators] = useState<any[]>([]);
  const [loadingEvaluators, setLoadingEvaluators] = useState(true);
  const [evaluatorsError, setEvaluatorsError] = useState('');

  const [form, setForm] = useState({
    sessionId:         searchParams.get('sessionId') ?? '',
    nationalId:        '',
    firstNameAr:       '',
    secondNameAr:      '',
    lastNameAr:        '',
    fullNameEn:        '',
    email:             '',
    phoneNumber:       '',
    qualification:     '',
    specializationAr:  '',
    specializationEn:  '',
    yearsOfExperience: '',
    notes:             '',
    applicationType:   '',
    gpa:               '',
    gpaSystem:         '4.0',
    university:        '',
    currentEmployer:   '',
    currentTitle:      '',
    interviewScheduledAt: '',
    interviewLocation: '',
  });
  const [selectedEvaluators, setSelectedEvaluators] = useState<string[]>([]);
  const [cvFile, setCvFile]         = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedFields, setExtractedFields] = useState<string[]>([]);

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    api.sessions.list({ status: 'Active', pageSize: 100 })
      .then(res => setSessions(res.data.items ?? []));

    api.admin.getReferenceList('ApplicationTypes')
      .then(res => setAppTypes(res.data.items?.map((i: any) => ({ ar: i.valueAr, en: i.valueEn || i.valueAr })) ?? []))
      .catch(() => setAppTypes([
        { ar: 'وظيفة', en: 'Employment' }, { ar: 'تمهير', en: 'Tamheer' },
        { ar: 'تدريب تعاوني', en: 'Co-op Training' }, { ar: 'تدريب صيفي', en: 'Summer Training' },
        { ar: 'عقد', en: 'Contract' },
      ]));

    api.admin.getReferenceList('Qualifications')
      .then(res => setQualifications(res.data.items?.map((i: any) => ({ ar: i.valueAr, en: i.valueEn || i.valueAr })) ?? []))
      .catch(() => setQualifications([
        { ar: 'دكتوراه', en: 'PhD' }, { ar: 'ماجستير', en: 'Master\'s' },
        { ar: 'بكالوريوس', en: 'Bachelor\'s' }, { ar: 'دبلوم', en: 'Diploma' },
        { ar: 'ثانوية', en: 'High School' },
      ]));

    setLoadingEvaluators(true);
    setEvaluatorsError('');
    api.users.evaluators()
      .then(res => setEvaluators(Array.isArray(res.data) ? res.data : []))
      .catch((e: any) => setEvaluatorsError(e?.response?.data?.message ?? e?.message ?? label('خطأ في تحميل المقيّمين', 'Failed to load evaluators')))
      .finally(() => setLoadingEvaluators(false));
  }, []);

  // In edit mode: pre-fill form from existing candidate data
  useEffect(() => {
    if (!isEditMode) return;
    api.candidates.get(editCandidateId).then(res => {
      const c = res.data;
      setForm(prev => ({
        ...prev,
        sessionId:         c.sessionId ?? prev.sessionId,
        nationalId:        c.nationalId ?? '',
        firstNameAr:       c.firstNameAr ?? '',
        secondNameAr:      c.secondNameAr ?? '',
        lastNameAr:        c.lastNameAr ?? '',
        fullNameEn:        c.fullNameEn ?? '',
        email:             c.email ?? '',
        phoneNumber:       c.phoneNumber ?? '',
        qualification:     c.qualification ?? '',
        specializationAr:  c.specializationAr ?? '',
        specializationEn:  c.specializationEn ?? '',
        yearsOfExperience: c.yearsOfExperience != null ? String(c.yearsOfExperience) : '',
        notes:             c.notes ?? '',
        applicationType:   c.applicationType ?? '',
        gpa:               c.gpa != null ? String(c.gpa) : '',
        gpaSystem:         c.gpaSystem ?? '4.0',
        university:        c.university ?? '',
        currentEmployer:   c.currentEmployer ?? '',
        currentTitle:      c.currentTitle ?? '',
        interviewScheduledAt: c.interviewScheduledAt ? c.interviewScheduledAt.slice(0, 16) : '',
        interviewLocation: c.interviewLocation ?? '',
      }));
      setSelectedEvaluators((c.assignedEvaluators ?? []).map((e: any) => e.userId));
    }).catch(() => {});
  }, [editCandidateId]);

  // AI (feature 1): extract candidate fields from the selected CV so Data Entry
  // only has to review/correct them instead of retyping everything. Nothing is
  // saved here — the form stays fully editable and the user still hits "Save".
  const handleExtractCv = async () => {
    if (!cvFile) return;
    setIsExtracting(true);
    setExtractError('');
    setExtractedFields([]);
    try {
      const res = await api.candidates.extractCv(cvFile);
      const fields: Record<string, string | number> = res.data?.fields ?? {};
      const keys = Object.keys(fields);
      if (keys.length === 0) {
        setExtractError(label(
          'لم يتمكن الذكاء الاصطناعي من استخراج أي بيانات من هذا الملف، يرجى تعبئة الحقول يدويًا.',
          'AI could not extract any fields from this file — please fill the form manually.'
        ));
        return;
      }
      setForm(prev => ({
        ...prev,
        ...(fields.fullNameEn        != null ? { fullNameEn: String(fields.fullNameEn) } : {}),
        ...(fields.firstNameAr       != null ? { firstNameAr: String(fields.firstNameAr) } : {}),
        ...(fields.secondNameAr      != null ? { secondNameAr: String(fields.secondNameAr) } : {}),
        ...(fields.lastNameAr        != null ? { lastNameAr: String(fields.lastNameAr) } : {}),
        ...(fields.email             != null ? { email: String(fields.email) } : {}),
        ...(fields.phoneNumber       != null ? { phoneNumber: String(fields.phoneNumber) } : {}),
        ...(fields.nationalId        != null ? { nationalId: String(fields.nationalId) } : {}),
        ...(fields.qualification     != null ? { qualification: String(fields.qualification) } : {}),
        ...(fields.specializationAr  != null ? { specializationAr: String(fields.specializationAr) } : {}),
        ...(fields.specializationEn  != null ? { specializationEn: String(fields.specializationEn) } : {}),
        ...(fields.yearsOfExperience != null ? { yearsOfExperience: String(fields.yearsOfExperience) } : {}),
        ...(fields.university        != null ? { university: String(fields.university) } : {}),
        ...(fields.gpa               != null ? { gpa: String(fields.gpa) } : {}),
        ...(fields.currentEmployer   != null ? { currentEmployer: String(fields.currentEmployer) } : {}),
        ...(fields.currentTitle      != null ? { currentTitle: String(fields.currentTitle) } : {}),
      }));
      setExtractedFields(keys);
    } catch (e: any) {
      setExtractError(e?.response?.data?.message ?? label(
        'تعذّر الاتصال بخدمة الذكاء الاصطناعي، يرجى تعبئة الحقول يدويًا.',
        'Could not reach the AI extraction service — please fill the form manually.'
      ));
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleEvaluator = (id: string) => {
    setSelectedEvaluators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEditMode && (!form.firstNameAr || !form.lastNameAr)) {
      setError(label('يرجى ملء الحقول المطلوبة: الاسم الأول، الاسم الأخير', 'Please fill: First Name, Last Name'));
      return;
    }
    if (isEditMode && (!form.firstNameAr || !form.lastNameAr)) {
      setError(label('الاسم الأول والأخير مطلوبان', 'First and last name are required'));
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      if (isEditMode) {
        await api.candidates.update(editCandidateId, {
          nationalId:        form.nationalId.trim() || null,
          firstNameAr:       form.firstNameAr,
          secondNameAr:      form.secondNameAr || null,
          lastNameAr:        form.lastNameAr,
          fullNameAr:        null,
          fullNameEn:        form.fullNameEn || null,
          email:             form.email || null,
          phoneNumber:       form.phoneNumber || null,
          qualification:     form.qualification || null,
          specializationAr:  form.specializationAr || null,
          specializationEn:  form.specializationEn || null,
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
          notes:             form.notes || null,
          applicationType:   form.applicationType || null,
          gpa:               form.gpa ? parseFloat(form.gpa) : null,
          gpaSystem:         form.gpa ? form.gpaSystem : null,
          university:        form.university || null,
          currentEmployer:   form.currentEmployer || null,
          currentTitle:      form.currentTitle || null,
        });
        await api.candidates.assignEvaluators(editCandidateId, selectedEvaluators);
        if (cvFile) {
          await api.candidates.uploadCv(editCandidateId, cvFile).catch(() => {});
        }
        navigate(`/candidates/${editCandidateId}`);
      } else {
        const res = await api.candidates.register({
          sessionId:         form.sessionId || null,
          nationalId:        form.nationalId.trim() || null,
          firstNameAr:       form.firstNameAr,
          secondNameAr:      form.secondNameAr || null,
          lastNameAr:        form.lastNameAr,
          fullNameAr:        null,
          fullNameEn:        form.fullNameEn || null,
          email:             form.email || null,
          phoneNumber:       form.phoneNumber || null,
          qualification:     form.qualification || null,
          specializationAr:  form.specializationAr || null,
          specializationEn:  form.specializationEn || null,
          yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : null,
          notes:             form.notes || null,
          applicationType:   form.applicationType || null,
          gpa:               form.gpa ? parseFloat(form.gpa) : null,
          gpaSystem:         form.gpa ? form.gpaSystem : null,
          university:        form.university || null,
          currentEmployer:   form.currentEmployer || null,
          currentTitle:      form.currentTitle || null,
          interviewScheduledAt: form.interviewScheduledAt || null,
          interviewLocation: form.interviewLocation || null,
          evaluatorIds:      selectedEvaluators.length > 0 ? selectedEvaluators : null,
        });
        const candidateId = res.data;
        if (cvFile && candidateId) {
          await api.candidates.uploadCv(candidateId, cvFile).catch(() => {});
        }
        if (form.sessionId) {
          navigate(`/sessions/${form.sessionId}`);
        } else {
          navigate('/candidates');
        }
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? label(
        isEditMode ? 'حدث خطأ أثناء التعديل' : 'حدث خطأ أثناء التسجيل',
        isEditMode ? 'Update failed' : 'Registration failed'
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <button onClick={() => navigate(-1)} style={ghostBtnStyle}>
        {label('← رجوع', '← Back')}
      </button>

      <div style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
          {isEditMode ? label('تعديل بيانات المرشح', 'Edit Candidate Info') : label('تسجيل مرشح جديد', 'Register New Candidate')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {isEditMode
            ? label('عدّل البيانات ثم احفظ التغييرات', 'Update the fields then save changes')
            : label('جميع بيانات المرشح في صفحة واحدة', 'All candidate data in one page')}
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Session + Interview (create mode only) ── */}
        {!isEditMode && <div style={cardStyle}>
          <div style={sectionHeaderStyle}>{label('الجلسة وموعد المقابلة', 'Session & Interview Schedule')}</div>
          <div style={formBodyStyle}>
            <FormField label={label('جلسة المقابلة (اختيارية)', 'Interview Session (optional)')}>
              <select value={form.sessionId} onChange={e => set('sessionId', e.target.value)} style={inputStyle}>
                <option value="">{label('اختر الجلسة...', 'Select session...')}</option>
                {sessions.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.sessionCode} — {isAr ? s.titleAr : s.titleEn}
                    {s.jobPositionAr ? ` (${isAr ? s.jobPositionAr : (s.jobPositionEn || s.jobPositionAr)})` : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <div style={rowStyle}>
              <FormField label={label('نوع الطلب', 'Application Type')}>
                <select value={form.applicationType} onChange={e => set('applicationType', e.target.value)} style={inputStyle}>
                  <option value="">{label('اختر نوع الطلب', 'Select application type')}</option>
                  {appTypes.map(t => <option key={t.ar} value={t.ar}>{isAr ? t.ar : t.en}</option>)}
                </select>
              </FormField>
              <FormField label={label('تاريخ ووقت المقابلة', 'Interview Date & Time')}>
                <input type="datetime-local" value={form.interviewScheduledAt}
                  onChange={e => set('interviewScheduledAt', e.target.value)} style={inputStyle} />
              </FormField>
            </div>

            <FormField label={label('مكان المقابلة', 'Interview Location')}>
              <input type="text" value={form.interviewLocation}
                onChange={e => set('interviewLocation', e.target.value)}
                placeholder={label('مثال: قاعة الاجتماعات أ', 'e.g. Meeting Room A')}
                style={inputStyle} />
            </FormField>
          </div>
        </div>}

        {/* ── Personal Info ── */}
        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('البيانات الشخصية', 'Personal Information')}</div>
          <div style={formBodyStyle}>
            <FormField label={label('رقم الهوية الوطنية', 'National ID')}>
              <input type="text" value={form.nationalId}
                onChange={e => set('nationalId', e.target.value)}
                placeholder="1XXXXXXXXX"
                maxLength={10}
                style={inputStyle} />
            </FormField>

            <div style={row3Style}>
              <FormField label={label('الاسم الأول *', 'First Name *')}>
                <input type="text" required value={form.firstNameAr}
                  onChange={e => set('firstNameAr', e.target.value)}
                  placeholder={label('الاسم الأول', 'First name')}
                  style={inputStyle} />
              </FormField>
              <FormField label={label('الاسم الثاني', 'Second Name')}>
                <input type="text" value={form.secondNameAr}
                  onChange={e => set('secondNameAr', e.target.value)}
                  placeholder={label('الاسم الثاني', 'Middle name')}
                  style={inputStyle} />
              </FormField>
              <FormField label={label('الاسم الأخير *', 'Last Name *')}>
                <input type="text" required value={form.lastNameAr}
                  onChange={e => set('lastNameAr', e.target.value)}
                  placeholder={label('الاسم الأخير', 'Last name')}
                  style={inputStyle} />
              </FormField>
            </div>

            <FormField label={label('الاسم بالإنجليزية', 'Full Name (English)')}>
              <input type="text" value={form.fullNameEn}
                onChange={e => set('fullNameEn', e.target.value)}
                placeholder="Full name in English"
                style={inputStyle} />
            </FormField>

            <div style={rowStyle}>
              <FormField label={label('البريد الإلكتروني', 'Email')}>
                <input type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="candidate@example.invalid"
                  style={inputStyle} />
              </FormField>
              <FormField label={label('رقم الجوال', 'Phone Number')}>
                <input type="tel" value={form.phoneNumber}
                  onChange={e => set('phoneNumber', e.target.value)}
                  placeholder="05XXXXXXXX"
                  style={inputStyle} />
              </FormField>
            </div>
          </div>
        </div>

        {/* ── Qualifications ── */}
        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('المؤهلات والتعليم', 'Qualifications & Education')}</div>
          <div style={formBodyStyle}>
            <div style={rowStyle}>
              <FormField label={label('المؤهل العلمي', 'Qualification')}>
                <select value={form.qualification} onChange={e => set('qualification', e.target.value)} style={inputStyle}>
                  <option value="">{label('اختر المؤهل', 'Select qualification')}</option>
                  {qualifications.map(q => <option key={q.ar} value={q.ar}>{isAr ? q.ar : q.en}</option>)}
                </select>
              </FormField>
              <FormField label={label('الجامعة / المؤسسة التعليمية', 'University / Institution')}>
                <input type="text" value={form.university}
                  onChange={e => set('university', e.target.value)}
                  placeholder={label('اسم الجامعة', 'University name')}
                  style={inputStyle} />
              </FormField>
            </div>

            <div style={rowStyle}>
              <FormField label={label('المعدل التراكمي (GPA)', 'GPA')}>
                <input type="number" step="0.01" min="0" max="100" value={form.gpa}
                  onChange={e => set('gpa', e.target.value)}
                  placeholder="3.75"
                  style={inputStyle} />
              </FormField>
              <FormField label={label('نظام المعدل', 'GPA System')}>
                <select value={form.gpaSystem} onChange={e => set('gpaSystem', e.target.value)} style={inputStyle}>
                  <option value="4.0">{label('من 4.0', 'Out of 4.0')}</option>
                  <option value="5.0">{label('من 5.0', 'Out of 5.0')}</option>
                  <option value="percentage">{label('نسبة مئوية (%)', 'Percentage (%)')}</option>
                </select>
              </FormField>
            </div>

            <div style={rowStyle}>
              <FormField label={label('التخصص (عربي)', 'Specialization (Arabic)')}>
                <input type="text" value={form.specializationAr}
                  onChange={e => set('specializationAr', e.target.value)}
                  placeholder={label('مثال: إدارة الأعمال', 'e.g. Business Administration')}
                  style={inputStyle} />
              </FormField>
              <FormField label={label('التخصص (إنجليزي)', 'Specialization (English)')}>
                <input type="text" value={form.specializationEn}
                  onChange={e => set('specializationEn', e.target.value)}
                  placeholder="e.g. Business Administration"
                  style={inputStyle} />
              </FormField>
            </div>
          </div>
        </div>

        {/* ── Work Experience ── */}
        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('الخبرة العملية', 'Work Experience')}</div>
          <div style={formBodyStyle}>
            <div style={rowStyle}>
              <FormField label={label('سنوات الخبرة', 'Years of Experience')}>
                <input type="number" min="0" max="50" value={form.yearsOfExperience}
                  onChange={e => set('yearsOfExperience', e.target.value)}
                  placeholder="0"
                  style={inputStyle} />
              </FormField>
              <FormField label={label('جهة العمل الحالية', 'Current Employer')}>
                <input type="text" value={form.currentEmployer}
                  onChange={e => set('currentEmployer', e.target.value)}
                  placeholder={label('اسم الجهة', 'Employer name')}
                  style={inputStyle} />
              </FormField>
            </div>
            <div style={rowStyle}>
              <FormField label={label('المسمى الوظيفي الحالي', 'Current Job Title')}>
                <input type="text" value={form.currentTitle}
                  onChange={e => set('currentTitle', e.target.value)}
                  placeholder={label('مثال: مهندس أول', 'e.g. Senior Engineer')}
                  style={inputStyle} />
              </FormField>
            </div>
            <FormField label={label('ملاحظات', 'Notes')}>
              <textarea value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder={label('أي ملاحظات إضافية', 'Any additional notes')}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>
          </div>
        </div>

        {/* ── CV Upload ── */}
        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('السيرة الذاتية', 'CV / Resume')}</div>
          <div style={formBodyStyle}>
            <FormField label={label('رفع السيرة الذاتية (PDF, DOC, DOCX)', 'Upload CV (PDF, DOC, DOCX)')}>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => {
                  setCvFile(e.target.files?.[0] ?? null);
                  setExtractedFields([]);
                  setExtractError('');
                }}
                style={{ ...inputStyle, padding: 'var(--space-2)' }}
              />
              {cvFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                    {label('الملف المختار:', 'Selected file:')} {cvFile.name} ({(cvFile.size / 1024).toFixed(0)} KB)
                  </p>
                  <button type="button" onClick={handleExtractCv} disabled={isExtracting}
                    style={{ ...primaryBtnStyle, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}>
                    {isExtracting
                      ? label('جارٍ الاستخراج بالذكاء الاصطناعي...', 'Extracting with AI...')
                      : label('🤖 تعبئة تلقائية من السيرة الذاتية', '🤖 Auto-fill from CV')}
                  </button>
                </div>
              )}
              {extractError && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-2)' }}>
                  {extractError}
                </p>
              )}
              {extractedFields.length > 0 && (
                <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'rgba(0,93,69,0.06)', borderRadius: 'var(--radius-md)', borderRight: '3px solid var(--color-primary-dark)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)', margin: 0 }}>
                    {label(
                      `🤖 تم تعبئة ${extractedFields.length} حقل تلقائيًا من السيرة الذاتية. يرجى مراجعة الحقول أعلاه وتصحيحها قبل الحفظ.`,
                      `🤖 ${extractedFields.length} field(s) were auto-filled from the CV. Please review and correct the fields above before saving.`
                    )}
                  </p>
                </div>
              )}
            </FormField>
          </div>
        </div>

        {/* ── Evaluator Assignment ── */}
        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('تحديد المقيّمين', 'Assign Evaluators')}</div>
          <div style={formBodyStyle}>
            {loadingEvaluators ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {label('جارٍ تحميل المقيّمين...', 'Loading evaluators...')}
              </p>
            ) : evaluatorsError ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                {evaluatorsError}
              </p>
            ) : availableEvaluators.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {label('لا يوجد مقيّمون متاحون حالياً', 'No evaluators available')}
              </p>
            ) : (
              <>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                  {label('اختر المقيّمين المسؤولين عن تقييم هذا المرشح', 'Select evaluators responsible for this candidate')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '240px', overflowY: 'auto' }}>
                  {availableEvaluators.map((ev: any) => (
                    <label key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                      padding: 'var(--space-3)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer',
                      background: selectedEvaluators.includes(ev.id) ? 'rgba(0,93,69,0.06)' : 'transparent',
                      borderColor: selectedEvaluators.includes(ev.id) ? 'var(--color-primary-dark)' : 'var(--color-border)',
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedEvaluators.includes(ev.id)}
                        onChange={() => toggleEvaluator(ev.id)}
                        style={{ accentColor: 'var(--color-primary-dark)', width: '16px', height: '16px' }}
                      />
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', margin: 0 }}>
                          {isAr ? ev.fullNameAr : ev.fullNameEn}
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                          {ev.email}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedEvaluators.length > 0 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-dark)', fontWeight: 'var(--font-medium)' }}>
                    {label(`تم اختيار ${selectedEvaluators.length} مقيّم`, `${selectedEvaluators.length} evaluator(s) selected`)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <button type="button" onClick={() => navigate(-1)} style={cancelBtnStyle}>
            {label('إلغاء', 'Cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} style={submitBtnStyle}>
            {isSubmitting
              ? label(isEditMode ? 'جارٍ الحفظ...' : 'جارٍ التسجيل...', isEditMode ? 'Saving...' : 'Registering...')
              : label(isEditMode ? 'حفظ التعديلات' : 'تسجيل المرشح', isEditMode ? 'Save Changes' : 'Register Candidate')}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const sectionHeaderStyle: React.CSSProperties = { padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: 'var(--color-neutral-50)' };
const formBodyStyle: React.CSSProperties = { padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' };
const row3Style: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' };
const inputStyle: React.CSSProperties = { padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-white)', fontFamily: 'inherit', outline: 'none', width: '100%' };
const ghostBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const cancelBtnStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-5)', background: 'var(--color-bg-white)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
const submitBtnStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-6)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };
const primaryBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };
