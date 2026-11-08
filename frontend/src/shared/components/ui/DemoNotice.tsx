import { Link } from 'react-router-dom';
import { useAppSelector } from '../../../app/store';

export default function DemoNotice() {
  const user = useAppSelector(s => s.auth.user);
  const isAr = useAppSelector(s => s.ui.locale) === 'ar';
  if (!user?.isDemo) return null;
  return <aside className="demo-banner" aria-label={isAr ? 'وضع الديمو' : 'Demo mode'}>
    <strong>{user.demoWriteEnabled
      ? (isAr ? 'تجربة محلية ببيانات وهمية' : 'Local practice with fictional data')
      : (isAr ? 'عرض تجريبي للقراءة فقط' : 'Read-only demonstration')}</strong>
    <p>{user.demoWriteEnabled
      ? (isAr ? 'يمكنك تجربة سير العمل. تُعاد البيانات عند إعادة التشغيل، وتبقى إدارة الحسابات وكلمات المرور محظورة.' : 'Workflow changes are enabled and reset on restart. Account and password administration remains blocked.')
      : (isAr ? 'استعرض الأدوار والنتائج والتقارير وصدّر الملفات. الإنشاء والحفظ ورفع الملفات وتغيير القرارات غير متاحة في هذا الوضع.' : 'Explore roles, results, reports and exports. Creating, saving, uploading and changing decisions are disabled in this mode.')}</p>
    <Link to="/demo-guide">{isAr ? 'دليل الديمو والتجربة المحلية' : 'Demo and local practice guide'}</Link>
  </aside>;
}
