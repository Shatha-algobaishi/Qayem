import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';

const DEPARTMENTS_FALLBACK: { ar: string; en: string }[] = [
  { ar: 'تقنية المعلومات', en: 'Information Technology' },
  { ar: 'الموارد البشرية', en: 'Human Resources' },
  { ar: 'الشؤون المالية', en: 'Financial Affairs' },
  { ar: 'العمليات', en: 'Operations' },
  { ar: 'التدريب', en: 'Training' },
  { ar: 'الجودة', en: 'Quality Assurance' },
  { ar: 'التخطيط والتطوير', en: 'Planning & Development' },
  { ar: 'الشؤون القانونية', en: 'Legal Affairs' },
  { ar: 'العلاقات العامة', en: 'Public Relations' },
  { ar: 'الرقابة والتدقيق', en: 'Audit & Control' },
];

const GENERAL_DEPARTMENTS_FALLBACK: { ar: string; en: string }[] = [
  { ar: 'الإدارة العامة للموارد البشرية', en: 'General Directorate of Human Resources' },
  { ar: 'الإدارة العامة للعمليات', en: 'General Directorate of Operations' },
  { ar: 'الإدارة العامة للتدريب', en: 'General Directorate of Training' },
  { ar: 'الإدارة العامة للجودة', en: 'General Directorate of Quality' },
  { ar: 'الإدارة العامة لتقنية المعلومات', en: 'General Directorate of IT' },
  { ar: 'الإدارة العامة للشؤون المالية', en: 'General Directorate of Financial Affairs' },
];

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const locale   = useAppSelector(s => s.ui.locale);
  const isAr     = locale === 'ar';
  const label    = (ar: string, en: string) => isAr ? ar : en;

  const [departments, setDepartments]           = useState<{ ar: string; en: string }[]>(DEPARTMENTS_FALLBACK);
  const [generalDepartments, setGeneralDepts]   = useState<{ ar: string; en: string }[]>(GENERAL_DEPARTMENTS_FALLBACK);
  const [agencies, setAgencies]                 = useState<{ ar: string; en: string }[]>([]);

  useEffect(() => {
    api.admin.getReferenceList('Departments')
      .then(res => {
        const items = res.data.items ?? [];
        if (items.length > 0) setDepartments(items.map((i: any) => ({ ar: i.valueAr, en: i.valueEn || i.valueAr })));
      })
      .catch(() => {});

    api.admin.getReferenceList('GeneralDepartments')
      .then(res => {
        const items = res.data.items ?? [];
        if (items.length > 0) setGeneralDepts(items.map((i: any) => ({ ar: i.valueAr, en: i.valueEn || i.valueAr })));
      })
      .catch(() => {});

    api.admin.getReferenceList('Agencies')
      .then(res => {
        const items = res.data.items ?? [];
        setAgencies(items.map((i: any) => ({ ar: i.valueAr, en: i.valueEn || i.valueAr })));
      })
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    titleAr:           '',
    titleEn:           '',
    jobPositionAr:     '',
    jobPositionEn:     '',
    department:        '',
    generalDepartment: '',
    agency:            '',
    notes:             '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState('');

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.jobPositionAr) {
      setError(label('يرجى تحديد الشاغر المستهدف', 'Please fill in the job position'));
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await api.sessions.create({
        titleAr:           form.titleAr || null,
        titleEn:           form.titleEn || null,
        jobPositionAr:     form.jobPositionAr,
        jobPositionEn:     form.jobPositionEn || form.jobPositionAr,
        department:        form.department,
        generalDepartment: form.generalDepartment || null,
        agency:            form.agency || null,
        scheduledDate:     null,
        location:          null,
        notes:             form.notes || null,
      });
      navigate('/sessions');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? label('حدث خطأ أثناء الإنشاء', 'Failed to create session'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px' }}>
      <button onClick={() => navigate('/sessions')} style={ghostBtnStyle}>
        {label('← العودة للقائمة', '← Back to sessions')}
      </button>

      <div style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
          {label('جلسة مقابلة جديدة', 'New Interview Session')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label('أدخل تفاصيل الجلسة أدناه — تاريخ المقابلة يُحدَّد عند تسجيل كل مرشح', 'Enter session details — interview date is set per candidate')}
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>{label('الشاغر الوظيفي', 'Job Position')}</div>
          <div style={formBodyStyle}>

            <div style={rowStyle}>
              <FormField label={label('الشاغر المستهدف (عربي) *', 'Target Position (Arabic) *')}>
                <input type="text" required value={form.jobPositionAr}
                  onChange={e => set('jobPositionAr', e.target.value)}
                  placeholder={label('مثال: محلل عمليات', 'e.g. Operations Analyst')}
                  style={inputStyle} />
              </FormField>
              <FormField label={label('الشاغر المستهدف (إنجليزي)', 'Target Position (English)')}>
                <input type="text" value={form.jobPositionEn}
                  onChange={e => set('jobPositionEn', e.target.value)}
                  placeholder="e.g. Operations Analyst"
                  style={inputStyle} />
              </FormField>
            </div>

            <div style={rowStyle}>
              <FormField label={label('عنوان الجلسة (عربي)', 'Session Title (Arabic)')}>
                <input type="text" value={form.titleAr}
                  onChange={e => set('titleAr', e.target.value)}
                  placeholder={label('يُولَّد تلقائياً إن تُرك فارغاً', 'Auto-generated if left blank')}
                  style={inputStyle} />
              </FormField>
              <FormField label={label('عنوان الجلسة (إنجليزي)', 'Session Title (English)')}>
                <input type="text" value={form.titleEn}
                  onChange={e => set('titleEn', e.target.value)}
                  placeholder="Auto-generated if left blank"
                  style={inputStyle} />
              </FormField>
            </div>

          </div>
        </div>

        <div style={{ ...cardStyle, marginTop: 'var(--space-4)' }}>
          <div style={sectionHeaderStyle}>{label('الجهة التنظيمية', 'Organizational Unit')}</div>
          <div style={formBodyStyle}>

            <div style={rowStyle}>
              <FormField label={label('الوكالة', 'Agency')}>
                {agencies.length > 0
                  ? (
                    <select value={form.agency} onChange={e => set('agency', e.target.value)} style={inputStyle}>
                      <option value="">{label('اختر الوكالة', 'Select agency')}</option>
                      {agencies.map(a => <option key={a.ar} value={a.ar}>{isAr ? a.ar : a.en}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.agency}
                      onChange={e => set('agency', e.target.value)}
                      placeholder={label('مثال: إدارة العمليات', 'e.g. Operations Division')}
                      style={inputStyle} />
                  )
                }
              </FormField>
              <FormField label={label('الإدارة العامة', 'General Department')}>
                {generalDepartments.length > 0
                  ? (
                    <select value={form.generalDepartment} onChange={e => set('generalDepartment', e.target.value)} style={inputStyle}>
                      <option value="">{label('اختر الإدارة العامة', 'Select general department')}</option>
                      {generalDepartments.map(d => <option key={d.ar} value={d.ar}>{isAr ? d.ar : d.en}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.generalDepartment}
                      onChange={e => set('generalDepartment', e.target.value)}
                      placeholder={label('مثال: الإدارة العامة للموارد البشرية', 'e.g. General HR Department')}
                      style={inputStyle} />
                  )
                }
              </FormField>
            </div>

            <FormField label={label('الإدارة', 'Department')}>
              <select value={form.department}
                onChange={e => set('department', e.target.value)}
                style={inputStyle}>
                <option value="">{label('اختر الإدارة', 'Select department')}</option>
                {departments.map(d => <option key={d.ar} value={d.ar}>{isAr ? d.ar : d.en}</option>)}
              </select>
            </FormField>

            <FormField label={label('ملاحظات', 'Notes')}>
              <textarea value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder={label('أي تفاصيل إضافية حول الجلسة', 'Any additional details about the session')}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <button type="button" onClick={() => navigate('/sessions')} style={cancelBtnStyle}>
            {label('إلغاء', 'Cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} style={submitBtnStyle}>
            {isSubmitting ? label('جارٍ الإنشاء...', 'Creating...') : label('إنشاء الجلسة', 'Create Session')}
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

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-white)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-sm)',
};
const sectionHeaderStyle: React.CSSProperties = {
  padding: 'var(--space-4) var(--space-6)',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-semibold)',
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  background: 'var(--color-neutral-50)',
};
const formBodyStyle: React.CSSProperties = {
  padding: 'var(--space-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
};
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-4)',
};
const inputStyle: React.CSSProperties = {
  padding: 'var(--space-3)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-white)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
};
const ghostBtnStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-3)',
  background: 'transparent',
  color: 'var(--color-primary-dark)',
  border: '1px solid var(--color-primary-dark)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 'var(--text-xs)',
};
const cancelBtnStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-5)',
  background: 'var(--color-bg-white)',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
};
const submitBtnStyle: React.CSSProperties = {
  padding: 'var(--space-3) var(--space-6)',
  background: 'var(--color-primary-dark)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--text-sm)',
  fontWeight: 'var(--font-light)',
};
