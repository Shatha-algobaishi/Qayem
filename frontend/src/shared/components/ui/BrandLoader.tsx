import { useAppSelector } from '../../../app/store';
export default function BrandLoader() {
  const ar=useAppSelector(s=>s.ui.locale)==='ar';
  return <div className="brand-loader" role="status"><img src="/favicon.svg" alt="" width="36" height="36"/><span>{ar?'جارٍ تحميل بيانات قيّم…':'Loading Qayem data…'}</span></div>;
}
