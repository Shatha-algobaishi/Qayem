import { useEffect, useState } from 'react';
import { api } from '../../../core/api/apiClient';
import type { Question } from '../../../shared/types';
import { useAppSelector } from '../../../app/store';

interface QuestionForm {
  textAr:    string;
  textEn:    string;
  category:  string;
  maxScore:  number;
  orderIndex:number;
}

const emptyForm = (): QuestionForm => ({ textAr: '', textEn: '', category: '', maxScore: 5, orderIndex: 1 });

export default function QuestionsManagementPage() {
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState<QuestionForm>(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [reordering,setReordering]= useState(false);

  const load = () => {
    setLoading(true);
    api.admin.questions()
      .then(res => { setQuestions(res.data); setLoading(false); })
      .catch(() => { setError(label('تعذّر التحميل', 'Failed to load')); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditId(null);
    const nextOrder = Math.max(0, ...questions.map(q => q.orderIndex)) + 1;
    setForm({ ...emptyForm(), orderIndex: nextOrder });
    setShowForm(true);
  };

  const openEdit = (q: Question) => {
    setEditId(q.id);
    setForm({ textAr: q.textAr, textEn: q.textEn, category: q.category ?? '', maxScore: q.maxScore, orderIndex: q.orderIndex });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.textAr.trim() || !form.textEn.trim()) {
      setError(label('النص العربي والإنجليزي مطلوبان', 'Arabic and English text are required'));
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.admin.updateQuestion(editId, { textAr: form.textAr, textEn: form.textEn, category: form.category || null, maxScore: form.maxScore });
      } else {
        await api.admin.createQuestion({ textAr: form.textAr, textEn: form.textEn, orderIndex: form.orderIndex, category: form.category || null, maxScore: form.maxScore });
      }
      setShowForm(false);
      setEditId(null);
      setError(null);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? label('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (q: Question) => {
    try {
      if (q.isActive) {
        await api.admin.deactivateQuestion(q.id);
      } else {
        await api.admin.activateQuestion(q.id);
      }
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? label('فشل التحديث', 'Update failed'));
    }
  };

  const handleDelete = async (q: Question) => {
    if (!window.confirm(label(`هل تريد حذف السؤال: ${q.textAr}؟`, `Delete question: ${q.textEn}?`))) return;
    try {
      await api.admin.deleteQuestion(q.id);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? label('فشل الحذف', 'Delete failed'));
    }
  };

  const moveQuestion = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx    = sorted.findIndex(q => q.id === id);
    if (direction === 'up'   && idx === 0)                 return;
    if (direction === 'down' && idx === sorted.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const items   = sorted.map((q, i) => {
      if (i === idx)     return { id: q.id, orderIndex: sorted[swapIdx].orderIndex };
      if (i === swapIdx) return { id: q.id, orderIndex: sorted[idx].orderIndex };
      return { id: q.id, orderIndex: q.orderIndex };
    });

    setReordering(true);
    try {
      await api.admin.reorderQuestions(items);
      load();
    } finally {
      setReordering(false);
    }
  };

  const totalMaxScore = questions.filter(q => q.isActive).reduce((s, q) => s + q.maxScore, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', margin: 0 }}>
            {label('إدارة أسئلة التقييم', 'Evaluation Questions')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {label(
              `${questions.filter(q => q.isActive).length} سؤال نشط — الدرجة الكلية: ${totalMaxScore} نقطة`,
              `${questions.filter(q => q.isActive).length} active questions — total max score: ${totalMaxScore} pts`,
            )}
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: 'var(--space-2) var(--space-5)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
          {label('+ إضافة سؤال', '+ Add Question')}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FFF3F3', border: '1px solid var(--color-not-qualified)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)', color: 'var(--color-not-qualified)', fontSize: 'var(--text-sm)', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-5)', color: 'var(--color-primary-dark)' }}>
            {editId ? label('تعديل السؤال', 'Edit Question') : label('إضافة سؤال جديد', 'Add New Question')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {[
              { field: 'textAr', labelAr: 'النص بالعربية *', labelEn: 'Arabic Text *', dir: 'rtl' as const },
              { field: 'textEn', labelAr: 'النص بالإنجليزية *', labelEn: 'English Text *', dir: 'ltr' as const },
            ].map(({ field, labelAr, labelEn, dir }) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  {isAr ? labelAr : labelEn}
                </label>
                <input
                  type="text" dir={dir}
                  value={(form as unknown as Record<string,string>)[field]}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box', background: 'var(--color-bg-white)', color: 'var(--color-text-primary)' }}
                />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                {label('الفئة (اختياري)', 'Category (optional)')}
              </label>
              <input
                type="text" value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box', background: 'var(--color-bg-white)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  {label('الدرجة القصوى *', 'Max Score *')}
                </label>
                <input
                  type="number" min={1} max={10} value={form.maxScore}
                  onChange={e => setForm(p => ({ ...p, maxScore: Number(e.target.value) }))}
                  style={{ width: '80px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none' }}
                />
              </div>
              {!editId && (
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    {label('الترتيب *', 'Order *')}
                  </label>
                  <input
                    type="number" min={1} value={form.orderIndex}
                    onChange={e => setForm(p => ({ ...p, orderIndex: Number(e.target.value) }))}
                    style={{ width: '80px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', outline: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ padding: 'var(--space-2) var(--space-5)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
              {saving ? label('جارٍ الحفظ...', 'Saving...') : label('حفظ', 'Save')}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setError(null); }} style={{ padding: 'var(--space-2) var(--space-5)', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              {label('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
              {[label('ترتيب', 'Order'), label('السؤال', 'Question'), label('الفئة', 'Category'), label('الدرجة', 'Max'), label('الحالة', 'Status'), label('الإجراءات', 'Actions')].map((h, i) => (
                <th key={i} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{label('جارٍ التحميل...', 'Loading...')}</td></tr>
            ) : (
              [...questions].sort((a, b) => a.orderIndex - b.orderIndex).map((q, i, arr) => (
                <tr key={q.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none', background: q.isActive ? (i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)') : 'rgba(0,0,0,0.02)', opacity: q.isActive ? 1 : 0.6 }}>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <button onClick={() => moveQuestion(q.id, 'up')} disabled={reordering} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--color-text-muted)', padding: 0 }}>▲</button>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>{q.orderIndex}</span>
                      <button onClick={() => moveQuestion(q.id, 'down')} disabled={reordering} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--color-text-muted)', padding: 0 }}>▼</button>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }} dir="rtl">{q.textAr}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{q.textEn}</div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{q.category ?? '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', textAlign: 'center', fontWeight: 'var(--font-semibold)', color: 'var(--color-primary-dark)' }}>{q.maxScore}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: q.isActive ? 'rgba(70,199,82,0.12)' : 'var(--color-neutral-100)', color: q.isActive ? 'var(--color-recommended)' : 'var(--color-text-muted)', fontWeight: 'var(--font-medium)' }}>
                      {q.isActive ? label('نشط', 'Active') : label('معطّل', 'Inactive')}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button onClick={() => openEdit(q)} style={{ padding: 'var(--space-1) var(--space-2)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>{label('تعديل', 'Edit')}</button>
                      <button onClick={() => handleToggleActive(q)} style={{ padding: 'var(--space-1) var(--space-2)', background: 'transparent', color: q.isActive ? 'var(--color-conditional)' : 'var(--color-recommended)', border: `1px solid ${q.isActive ? 'var(--color-conditional)' : 'var(--color-recommended)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>
                        {q.isActive ? label('تعطيل', 'Deactivate') : label('تفعيل', 'Activate')}
                      </button>
                      <button onClick={() => handleDelete(q)} style={{ padding: 'var(--space-1) var(--space-2)', background: 'transparent', color: 'var(--color-not-qualified)', border: '1px solid var(--color-not-qualified)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>{label('حذف', 'Delete')}</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!loading && questions.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{label('لا توجد أسئلة بعد', 'No questions yet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'end' }}>
        {label(`مجموع الدرجات القصوى: ${totalMaxScore} نقطة`, `Total max score (active): ${totalMaxScore} pts`)}
      </div>
    </div>
  );
}
