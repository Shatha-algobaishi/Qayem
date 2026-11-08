import { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { setLocale, setMobileMenu } from '../../../app/uiSlice';
import { api } from '../../../core/api/apiClient';

interface HeaderProps {
  titleAr?: string;
  titleEn?: string;
  breadcrumbs?: { labelAr: string; labelEn: string; path?: string }[];
}

export default function Header({ titleAr, titleEn, breadcrumbs }: HeaderProps) {
  const dispatch  = useAppDispatch();
  const { locale, sidebarCollapsed, mobileMenuOpen } = useAppSelector(s => s.ui);
  const isAr      = locale === 'ar';
  const sidebarW  = sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';

  const [unreadCount, setUnreadCount]     = useState(0);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCount = () =>
      api.notifications.unreadCount()
        .then(r => setUnreadCount(r.data.count ?? 0))
        .catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    api.notifications.list({ pageSize: 10 })
      .then(r => setNotifications(r.data.items ?? []))
      .catch(() => {});
  }, [notifOpen]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id: string) => {
    await api.notifications.markRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <header
      className="app-header"
      style={{
        position:       'fixed',
        top:            0,
        [isAr ? 'right' : 'left']: sidebarW,
        [isAr ? 'left' : 'right']: 0,
        height:         'var(--header-height)',
        background:     'var(--color-header)',
        borderBottom:   '1px solid var(--color-border)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 var(--space-8)',

        zIndex:         'var(--z-header)',
        transition:     `${isAr ? 'right' : 'left'} var(--transition-slow)`,
        boxShadow:      'var(--shadow-sm)',
      }}
    >
      <button className="mobile-menu" aria-controls="workspace-navigation" aria-expanded={mobileMenuOpen} aria-label={isAr ? 'قائمة التنقل' : 'Navigation menu'} onClick={() => dispatch(setMobileMenu(!mobileMenuOpen))}>☰</button>
      {/* ── Page title / breadcrumbs (sidebar side) ── */}
      <div style={{ flex: 1 }}>
        {breadcrumbs && (
          <nav style={{ marginBottom: 'var(--space-1)' }}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {i > 0 && <span style={{ margin: '0 var(--space-2)' }}>›</span>}
                {isAr ? crumb.labelAr : crumb.labelEn}
              </span>
            ))}
          </nav>
        )}
        {(titleAr || titleEn) && (
          <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-light)', color: 'var(--color-text-primary)' }}>
            {isAr ? titleAr : titleEn}
          </h1>
        )}
      </div>

      {/* ── Header actions (center-right) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 'var(--space-1)', display: 'flex', alignItems: 'center' }}
            title={isAr ? 'الإشعارات' : 'Notifications'}
          >
            <span style={{ fontSize: '20px', color: 'var(--color-text-secondary)' }}>🔔</span>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-2px', [isAr ? 'left' : 'right']: '-2px',
                minWidth: '18px', height: '18px', borderRadius: '9px',
                background: 'var(--color-danger)', color: '#fff',
                fontSize: '10px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', [isAr ? 'left' : 'right']: 0,
              width: '320px', background: 'var(--color-bg-white)',
              border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                  {isAr ? 'الإشعارات' : 'Notifications'}
                </span>
                {unreadCount > 0 && (
                  <button onClick={() => { api.notifications.markAllRead().catch(() => {}); setNotifications(prev => prev.map(n => ({ ...n, isRead: true }))); setUnreadCount(0); }}
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary-dark)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    {isAr ? 'لا توجد إشعارات' : 'No notifications'}
                  </div>
                ) : notifications.map((n: any) => (
                  <div key={n.id} onClick={() => markRead(n.id)}
                    style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: n.isRead ? 'transparent' : 'var(--color-neutral-50)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                      {!n.isRead && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-primary-dark)', marginTop: '5px', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: n.isRead ? 'var(--font-light)' : 'var(--font-medium)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAr ? n.titleAr : n.titleEn}
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAr ? n.messageAr : n.messageEn}
                        </p>
                        <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '3px 0 0' }}>
                          {new Date(n.createdAt).toLocaleString(isAr ? 'ar-SA' : 'en-SA', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Language toggle — icon only */}
        <button
          onClick={() => dispatch(setLocale(isAr ? 'en' : 'ar'))}
          title={isAr ? 'Switch to English' : 'التبديل للعربية'}
          style={{
            background:     'var(--color-neutral-100)',
            border:         '1px solid var(--color-border)',
            borderRadius:   'var(--radius-md)',
            padding:        'var(--space-2)',
            cursor:         'pointer',
            color:          'var(--color-text-secondary)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            transition:     'all var(--transition-fast)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </button>
      </div>

    </header>
  );
}
