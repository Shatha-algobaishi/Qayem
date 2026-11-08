import { useAppSelector } from '../../../app/store';

export default function DemoGuidePage() {
  const isAr = useAppSelector(s => s.ui.locale) === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;
  return <section className="demo-guide">
    <h1>{t('استكشف قيّم', 'Explore Qayem')}</h1>
    <p>{t('جميع الأسماء والدرجات والقرارات هنا أمثلة وهمية، وليست تقييمات لأشخاص حقيقيين.', 'Every name, score and decision here is fictional and does not describe a real person.')}</p>
    <h2>{t('أمثلة جاهزة للاستعراض', 'Ready-to-explore examples')}</h2>
    <ul>
      <li>{t('4 جلسات و12 مرشحًا و3 مقيّمين، مع بيانات عربية وإنجليزية.', '4 sessions, 12 candidates and 3 evaluators, with Arabic and English examples.')}</li>
      <li>{t('درجات منخفضة ومتوسطة ومرتفعة، مع نتائج متقاربة وأخرى تحتاج مراجعة التباين.', 'Low, medium and high scores, with agreement and discrepancy scenarios.')}</li>
      <li>{t('مسودات وتقييمات بانتظار الإنجاز، وقرارات تشمل التوصية والتأهيل المشروط وعدم التأهيل والتوظيف.', 'Draft and pending evaluations, plus recommended, conditional, not-qualified and employed decisions.')}</li>
    </ul>
    <h2>{t('ابدأ بحسب دورك', 'Choose a role')}</h2>
    <p>{t('جرّب المدير للإحصاءات والمقارنات والتقارير، والمقيّم لتقييماته، ومدخل البيانات للجلسات والمرشحين، ومدير النظام للإعدادات. يمكنك التبديل من القائمة الجانبية.', 'Use Manager for statistics, comparisons and reports; Evaluator for assigned evaluations; Data entry for sessions and candidates; Administrator for settings. Switch roles from the sidebar.')}</p>
    <h2>{t('لماذا لا يُحفظ التغيير؟', 'Why are changes blocked?')}</h2>
    <p>{t('وضع العرض يحافظ على الأمثلة الجاهزة للزوار. لتجربة الإنشاء والحفظ وإرسال التقييمات على جهازك، شغّل وضع التجربة المحلية الوارد في الدليل. لا يتصل هذا الوضع ببيانات إنتاج، وتُحذف تعديلاته عند إعادة تشغيله.', 'The visitor demo preserves its examples. To create, save and submit evaluations on your own computer, use the local practice setup in the guide. It uses a separate disposable database and resets changes on restart.')}</p>
    <a href="https://github.com/Shatha-algobaishi/Qayem/blob/main/docs/DEMO.md" target="_blank" rel="noreferrer">{t('فتح تعليمات التشغيل المحلية', 'Open local setup instructions')}</a>
  </section>;
}
