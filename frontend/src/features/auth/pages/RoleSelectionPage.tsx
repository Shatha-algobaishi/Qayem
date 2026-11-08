import DemoNotice from '../../../shared/components/ui/DemoNotice';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { switchRole, logout } from '../authSlice';
import { setLocale } from '../../../app/uiSlice';

const descriptions: Record<string, [string, string]> = {
  Admin: ['إدارة المستخدمين والصلاحيات وإعدادات التقييم.', 'Manage accounts, permissions and evaluation settings.'],
  DataEntry: ['تنظيم المقابلات وتسجيل المرشحين وإسناد المقيّمين.', 'Organize interviews, register candidates and assign evaluators.'],
  Evaluator: ['مراجعة المرشحين المسندين إليك وتسجيل تقييماتهم.', 'Review your assigned candidates and complete their evaluations.'],
  Manager: ['مراجعة النتائج والتباينات واتخاذ قرارات التوظيف.', 'Review results, resolve discrepancies and make hiring decisions.'],
};
export default function RoleSelectionPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, activeRoleName } = useAppSelector(s => s.auth);
  const locale = useAppSelector(s => s.ui.locale);
  const isAr = locale === 'ar';
  if (!user) return null;
  const roles = [{ roleName: user.roleName, roleNameAr: user.roleNameAr }, ...(user.additionalRoles ?? [])];
  return <main className="role-page" dir={isAr ? 'rtl' : 'ltr'} lang={locale}>
    <div className="role-topbar"><img src="/qayem-logo-white.svg" alt="Qayem" />
      <button className="language-button" onClick={() => dispatch(setLocale(isAr ? 'en' : 'ar'))}>{isAr ? 'English' : 'العربية'}</button>
    </div>
    <section className="role-workspace" aria-labelledby="role-heading">
      <p className="login-context">{isAr ? user.fullNameAr : user.fullNameEn}</p>
      <h1 id="role-heading">{isAr ? 'اختر مساحة عملك' : 'Choose your workspace'}</h1>
      <p className="login-help">{isAr ? 'اختر الدور المناسب لمهمتك. يمكنك تغييره من القائمة الجانبية.' : 'Choose the role for your task. You can switch again from the sidebar.'}</p>
      <DemoNotice />
      <div className="role-list">{roles.map(role => <button key={role.roleName} className="role-option" aria-pressed={activeRoleName === role.roleName} onClick={() => { dispatch(switchRole(role.roleName)); navigate('/'); }}>
        <strong>{isAr ? role.roleNameAr : ({ Admin: 'Administrator', DataEntry: 'Data entry', Evaluator: 'Evaluator', Manager: 'Manager' }[role.roleName] ?? role.roleName)}</strong>
        <span>{descriptions[role.roleName]?.[isAr ? 0 : 1]}</span>
        <span className="role-open">{isAr ? 'فتح مساحة العمل' : 'Open workspace'}</span>
      </button>)}</div>
      <button className="text-action" onClick={() => dispatch(logout())}>{isAr ? 'تسجيل الخروج' : 'Sign out'}</button>
    </section>
  </main>;
}
