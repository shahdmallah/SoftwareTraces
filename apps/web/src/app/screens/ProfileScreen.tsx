import { Link, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { EmptyState, PageHeader, PageShell } from '../components/web';
import { useAuth } from '../contexts/AuthContext';

export function ProfileScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, signOut, user } = useAuth();

  if (!isAuthenticated || !user) {
    return (
      <PageShell>
        <EmptyState
          title="Sign in to view profile."
          action={<Link className="btn btn-primary" to="/auth?mode=signin">Sign in</Link>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Profile" description="Account details." />

      <section className="panel profile-panel">
        <div className="brand-pin profile-avatar">{(user.full_name || user.email || 'T').slice(0, 1).toUpperCase()}</div>
        <div>
          <h2>{user.full_name || 'Traces user'}</h2>
          <p>{user.email}</p>
          {user.role ? <span className="chip">{user.role}</span> : null}
        </div>
      </section>

      <button
        className="btn btn-secondary mt-4"
        onClick={() => {
          signOut();
          navigate('/auth', { replace: true });
        }}
      >
        <LogOut size={18} />
        Sign out
      </button>
    </PageShell>
  );
}
