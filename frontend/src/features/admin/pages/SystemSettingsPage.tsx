import { useEffect, useState } from 'react';
import { api } from '../../../core/api/apiClient';
import type { SystemSettingDto } from '../../../shared/types';
import { useAppSelector } from '../../../app/store';

const SETTING_META: Record<string, { ar: string; en: string; hint?: string }> = {
  Threshold_NotQualified:     { ar: 'حد "غير مؤهل"',          en: 'Not Qualified Threshold',      hint: 'Scores ≤ this value → Not Qualified' },
  Threshold_Conditional:      { ar: 'حد "مؤهل"',               en: 'Qualified Threshold',           hint: 'Scores 18–this value → Qualified (18–23 = Qualified, 24–30 = Recommended)' },
  Threshold_Discrepancy:      { ar: 'حد التباين',               en: 'Discrepancy Threshold',         hint: 'Variance above this triggers an alert' },
  MaxEvaluatorsPerCandidate:  { ar: 'أقصى عدد مقيّمين',         en: 'Max Evaluators / Candidate',    hint: 'Maximum evaluators assignable per session' },
  AllowEditAfterSubmit:       { ar: 'السماح بالتعديل بعد الإرسال', en: 'Allow Edit After Submit',    hint: 'true / false' },
  SessionDefaultStatus:       { ar: 'حالة الجلسة الافتراضية',   en: 'Default Session Status',        hint: 'Active or Draft' },
};

export default function SystemSettingsPage() {
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  const [settings, setSettings] = useState<SystemSettingDto[]>([]);
  const [editing,  setEditing]  = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [success,  setSuccess]  = useState<Record<string, boolean>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [fixing,   setFixing]   = useState(false);
  const [fixResult, setFixResult] = useState<{ statusFixed: number; decisionCleared: number } | null>(null);

  useEffect(() => {
    api.admin.settings()
      .then(res => { setSettings(res.data); setLoading(false); })
      .catch(() => { setError(label('تعذّر تحميل الإعدادات', 'Failed to load settings')); setLoading(false); });
  }, []);

  const handleEdit = (key: string, value: string) =>
    setEditing(prev => ({ ...prev, [key]: value }));

  const handleSave = async (key: string) => {
    const value = editing[key];
    if (value === undefined) return;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await api.admin.updateSetting(key, value);
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
      setSuccess(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setSuccess(prev => ({ ...prev, [key]: false })), 2000);
      setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
    } catch {
      setError(label('فشل الحفظ — تأكد من الصلاحيات', 'Save failed — check permissions'));
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>{label('جارٍ التحميل...', 'Loading...')}</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)' }}>
          {label('إعدادات النظام', 'System Settings')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label(
            'التغييرات هنا تؤثر فورًا على منطق الحسابات والقرارات',
            'Changes here take immediate effect on scoring logic and decision thresholds',
          )}
        </p>
      </div>

      {error && (
        <div style={{ background: '#FFF3F3', border: '1px solid var(--color-not-qualified)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', color: 'var(--color-not-qualified)', fontSize: 'var(--text-sm)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {settings.map(setting => {
          const meta   = SETTING_META[setting.key];
          const val    = editing[setting.key] ?? setting.value;
          const isDirty= editing[setting.key] !== undefined && editing[setting.key] !== setting.value;
          return (
            <div key={setting.key} style={{
              background: 'var(--color-bg-white)',
              border:     '1px solid var(--color-border)',
              borderRadius:'var(--radius-md)',
              padding:    'var(--space-5)',
              display:    'flex',
              alignItems: 'center',
              gap:        'var(--space-6)',
              flexWrap:   'wrap',
            }}>
              {/* Label */}
              <div style={{ flex: '1', minWidth: '240px' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                  {meta ? (isAr ? meta.ar : meta.en) : setting.key}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  {setting.key}
                </div>
                {meta?.hint && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                    {meta.hint}
                  </div>
                )}
                {(setting.descriptionAr || setting.description) && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                    {isAr ? setting.descriptionAr : setting.description}
                  </div>
                )}
              </div>

              {/* Input + Save */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={val}
                    onChange={e => handleEdit(setting.key, e.target.value)}
                    style={{
                      border:       `1px solid ${isDirty ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding:      'var(--space-2) var(--space-3)',
                      fontSize:     'var(--text-sm)',
                      fontFamily:   'monospace',
                      width:        '160px',
                      outline:      'none',
                      background:   isDirty ? '#FFFEF7' : 'var(--color-bg-white)',
                      color:        'var(--color-text-primary)',
                    }}
                  />
                </div>
                <button
                  onClick={() => handleSave(setting.key)}
                  disabled={!isDirty || saving[setting.key]}
                  style={{
                    padding:      'var(--space-2) var(--space-4)',
                    background:   isDirty ? 'var(--color-primary-dark)' : 'var(--color-neutral-100)',
                    color:        isDirty ? '#fff' : 'var(--color-text-muted)',
                    border:       'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor:       isDirty ? 'pointer' : 'not-allowed',
                    fontSize:     'var(--text-sm)',
                    fontWeight:   'var(--font-medium)',
                    minWidth:     '80px',
                    transition:   'all var(--transition-fast)',
                  }}
                >
                  {saving[setting.key]
                    ? label('جارٍ...', 'Saving...')
                    : success[setting.key]
                    ? label('✓ تم', '✓ Saved')
                    : label('حفظ', 'Save')}
                </button>
                {isDirty && (
                  <button
                    onClick={() => setEditing(prev => { const n = { ...prev }; delete n[setting.key]; return n; })}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                  >
                    {label('إلغاء', 'Cancel')}
                  </button>
                )}
              </div>

              {/* Data type badge */}
              <span style={{
                fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
                padding: '2px 8px', background: 'var(--color-neutral-100)',
                borderRadius: 'var(--radius-full)', fontFamily: 'monospace',
              }}>
                {setting.dataType}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 'var(--space-6)', padding: 'var(--space-4)',
        background: 'rgba(0,93,69,0.04)', border: '1px solid rgba(0,93,69,0.15)',
        borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
      }}>
        {label(
          '⚠ تحذير: تغيير العتبات يؤثر على حسابات الدرجات الجديدة فقط — التقييمات السابقة المُرسَلة لن تُعاد حسبتها تلقائيًا.',
          '⚠ Warning: Changing thresholds affects new score calculations only — previously submitted evaluations are not retroactively recalculated.',
        )}
      </div>

      {/* ── Data Maintenance ─────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-4)', color: 'var(--color-text-primary)' }}>
          {label('صيانة البيانات', 'Data Maintenance')}
        </h3>
        <div style={{
          background: 'var(--color-bg-white)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-5)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
              {label('تصحيح حالات المتقدمين', 'Fix Applicant Statuses')}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {label(
                'يُصحّح حالة كل متقدم بناءً على المنطق الجديد: متقدم / مرشح للمقابلة / تمت المقابلة، ويزيل القرارات النهائية غير الصادرة من المدير.',
                'Retroactively applies new status logic and clears auto-set final decisions.',
              )}
            </div>
            {fixResult && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-recommended)', fontWeight: 'var(--font-medium)' }}>
                {label(
                  `✓ تم تصحيح ${fixResult.statusFixed} حالة، وحذف ${fixResult.decisionCleared} قرار تلقائي`,
                  `✓ Fixed ${fixResult.statusFixed} statuses, cleared ${fixResult.decisionCleared} auto-set decisions`,
                )}
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              if (!confirm(label('هل أنت متأكد؟ سيتم تحديث حالات جميع المتقدمين.', 'Are you sure? All applicant statuses will be updated.'))) return;
              setFixing(true);
              setFixResult(null);
              try {
                const res = await api.admin.fixCandidateStatuses();
                setFixResult(res.data as { statusFixed: number; decisionCleared: number });
              } catch {
                setError(label('فشل تصحيح البيانات', 'Failed to fix data'));
              } finally {
                setFixing(false);
              }
            }}
            disabled={fixing}
            style={{
              padding: 'var(--space-2) var(--space-5)',
              background: fixing ? 'var(--color-neutral-100)' : 'var(--color-primary-dark)',
              color: fixing ? 'var(--color-text-muted)' : '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: fixing ? 'not-allowed' : 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)',
              whiteSpace: 'nowrap',
            }}
          >
            {fixing ? label('جارٍ التصحيح...', 'Fixing...') : label('تصحيح الآن', 'Fix Now')}
          </button>
        </div>
      </div>
    </div>
  );
}
