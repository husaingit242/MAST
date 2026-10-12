import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Smartphone, Bug, ScanLine, FileText, Settings, Upload, Bell, Search, ChevronDown, Network, Activity, Cpu, BookOpen, LogOut } from 'lucide-react';
import Logo from '@/components/common/Logo';
import NotificationCenter from '@/components/common/NotificationCenter';
import { mockMode } from '@/services/dataProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { useUiStore } from '@/store/useUiStore';

const links = [
  ['Overview', '/', LayoutDashboard], ['Applications', '/applications', Smartphone],
  ['Vulnerabilities', '/vulnerabilities', Bug], ['Scan history', '/scans', ScanLine],
  ['Reports', '/reports', FileText], ['API security', '/api-security', Network],
  ['Dynamic analysis', '/dynamic-analysis', Activity], ['Reverse engineering', '/reverse-engineering', Cpu],
  ['OWASP mobile', '/owasp', BookOpen], ['Upload app', '/upload', Upload],
] as const;

export default function AppLayout() {
  const { pathname } = useLocation();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const notify = useUiStore(state => state.notify);
  if (!mockMode && !user) return <Navigate to="/login" replace state={{ from: pathname }}/>;
  const pageTitle = pathname === '/' ? 'Security overview'
    : pathname.startsWith('/application/') ? 'Application details'
    : pathname.startsWith('/vulnerability/') ? 'Finding details'
    : ({ '/applications': 'Applications', '/vulnerabilities': 'Vulnerabilities', '/scans': 'Scan history', '/reports': 'Reports', '/api-security': 'API security', '/dynamic-analysis': 'Dynamic analysis', '/reverse-engineering': 'Reverse engineering', '/owasp': 'OWASP mobile', '/upload': 'Add an application', '/active-scan': 'Active scan', '/settings': 'Settings' } as Record<string, string>)[pathname] ?? 'Security workspace';
  return <div className="shell">
    <aside className="sidebar">
      <Logo/>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{links.map(([label, to, Icon]) => <NavLink key={to} to={to} end={to === '/'} title={label} aria-label={label} className={({ isActive }) => { const detailActive = (label === 'Applications' && pathname.startsWith('/application/')) || (label === 'Vulnerabilities' && pathname.startsWith('/vulnerability/')); return `nav-item ${isActive || detailActive ? 'selected' : ''}`; }}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom">
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'selected' : ''}`} title="Settings" aria-label="Settings"><Settings size={18}/><span>Settings</span></NavLink>
        <div className="user-card"><div className="avatar">{user?.full_name?.slice(0, 2).toUpperCase() ?? 'SZ'}</div><div><b>{user?.full_name ?? 'Syed Zaidi'}</b><small>{user?.role ?? 'Security Analyst'}</small></div>{!mockMode && <button className="icon-button" type="button" aria-label="Sign out" onClick={() => { void logout().then(() => notify('Signed out.', 'info')).catch(() => notify('Signed out locally.', 'info')); }}><LogOut size={15}/></button>}<ChevronDown size={15}/></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{pageTitle}</b></div><div className="top-actions"><button className="search" type="button" aria-label="Search is planned for a later phase" disabled><Search size={16}/> Search <kbd>⌘ K</kbd></button><button className="icon-button" type="button" aria-label="Notifications are shown as toasts" disabled><Bell size={18}/></button><div className="avatar small-avatar" aria-label="Signed in as Syed Zaidi">SZ</div></div></header>
      <section className="content"><Outlet/></section>
    </main>
    <NotificationCenter/>
  </div>;
}
