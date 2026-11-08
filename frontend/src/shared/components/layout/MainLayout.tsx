import DemoNotice from '../ui/DemoNotice';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { setMobileMenu } from '../../../app/uiSlice';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import Sidebar from './Sidebar';
import Header  from './Header';

export default function MainLayout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { sidebarCollapsed, locale, direction, mobileMenuOpen } = useAppSelector(s => s.ui);
  useEffect(() => { dispatch(setMobileMenu(false)); }, [location.pathname, dispatch]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const sidebar = document.getElementById('workspace-navigation');
    const controls = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    const returnFocus = document.activeElement as HTMLElement | null;
    controls()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); document.body.style.overflow = previousOverflow; returnFocus?.focus(); };
  }, [mobileMenuOpen]);
  useEffect(() => { const close = (e: KeyboardEvent) => { if(e.key === 'Escape') dispatch(setMobileMenu(false)); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [dispatch]);
  const isAr    = locale === 'ar';
  const sidebarW = sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';

  return (
    <div
      dir={direction}
      lang={locale}
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}
    >
      <a className="skip-link" href="#main-content">{isAr ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label={isAr ? 'إغلاق القائمة' : 'Close menu'} onClick={() => dispatch(setMobileMenu(false))} />}
      <Sidebar />

      <div
        className="app-content"
        style={{
          [isAr ? 'marginRight' : 'marginLeft']: sidebarW,
          flex:       1,
          minWidth:   0,
          display:    'flex',
          flexDirection: 'column',
          minHeight:  '100vh',
          transition: `margin var(--transition-slow)`,
          overflow:   'hidden',
        }}
      >
        <Header />

        <main
          id="main-content" tabIndex={-1} className="app-main"
          style={{
            marginTop:  'var(--header-height)',
            padding:    'var(--space-8)',
            flex:       1,
            maxWidth:   'var(--content-max-width)',
            width:      '100%',
            overflowX:  'auto',
          }}
        >
          <DemoNotice />
          <Outlet />
        </main>

        <footer
          style={{
            padding:      'var(--space-4) var(--space-8)',
            borderTop:    '1px solid var(--color-border)',
            background:   'var(--color-bg-white)',
            textAlign:    'center',
            fontSize:     'var(--text-xs)',
            color:        'var(--color-text-muted)',
          }}
        >
          {isAr
            ? 'قيّم — نظام تقييم المرشحين © 2026'
            : 'Qayem — Candidate Evaluation System © 2026'}
        </footer>
      </div>
    </div>
  );
}
