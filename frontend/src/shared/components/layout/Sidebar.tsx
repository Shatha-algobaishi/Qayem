import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { toggleSidebar, setMobileMenu } from '../../../app/uiSlice';
import { logout } from '../../../features/auth/authSlice';

interface NavItem {
  labelAr: string;
  labelEn: string;
  path:    string;
  icon:    string;
  roles:   string[];
}

const NAV_ITEMS: NavItem[] = [
  // Manager only
  { labelAr: 'لوحة التحكم',         labelEn: 'Dashboard',            path: '/manager/dashboard',        icon: '◫', roles: ['Manager'] },
  // DataEntry + Evaluator only
  { labelAr: 'جلسات المقابلة',       labelEn: 'Interview Sessions',    path: '/sessions',                 icon: '⊞', roles: ['Admin', 'DataEntry', 'Evaluator'] },
  // DataEntry + Manager only
  { labelAr: 'المتقدمون',            labelEn: 'Applicants',             path: '/candidates',               icon: '◻', roles: ['DataEntry', 'Manager'] },
  // Evaluator only
  { labelAr: 'تقييماتي',            labelEn: 'My Evaluations',         path: '/evaluations/my',           icon: '◈', roles: ['Evaluator'] },
  // Manager only
  { labelAr: 'تحليلات المقيّمين',    labelEn: 'Evaluator Analytics',    path: '/manager/evaluator-analytics', icon: '◎', roles: ['Manager'] },
  { labelAr: 'التقارير',            labelEn: 'Reports',                path: '/reports',                  icon: '▦', roles: ['Manager'] },
  // Admin only
  { labelAr: 'المتقدمون',           labelEn: 'Applicants',             path: '/candidates',               icon: '◻', roles: ['Admin'] },
  { labelAr: 'المستخدمون',          labelEn: 'Users',                  path: '/admin/users',              icon: '◉', roles: ['Admin'] },
  { labelAr: 'أسئلة التقييم',       labelEn: 'Questions',              path: '/admin/questions',          icon: '◆', roles: ['Admin'] },
  { labelAr: 'قوائم الاختيار',      labelEn: 'Reference Lists',        path: '/admin/reference-lists',    icon: '☰', roles: ['Admin'] },
  { labelAr: 'سجل المراجعة',        labelEn: 'Audit Log',              path: '/manager/audit',            icon: '▣', roles: ['Admin'] },
  { labelAr: 'إعدادات النظام',       labelEn: 'System Settings',        path: '/admin/settings',           icon: '◌', roles: ['Admin'] },
];

export default function Sidebar() {
  const dispatch  = useAppDispatch();
  const navigate  = useNavigate();
  const { user, activeRoleName }  = useAppSelector(s => s.auth);
  const { sidebarCollapsed, locale, mobileMenuOpen } = useAppSelector(s => s.ui);
  const location  = useLocation();
  const isAr      = locale === 'ar';
  const hasMultipleRoles = (user?.additionalRoles?.length ?? 0) > 0;

  const effectiveRole = activeRoleName ?? user?.roleName;
  const visibleItems = NAV_ITEMS.filter(
    item => effectiveRole && item.roles.includes(effectiveRole),
  );

  const sidebarW = sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';

  return (
    <aside
      id="workspace-navigation" className="app-sidebar" data-open={mobileMenuOpen}
      style={{
        width:            sidebarW,
        minHeight:        '100vh',
        background:       'var(--color-sidebar)',
        display:          'flex',
        flexDirection:    'column',
        transition:       'width var(--transition-slow)',
        position:         'fixed',
        top:              0,
        [isAr ? 'right' : 'left']: 0,
        zIndex:           'var(--z-sidebar)',
        overflowX:        'hidden',
      }}
    >
      {/* ── Logo area ── */}
      <div style={{
        height:         'var(--header-height)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 var(--space-3)',
        borderBottom:   '1px solid rgba(255,255,255,0.12)',
        gap:            'var(--space-2)',
      }}>
        {sidebarCollapsed ? (
          <img src="/favicon.svg" width="36" height="36" alt="Qayem" />
        ) : (
          <img
            src="/qayem-logo-white.svg"
            alt="قيّم"
            style={{ height: 36, width: 'auto', maxWidth: 190 }}
          />
        )}
        <button
          onClick={() => window.matchMedia('(max-width: 760px)').matches ? dispatch(setMobileMenu(false)) : dispatch(toggleSidebar())}
          style={{
            background:  'transparent',
            border:      'none',
            color:       'rgba(255,255,255,0.7)',
            cursor:      'pointer',
            padding:     'var(--space-1)',
            fontSize:    'var(--text-base)',
            borderRadius: 'var(--radius-sm)',
            flexShrink:  0,
          }}
          aria-label={mobileMenuOpen ? (isAr ? 'إغلاق القائمة' : 'Close menu') : (isAr ? 'طي القائمة' : 'Toggle sidebar')}
        >
          {sidebarCollapsed
            ? (isAr ? '◁' : '▷')
            : (isAr ? '▷' : '◁')
          }
        </button>
      </div>

      {/* ── User badge ── */}
      {!sidebarCollapsed && user && (
        <div style={{
          padding:        'var(--space-4)',
          borderBottom:   '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width:        '36px',
            height:       '36px',
            borderRadius: 'var(--radius-full)',
            background:   'var(--color-accent)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            color:         'var(--color-primary-dark)',
            marginBottom:  'var(--space-2)',
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.315 0-10 1.668-10 5v3h20v-3c0-3.332-6.685-5-10-5z"/>
            </svg>
          </div>
          <p style={{ color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-regular)', lineHeight: 1.2 }}>
            {isAr ? user.fullNameAr : user.fullNameEn}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)' }}>
            {isAr
              ? (user.additionalRoles?.find(r => r.roleName === activeRoleName)?.roleNameAr ?? user.roleNameAr)
              : ({ Admin: 'System Administrator', DataEntry: 'Data Entry', Evaluator: 'Evaluator', Manager: 'Manager' }[(effectiveRole ?? user.roleName) ?? ''] ?? (effectiveRole ?? user.roleName))}
          </p>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: 'var(--space-3) 0', overflowY: 'auto' }}>
        {visibleItems.map(item => {
          const active = location.pathname.startsWith(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={isAr ? item.labelAr : item.labelEn}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            'var(--space-3)',
                padding:        sidebarCollapsed
                  ? 'var(--space-3) 0'
                  : 'var(--space-3) var(--space-4)',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                color:          active ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
                background:     active ? 'var(--color-sidebar-active)' : 'transparent',
                borderRight:    active && !isAr ? '3px solid var(--color-accent)' : 'none',
                borderLeft:     active && isAr ? '3px solid var(--color-accent)' : 'none',
                textDecoration: 'none',
                fontSize:       'var(--text-sm)',
                fontWeight:     active ? 'var(--font-medium)' : 'var(--font-light)',
                transition:     'all var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: 'var(--text-base)', flexShrink: 0 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{isAr ? item.labelAr : item.labelEn}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Bottom actions ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding:   'var(--space-3) 0',
      }}>
        {hasMultipleRoles && (
          <button
            onClick={() => navigate('/select-role')}
            title={isAr ? 'تبديل الدور' : 'Switch Role'}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            'var(--space-3)',
              width:          '100%',
              padding:        sidebarCollapsed
                ? 'var(--space-3) 0'
                : 'var(--space-3) var(--space-4)',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              background:     'transparent',
              border:         'none',
              color:          'rgba(255,255,255,0.75)',
              cursor:         'pointer',
              fontSize:       'var(--text-sm)',
            }}
          >
            <span>⇌</span>
            {!sidebarCollapsed && <span>{isAr ? 'تبديل الدور' : 'Switch Role'}</span>}
          </button>
        )}
        <button
          onClick={() => dispatch(logout())}
          title={isAr ? 'تسجيل الخروج' : 'Sign Out'}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            'var(--space-3)',
            width:          '100%',
            padding:        sidebarCollapsed
              ? 'var(--space-3) 0'
              : 'var(--space-3) var(--space-4)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            background:     'transparent',
            border:         'none',
            color:          'rgba(255,255,255,0.55)',
            cursor:         'pointer',
            fontSize:       'var(--text-sm)',
          }}
        >
          <span>⬡</span>
          {!sidebarCollapsed && <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>}
        </button>
      </div>
    </aside>
  );
}
