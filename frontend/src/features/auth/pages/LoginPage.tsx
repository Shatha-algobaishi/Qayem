import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { setLocale } from '../../../app/uiSlice';
import { login, clearError } from '../authSlice';
import { apiClient } from '../../../core/api/apiClient';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, error, user, activeRoleName } = useAppSelector(s => s.auth);
  const locale = useAppSelector(s => s.ui.locale);
  const isAr = locale === 'ar';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [demo, setDemo] = useState(false);
  const label = (ar: string, en: string) => isAr ? ar : en;
  useEffect(() => {
    apiClient.get('/auth/demo-info').then(r => setDemo(r.data.enabled === true)).catch(() => setDemo(false));
  }, []);

  if (isAuthenticated) {
    if ((user?.additionalRoles?.length ?? 0) > 0 && !activeRoleName) return <Navigate to="/select-role" replace />;
    return <Navigate to="/" replace />;
  }
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    dispatch(clearError());
    dispatch(login({ username: username.trim(), password }));
  };
  return (
    <main className="login-page" dir={isAr ? 'rtl' : 'ltr'} lang={locale}>
      <section className="login-brand" aria-label={label('عن المنصة', 'About the platform')}>
        <img src="/qayem-logo-white.svg" alt={label('قيّم', 'Qayem')} />
        <div className="login-intro">
          <h1>{label('كل مقابلة، خطوة نحو الكفاءة.', 'Every interview. A step toward excellence.')}</h1>
          <p>{label('منصة تقييم المرشحين تجمع بيانات المتقدمين وآراء المقيّمين وقرارات التوظيف في مسار واضح.', 'Candidate records, evaluator perspectives and hiring decisions, together in one clear workflow.')}</p>
        </div>
        <ol className="login-workflow">
          <li>{label('تنظيم جلسات المقابلات', 'Organize interview sessions')}</li>
          <li>{label('تقييم موحد لكل مرشح', 'Evaluate candidates consistently')}</li>
          <li>{label('مراجعة النتائج واتخاذ القرار', 'Review results and make decisions')}</li>
        </ol>
        <p className="login-brand-note">{label('نظام تقييم المرشحين', 'Candidate evaluation platform')}</p>
      </section>
      <section className="login-form-panel" aria-labelledby="login-heading">
        <button className="language-button" type="button" onClick={() => dispatch(setLocale(isAr ? 'en' : 'ar'))} lang={isAr ? 'en' : 'ar'}>
          {isAr ? 'English' : 'العربية'}
        </button>
        <div className="login-form-content">
          <p className="login-context">{label('الموارد البشرية', 'Human resources')}</p>
          <h2 id="login-heading">{label('تسجيل الدخول', 'Sign in')}</h2>
          <p className="login-help">{label('استخدم حسابك المخصص للوصول إلى مساحة عملك.', 'Use your assigned account to access your workspace.')}</p>
          <form onSubmit={handleSubmit} aria-busy={isLoading}>
            <label htmlFor="username">{label('اسم المستخدم أو البريد الإلكتروني', 'Username or email')}</label>
            <input id="username" name="username" value={username} onChange={e => setUsername(e.target.value)} required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} dir="auto" />
            <label htmlFor="password">{label('كلمة المرور', 'Password')}</label>
            <div className="password-field">
              <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required maxLength={72} autoComplete="current-password" aria-describedby={error ? 'login-error' : undefined} />
              <button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? label('إخفاء', 'Hide') : label('إظهار', 'Show')}
              </button>
            </div>
            {error && <p id="login-error" className="form-error" role="alert">{label('تعذر تسجيل الدخول. تحقق من بياناتك واتصالك ثم حاول مجددًا.', error)}</p>}
            <button className="primary-action" type="submit" disabled={isLoading || !username.trim() || !password}>
              {isLoading ? label('جارٍ تسجيل الدخول…', 'Signing in?') : label('دخول إلى مساحة العمل', 'Enter workspace')}
            </button>
          </form>
          <div className="access-note">
            <h3>{label('تحتاج إلى حساب؟', 'Need an account?')}</h3>
            <p>{label('إنشاء الحسابات وتحديد الأدوار من اختصاص مدير النظام. تواصل معه للحصول على صلاحية الدخول.', 'Accounts and roles are assigned by your system administrator. Contact them to request access.')}</p>
          </div>
          {demo && <aside className="demo-access" aria-label={label('الدخول التجريبي', 'Demo access')}>
            <strong>{label('استكشف المنصة', 'Explore the platform')}</strong>
            <p>{label('حساب للقراءة فقط ببيانات افتراضية وأربعة أدوار. استخدم كلمة المرور التي حددها مشغّل هذه النسخة.', 'Read-only access with fictional data and four roles. Use the demo password configured by the person running this instance.')}</p>
            <button type="button" onClick={() => { setUsername('demo'); dispatch(clearError()); }}>
              {label('استخدام اسم المستخدم التجريبي', 'Use demo username')}
            </button>
          </aside>}
        </div>
      </section>
    </main>
  );
}
