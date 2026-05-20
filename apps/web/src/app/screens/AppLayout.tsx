import { NavLink, Outlet, useNavigate } from 'react-router';
import { BookOpen, Bookmark, CircleDot, Compass, Download, LocateFixed, MessageCircle, Route, User } from 'lucide-react';
import { BrandMark } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/app/map', icon: LocateFixed, label: 'Nearby' },
  { path: '/app/explore', icon: Compass, label: 'Explore' },
  { path: '/app/saved', icon: Bookmark, label: 'Saved' },
  { path: '/app/my-trails', icon: Route, label: 'My trails' },
  { path: '/app/history', icon: BookOpen, label: 'History' },
  { path: '/app/journal', icon: BookOpen, label: 'Journal' },
  { path: '/app/community', icon: MessageCircle, label: 'Community' },
  { path: '/app/offline', icon: Download, label: 'Offline' },
  { path: '/app/profile', icon: User, label: 'Profile' },
];

function NavigationItems({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={compact ? 16 : 18} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="app-frame">
      <div className="mobile-topbar">
        <BrandMark />
        <div className="mobile-topbar__scroll">
          <NavigationItems compact />
        </div>
      </div>

      <div className="app-shell">
        <aside className="app-sidebar">
          <BrandMark />
          <nav className="app-sidebar__nav" aria-label="Primary navigation">
            <NavigationItems />
          </nav>

          <button className="btn btn-primary mt-6 w-full" onClick={() => navigate('/recording')}>
            <CircleDot size={18} />
            Start recording
          </button>

          <div className="app-sidebar__panel">
            <strong>{isAuthenticated ? user?.full_name || user?.email : 'Browse as guest'}</strong>
            <span>{isAuthenticated ? 'Signed in' : 'Guest mode'}</span>
          </div>
        </aside>

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
