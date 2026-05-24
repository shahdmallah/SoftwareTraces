import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Map, Compass, Bookmark, Activity, User, Plus, LogOut, LogIn } from 'lucide-react';
import { AuthModal } from './AuthModal';

const navLinks = [
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/profile', label: 'Profile', icon: User },
];

interface DesktopNavigationProps {
  isAuthenticated?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export function DesktopNavigation({ isAuthenticated = false, onSignIn, onSignOut }: DesktopNavigationProps) {
  const { pathname } = useLocation();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);

  return (
    <>
      <nav className="hidden md:flex items-center justify-between h-16 px-6 bg-card border-b border-border sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg">Traces</span>
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                pathname === to
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/create"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Trail</span>
          </Link>
          {isAuthenticated && onSignOut ? (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setAuthMode('signin')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-lg transition-colors"
              title="Sign in"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </nav>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={() => {
            setAuthMode(null);
            onSignIn?.();
          }}
          onToggleMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
        />
      )}
    </>
  );
}

export function MobileNavigation() {
  const { pathname } = useLocation();

  const mobileLinks = [
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/map', label: 'Map', icon: Map },
    null,
    { to: '/activity', label: 'Activity', icon: Activity },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileLinks.map((item) => {
          if (!item) {
            return (
              <Link
                key="create"
                to="/create"
                className="flex items-center justify-center w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg -mt-5 hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-7 h-7" />
              </Link>
            );
          }
          const Icon = item.icon;
          const isActive = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
