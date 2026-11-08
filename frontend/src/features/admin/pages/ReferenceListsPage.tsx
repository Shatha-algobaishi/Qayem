import { useEffect, useState } from 'react';
import { api } from '../../../core/api/apiClient';
import { useAppSelector } from '../../../app/store';

interface RefItem {
  id: string;
  valueAr: string;
  valueEn: string;
  orderIndex: number;
  isActive: boolean;
}

interface RefList {
  id: string;
  listName: string;
  labelAr: string;
  labelEn: string;
  items: RefItem[];
}

const LIST_META: Record<string, { icon: string }> = {
  Departments:      { icon: '🏢' },
  ApplicationTypes: { icon: '📋' },
  Qualifications:   { icon: '🎓' },
};

export default function ReferenceListsPage() {
  const locale = useAppSelector(s => s.ui.locale);
  const isAr   = locale === 'ar';
  const label  = (ar: string, en: string) => isAr ? ar : en;

  const [lists, setLists]           = useState<RefList[]>([]);
  const [selected, setSelected]     = useState<string | null>(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState('');

  // New item form
  const [newAr, setNewAr]           = useState('');
  const [newEn, setNewEn]           = useState('');
  const [adding, setAdding]         = useState(false);

  // Edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editAr, setEditAr]         = useState('');
  const [editEn, setEditEn]         = useState('');
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setIsLoading(true);
    api.admin.referenceLists()
      .then(res => {
        setLists(res.data ?? []);
        if (!selected && res.data?.length > 0) setSelected(res.data[0].listName);
      })
      .catch(() => setError(label('تعذّر تحميل البيانات', 'Failed to load reference lists')))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const activeList = lists.find(l => l.listName === selected);

  const handleAdd = async () => {
    if (!selected || !newAr.trim()) return;
    setAdding(true);
    try {
      await api.admin.addRefListItem(selected, { valueAr: newAr.trim(), valueEn: newEn.trim() || newAr.trim() });
      setNewAr('');
      setNewEn('');
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? label('فشل الإضافة', 'Add failed'));
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    setSaving(true);
    try {
      await api.admin.updateRefListItem(itemId, { valueAr: editAr.trim(), valueEn: editEn.trim() || editAr.trim() });
      setEditingId(null);
      load();
    } catch {
      setError(label('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm(label('هل أنت متأكد من حذف هذا العنصر؟', 'Delete this item?'))) return;
    try {
      await api.admin.deleteRefListItem(itemId);
      load();
    } catch {
      setError(label('فشل الحذف', 'Delete failed'));
    }
  };

  if (isLoading) return (
    <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      {label('جارٍ التحميل...', 'Loading...')}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)' }}>
          {label('إدارة قوائم الاختيار', 'Reference List Management')}
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {label('إدارة القوائم المنسدلة المستخدمة في النظام (أقسام، أنواع طلبات، مؤهلات)', 'Manage dropdown lists used across the system (departments, application types, qualifications)')}
        </p>
      </div>

      {error && (
        <div style={{ background: '#FFF3F3', border: '1px solid var(--color-not-qualified)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)', color: 'var(--color-not-qualified)', fontSize: 'var(--text-sm)', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'var(--text-base)' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-5)' }}>
        {/* List selector */}
        <div style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--color-neutral-50)' }}>
            {label('القوائم', 'Lists')}
          </div>
          {lists.map(list => (
            <button
              key={list.listName}
              onClick={() => setSelected(list.listName)}
              style={{
                width:          '100%',
                padding:        'var(--space-3) var(--space-4)',
                textAlign:      'start',
                background:     selected === list.listName ? 'rgba(0,93,69,0.08)' : 'transparent',
                border:         'none',
                borderBottom:   '1px solid var(--color-border)',
                cursor:         'pointer',
                fontSize:       'var(--text-sm)',
                color:          selected === list.listName ? 'var(--color-primary-dark)' : 'var(--color-text-primary)',
                fontWeight:     selected === list.listName ? 'var(--font-medium)' : 'var(--font-regular)',
                display:        'flex',
                alignItems:     'center',
                gap:            'var(--space-2)',
                transition:     'all var(--transition-fast)',
              }}
            >
              <span>{LIST_META[list.listName]?.icon ?? '📌'}</span>
              <span>{isAr ? list.labelAr : list.labelEn}</span>
              <span style={{ marginInlineStart: 'auto', fontSize: 'var(--text-xs)', background: 'var(--color-neutral-100)', borderRadius: 'var(--radius-full)', padding: '1px 8px', color: 'var(--color-text-muted)' }}>
                {list.items.length}
              </span>
            </button>
          ))}
        </div>

        {/* Items panel */}
        <div>
          {activeList ? (
            <div style={{ background: 'var(--color-bg-white)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-neutral-50)' }}>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-regular)' }}>
                  {isAr ? activeList.labelAr : activeList.labelEn}
                </h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {activeList.items.length} {label('عنصر', 'items')}
                </span>
              </div>

              {/* Items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-neutral-50)', borderBottom: '1px solid var(--color-border)' }}>
                    {[label('القيمة (عربي)', 'Value (Arabic)'), label('القيمة (إنجليزي)', 'Value (English)'), label('الترتيب', 'Order'), ''].map((h, i) => (
                      <th key={i} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeList.items.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {editingId === item.id ? (
                          <input value={editAr} onChange={e => setEditAr(e.target.value)}
                            style={inlineInputStyle} autoFocus />
                        ) : (
                          <span style={{ fontSize: 'var(--text-sm)' }}>{item.valueAr}</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {editingId === item.id ? (
                          <input value={editEn} onChange={e => setEditEn(e.target.value)}
                            style={inlineInputStyle} />
                        ) : (
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{item.valueEn}</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                        {item.orderIndex}
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                          {editingId === item.id ? (
                            <>
                              <button onClick={() => handleSaveEdit(item.id)} disabled={saving}
                                style={saveBtnStyle}>
                                {saving ? '...' : label('حفظ', 'Save')}
                              </button>
                              <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>
                                {label('إلغاء', 'Cancel')}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingId(item.id); setEditAr(item.valueAr); setEditEn(item.valueEn); }}
                                style={editBtnStyle}>
                                {label('تعديل', 'Edit')}
                              </button>
                              <button onClick={() => handleDelete(item.id)} style={deleteBtnStyle}>
                                {label('حذف', 'Delete')}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeList.items.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                        {label('لا توجد عناصر. أضف عنصرًا أدناه.', 'No items. Add one below.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Add new item */}
              <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', background: 'rgba(0,93,69,0.02)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newAr}
                  onChange={e => setNewAr(e.target.value)}
                  placeholder={label('القيمة بالعربية *', 'Arabic value *')}
                  style={{ ...inlineInputStyle, flex: '1', minWidth: '160px' }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <input
                  type="text"
                  value={newEn}
                  onChange={e => setNewEn(e.target.value)}
                  placeholder={label('القيمة بالإنجليزية', 'English value')}
                  style={{ ...inlineInputStyle, flex: '1', minWidth: '160px' }}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} disabled={adding || !newAr.trim()} style={saveBtnStyle}>
                  {adding ? label('جارٍ...', 'Adding...') : label('+ إضافة', '+ Add')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {label('اختر قائمة من اليسار', 'Select a list from the sidebar')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inlineInputStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontFamily: 'inherit', outline: 'none', background: 'var(--color-bg-white)', color: 'var(--color-text-primary)' };
const saveBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', whiteSpace: 'nowrap' };
const cancelBtnStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
const editBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const deleteBtnStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
