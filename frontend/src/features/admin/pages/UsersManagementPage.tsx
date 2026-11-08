import { useEffect, useState, type FormEvent } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useAppSelector } from '../../../app/store';
import { api } from '../../../core/api/apiClient';

interface UserRow {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
  email: string;
  username: string;
  roleName: string;
  roleNameAr: string;
  department?: string;
  jobTitle?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

interface RoleOption { id: string; name: string; nameAr: string; }

type EditState = {
  userId: string;
  displayName: string;
  email: string;
  username: string;
  originalPrimaryRoleId: string;
  originalAdditionalRoleIds: string[];
};

export default function UsersManagementPage() {
  const locale  = useAppSelector(s => s.ui.locale);
  const isAr    = locale === 'ar';
  const label   = (ar: string, en: string) => isAr ? ar : en;

  const [users, setUsers]           = useState<UserRow[]>([]);
  const [roles, setRoles]           = useState<RoleOption[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch]         = useState('');
  const [isLoading, setIsLoading]   = useState(true);

  // ── Create modal ────────────────────────────────────────────
  const [showModal, setShowModal]         = useState(false);
  const [form, setForm]                   = useState({ fullNameAr: '', fullNameEn: '', email: '', username: '', password: '', department: '', jobTitle: '' });
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting]       = useState(false);
  const [formError, setFormError]         = useState('');

  // ── Edit modal ───────────────────────────────────────────────
  const [editState, setEditState]         = useState<EditState | null>(null);
  const [editForm, setEditForm]           = useState({ fullNameAr: '', fullNameEn: '', email: '', username: '', department: '', jobTitle: '' });
  const [editRoleIds, setEditRoleIds]     = useState<string[]>([]);
  const [editLoading, setEditLoading]     = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]         = useState('');

  // ── Reset password modal ─────────────────────────────────────
  const [resetModal, setResetModal]   = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError]   = useState('');
  const [resetting, setResetting]     = useState(false);

  const loadUsers = () => {
    setIsLoading(true);
    api.users.list({ search: search || undefined, page, pageSize: 20 })
      .then(res => {
        setUsers(res.data.items ?? []);
        setTotal(res.data.totalCount ?? 0);
        setTotalPages(res.data.totalPages ?? 1);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { loadUsers(); }, [page, search]);

  useEffect(() => {
    api.users.roles()
      .then(r => setRoles(r.data ?? []))
      .catch(() => {});
  }, []);

  // ── Activate / Deactivate / Delete ───────────────────────────
  const handleActivate   = async (id: string) => { await api.users.activate(id); loadUsers(); };
  const handleDeactivate = async (id: string) => {
    if (!window.confirm(label('تأكيد تعطيل الحساب؟', 'Confirm deactivate?'))) return;
    await api.users.deactivate(id); loadUsers();
  };
  const handleSoftDelete = async (id: string, name: string) => {
    if (!window.confirm(label(`تأكيد حذف المستخدم "${name}"؟`, `Delete user "${name}"?`))) return;
    try { await api.users.softDelete(id); loadUsers(); }
    catch { alert(label('فشل الحذف', 'Delete failed')); }
  };

  // ── Reset password ────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetModal || newPassword.length < 8) {
      setResetError(label('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'Password must be at least 8 characters'));
      return;
    }
    setResetting(true); setResetError('');
    try {
      await api.users.resetPassword(resetModal.userId, newPassword);
      setResetModal(null); setNewPassword('');
    } catch (e: any) {
      setResetError(e?.response?.data?.message ?? label('فشل تغيير كلمة المرور', 'Reset failed'));
    } finally { setResetting(false); }
  };

  // ── Create user ───────────────────────────────────────────────
  const toggleRole = (roleId: string) =>
    setSelectedRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullNameAr || !form.email || !form.username || !form.password || selectedRoleIds.length === 0) {
      setFormError(label('يرجى ملء جميع الحقول المطلوبة واختيار دور واحد على الأقل', 'Please fill all required fields and select at least one role'));
      return;
    }
    setSubmitting(true); setFormError('');
    try {
      const primaryRoleId = selectedRoleIds[0];
      const res = await api.users.create({ ...form, roleId: primaryRoleId, department: form.department || null, jobTitle: form.jobTitle || null });
      const newUserId: string = res.data;
      for (const rid of selectedRoleIds.slice(1)) await api.users.addRole(newUserId, rid);
      setShowModal(false);
      setForm({ fullNameAr: '', fullNameEn: '', email: '', username: '', password: '', department: '', jobTitle: '' });
      setSelectedRoleIds([]);
      loadUsers();
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? label('حدث خطأ', 'An error occurred'));
    } finally { setSubmitting(false); }
  };

  // ── Edit user ─────────────────────────────────────────────────
  const toggleEditRole = (roleId: string) =>
    setEditRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);

  const handleEditOpen = async (userId: string) => {
    setEditLoading(true);
    setEditError('');
    try {
      const res = await api.users.get(userId);
      const u   = res.data as any;
      const primaryRole   = roles.find(r => r.name === u.roleName);
      const primaryRoleId = primaryRole?.id ?? '';
      const additionalRoleIds: string[] = (u.additionalRoles ?? []).map((r: any) => r.roleId);

      setEditForm({
        fullNameAr: u.fullNameAr ?? '',
        fullNameEn: u.fullNameEn ?? '',
        email:      u.email ?? '',
        username:   u.username ?? '',
        department: u.department ?? '',
        jobTitle:   u.jobTitle ?? '',
      });
      setEditRoleIds([primaryRoleId, ...additionalRoleIds].filter(Boolean));
      setEditState({
        userId,
        displayName:             isAr ? u.fullNameAr : u.fullNameEn,
        email:                   u.email,
        username:                u.username,
        originalPrimaryRoleId:   primaryRoleId,
        originalAdditionalRoleIds: additionalRoleIds,
      });
    } catch {
      alert(label('فشل تحميل بيانات المستخدم', 'Failed to load user data'));
    } finally { setEditLoading(false); }
  };

  const handleEditSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editState || editRoleIds.length === 0) {
      setEditError(label('يجب اختيار دور واحد على الأقل', 'At least one role is required'));
      return;
    }
    setEditSubmitting(true); setEditError('');

    const newPrimaryRoleId    = editRoleIds[0];
    const newAdditionalIds    = editRoleIds.slice(1);
    const { originalPrimaryRoleId, originalAdditionalRoleIds } = editState;

    try {
      // 1. Update basic profile + primary role
      await api.users.update(editState.userId, {
        fullNameAr: editForm.fullNameAr,
        fullNameEn: editForm.fullNameEn,
        email:      editForm.email     || null,
        username:   editForm.username  || null,
        department: editForm.department || null,
        jobTitle:   editForm.jobTitle   || null,
        roleId:     newPrimaryRoleId,
      });

      // 2. Remove additional roles that were deselected
      for (const rid of originalAdditionalRoleIds) {
        if (!newAdditionalIds.includes(rid) && rid !== newPrimaryRoleId) {
          await api.users.removeRole(editState.userId, rid).catch(() => {});
        }
      }

      // 3. Add newly selected additional roles
      for (const rid of newAdditionalIds) {
        if (!originalAdditionalRoleIds.includes(rid) && rid !== originalPrimaryRoleId) {
          await api.users.addRole(editState.userId, rid).catch(() => {});
        }
      }

      // 4. If old primary was demoted to additional, add it as a secondary role
      if (
        originalPrimaryRoleId &&
        originalPrimaryRoleId !== newPrimaryRoleId &&
        newAdditionalIds.includes(originalPrimaryRoleId)
      ) {
        await api.users.addRole(editState.userId, originalPrimaryRoleId).catch(() => {});
      }

      setEditState(null);
      loadUsers();
    } catch (e: any) {
      setEditError(e?.response?.data?.message ?? label('فشل الحفظ، حاول مجدداً', 'Save failed, please try again'));
    } finally { setEditSubmitting(false); }
  };

  const roleColorMap: Record<string, string> = {
    Admin:     'var(--color-primary-dark)',
    Manager:   'var(--color-blue)',
    Evaluator: 'var(--color-conditional)',
    DataEntry: 'var(--color-navy)',
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {label('إدارة المستخدمين', 'User Management')}
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            {label(`${total} مستخدم`, `${total} users`)}
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setSelectedRoleIds([]); setFormError(''); }} style={primaryBtnStyle}>
          + {label('مستخدم جديد', 'New User')}
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <input type="search" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder={label('بحث بالاسم أو البريد...', 'Search by name or email...')}
          style={{ ...inputStyle, width: '280px' }} />
      </div>

      {/* ── Users table ── */}
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
                  label('الاسم', 'Name'),
                  label('اسم المستخدم', 'Username'),
                  label('الدور', 'Role'),
                  label('القسم', 'Dept.'),
                  label('الحالة', 'Status'),
                  label('آخر دخول', 'Last Login'),
                  label('إجراءات', 'Actions'),
                ].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'var(--color-bg-white)' : 'var(--color-neutral-50)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 'var(--font-regular)' }}>{isAr ? u.fullNameAr : u.fullNameEn}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{u.username}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--text-xs)', padding: '2px 10px', borderRadius: 'var(--radius-full)', background: 'var(--color-neutral-100)', color: roleColorMap[u.roleName] ?? 'var(--color-text-secondary)' }}>
                      {isAr ? u.roleNameAr : u.roleName}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{u.department ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: u.isActive ? 'var(--color-success-light)' : 'var(--color-danger-light)', color: u.isActive ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {u.isActive ? label('نشط', 'Active') : label('معطّل', 'Inactive')}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-SA') : label('لم يسجل دخول', 'Never')}
                  </td>
                  <td style={{ ...tdStyle }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                      {/* Edit */}
                      <button
                        onClick={() => handleEditOpen(u.id)}
                        disabled={editLoading}
                        style={editBtnStyle}
                        title={label('تعديل البيانات', 'Edit user')}
                      >
                        {label('تعديل', 'Edit')}
                      </button>

                      {/* Activate / Deactivate */}
                      {u.isActive ? (
                        <button onClick={() => handleDeactivate(u.id)} style={dangerBtnStyle}>{label('تعطيل', 'Deactivate')}</button>
                      ) : (
                        <button onClick={() => handleActivate(u.id)} style={successBtnStyle}>{label('تفعيل', 'Activate')}</button>
                      )}

                      {/* Reset password */}
                      <button
                        onClick={() => { setResetModal({ userId: u.id, name: isAr ? u.fullNameAr : u.fullNameEn }); setNewPassword(''); setResetError(''); }}
                        style={ghostBtnStyle}
                      >
                        {label('كلمة المرور', 'Reset Pwd')}
                      </button>

                      {/* Delete */}
                      <button onClick={() => handleSoftDelete(u.id, isAr ? u.fullNameAr : u.fullNameEn)} style={deleteBtnStyle}>
                        {label('حذف', 'Delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                    {label('لا يوجد مستخدمون', 'No users found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtnStyle}>{isAr ? '›' : '‹'}</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} style={paginationBtnStyle}>{isAr ? '‹' : '›'}</button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          Edit user modal
      ════════════════════════════════════════════════════════ */}
      {editState && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            {/* Header */}
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', margin: 0 }}>
                  {label('تعديل بيانات المستخدم', 'Edit User')}
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                  {editState.displayName}
                </p>
              </div>
              <button onClick={() => setEditState(null)} style={closeBtn}>×</button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSave} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Names */}
              <div style={rowStyle}>
                <Field label={label('الاسم (عربي) *', 'Name (Arabic) *')}>
                  <input
                    required
                    value={editForm.fullNameAr}
                    onChange={e => setEditForm(f => ({ ...f, fullNameAr: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label={label('الاسم (إنجليزي)', 'Name (English)')}>
                  <input
                    value={editForm.fullNameEn}
                    onChange={e => setEditForm(f => ({ ...f, fullNameEn: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Email / Username */}
              <div style={rowStyle}>
                <Field label={label('البريد الإلكتروني *', 'Email *')}>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label={label('اسم المستخدم *', 'Username *')}>
                  <input
                    required
                    value={editForm.username}
                    onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Department / Job Title */}
              <div style={rowStyle}>
                <Field label={label('القسم', 'Department')}>
                  <input
                    value={editForm.department}
                    onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <Field label={label('المسمى الوظيفي', 'Job Title')}>
                  <input
                    value={editForm.jobTitle}
                    onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Roles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                  {label('الأدوار (اختر واحداً أو أكثر — الأول هو الأساسي)', 'Roles (first selected = primary)')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)' }}>
                  {roles.map(r => {
                    const checked = editRoleIds.includes(r.id);
                    const isPrimary = editRoleIds[0] === r.id;
                    return (
                      <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEditRole(r.id)}
                          style={{ accentColor: 'var(--color-primary-dark)', width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: 'var(--text-sm)', color: checked ? 'var(--color-primary-dark)' : 'var(--color-text-primary)', fontWeight: checked ? 'var(--font-medium)' : 'var(--font-regular)' }}>
                          {isAr ? r.nameAr : r.name}
                          {isPrimary && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginRight: 'var(--space-2)', marginLeft: 'var(--space-2)' }}>
                              ({label('أساسي', 'primary')})
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {editError && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                  {editError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                <button type="button" onClick={() => setEditState(null)} style={cancelBtnStyle}>
                  {label('إلغاء', 'Cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} style={primaryBtnStyle}>
                  {editSubmitting ? label('جارٍ الحفظ...', 'Saving...') : label('حفظ التعديلات', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Reset password modal
      ════════════════════════════════════════════════════════ */}
      {resetModal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: '400px' }}>
            <div style={modalHeaderStyle}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', margin: 0 }}>
                {label('إعادة تعيين كلمة المرور', 'Reset Password')}
              </h3>
              <button onClick={() => setResetModal(null)} style={closeBtn}>×</button>
            </div>
            <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {isAr ? `المستخدم: ${resetModal.name}` : `User: ${resetModal.name}`}
              </p>
              <Field label={label('كلمة المرور الجديدة *', 'New Password *')}>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder={label('8 أحرف على الأقل', 'At least 8 characters')} style={inputStyle} />
              </Field>
              {resetError && (
                <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                  {resetError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button type="button" onClick={() => setResetModal(null)} style={cancelBtnStyle}>{label('إلغاء', 'Cancel')}</button>
                <button type="button" onClick={handleResetPassword} disabled={resetting} style={primaryBtnStyle}>
                  {resetting ? label('جارٍ...', 'Saving...') : label('تغيير كلمة المرور', 'Reset Password')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          Create user modal
      ════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ ...modalHeaderStyle, position: 'sticky', top: 0, background: 'var(--color-bg-white)', zIndex: 1 }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-regular)', margin: 0 }}>
                {label('إنشاء مستخدم جديد', 'Create New User')}
              </h3>
              <button onClick={() => { setShowModal(false); setSelectedRoleIds([]); }} style={closeBtn}>×</button>
            </div>
            <form onSubmit={handleCreate} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={rowStyle}>
                <Field label={label('الاسم (عربي) *', 'Name (Arabic) *')}>
                  <input required value={form.fullNameAr} onChange={e => setForm(f => ({ ...f, fullNameAr: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label={label('الاسم (إنجليزي)', 'Name (English)')}>
                  <input value={form.fullNameEn} onChange={e => setForm(f => ({ ...f, fullNameEn: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <div style={rowStyle}>
                <Field label={label('البريد الإلكتروني *', 'Email *')}>
                  <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label={label('اسم المستخدم *', 'Username *')}>
                  <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              <Field label={label('كلمة المرور *', 'Password *')}>
                <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" style={inputStyle} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>
                  {label('الأدوار * (اختر واحداً أو أكثر)', 'Roles * (select one or more)')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)' }}>
                  {roles.map(r => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedRoleIds.includes(r.id)} onChange={() => toggleRole(r.id)}
                        style={{ accentColor: 'var(--color-primary-dark)', width: '16px', height: '16px' }} />
                      <span style={{ fontSize: 'var(--text-sm)', color: selectedRoleIds.includes(r.id) ? 'var(--color-primary-dark)' : 'var(--color-text-primary)', fontWeight: selectedRoleIds.includes(r.id) ? 'var(--font-medium)' : 'var(--font-regular)' }}>
                        {isAr ? r.nameAr : r.name}
                        {selectedRoleIds[0] === r.id && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginRight: 'var(--space-2)', marginLeft: 'var(--space-2)' }}>
                            ({label('الدور الأساسي', 'primary')})
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={rowStyle}>
                <Field label={label('القسم', 'Department')}>
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label={label('المسمى الوظيفي', 'Job Title')}>
                  <input value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
              {formError && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--color-danger-light)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                <button type="button" onClick={() => { setShowModal(false); setSelectedRoleIds([]); }} style={cancelBtnStyle}>{label('إلغاء', 'Cancel')}</button>
                <button type="submit" disabled={submitting} style={primaryBtnStyle}>
                  {submitting ? label('جارٍ...', 'Creating...') : label('إنشاء', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: CSSProperties = {
  background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)',
  width: '560px', maxWidth: '95vw',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto',
};
const modalHeaderStyle: CSSProperties = {
  padding: 'var(--space-5) var(--space-6)',
  borderBottom: '1px solid var(--color-border)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
};
const closeBtn: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 'var(--text-xl)', color: 'var(--color-text-muted)',
  lineHeight: 1, padding: 0, flexShrink: 0,
};
const cardStyle: CSSProperties        = { background: 'var(--color-bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const thStyle: CSSProperties          = { padding: 'var(--space-3) var(--space-4)', textAlign: 'start', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: CSSProperties          = { padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', verticalAlign: 'middle' };
const primaryBtnStyle: CSSProperties  = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-primary-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-light)' };
const cancelBtnStyle: CSSProperties   = { padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg-white)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)' };
const editBtnStyle: CSSProperties     = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-primary-dark)', border: '1px solid var(--color-primary-dark)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)' };
const dangerBtnStyle: CSSProperties   = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const successBtnStyle: CSSProperties  = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-success)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const ghostBtnStyle: CSSProperties    = { padding: 'var(--space-1) var(--space-3)', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const deleteBtnStyle: CSSProperties   = { padding: 'var(--space-1) var(--space-3)', background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 'var(--text-xs)' };
const inputStyle: CSSProperties       = { padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', background: 'var(--color-bg-white)', fontFamily: 'inherit', outline: 'none', width: '100%' };
const rowStyle: CSSProperties         = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' };
const paginationBtnStyle: CSSProperties = { width: '32px', height: '32px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-white)', cursor: 'pointer', fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)' };
