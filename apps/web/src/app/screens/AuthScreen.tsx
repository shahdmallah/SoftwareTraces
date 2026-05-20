import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark, PageShell } from '../components/web';
import { clearSession, login, persistSession, signup } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';

export function AuthScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const requestedMode = new URLSearchParams(location.search).get('mode');
    if (requestedMode === 'signup' || requestedMode === 'signin') {
      setMode(requestedMode);
      setError('');
    }
  }, [location.search]);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password.trim() || (mode === 'signup' && !trimmedName)) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        await signup({ email: trimmedEmail, password, full_name: trimmedName });
      }

      const session = await login({ email: trimmedEmail, password });
      persistSession(session);
      setSession(session);
      navigate('/app/explore');
    } catch (requestError) {
      clearSession();
      setSession(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-frame">
      <PageShell compact>
        <header className="toolbar mb-6 justify-between">
          <BrandMark />
          <Link className="btn btn-secondary" to="/app/explore">
            Continue as guest
          </Link>
        </header>

        <section className="form-card auth-card">
          <div>
            <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
            <p className="text-muted-foreground">Use your Traces account.</p>
          </div>

          <div className="toolbar">
            <button className={`chip ${mode === 'signin' ? 'active' : ''}`} onClick={() => setMode('signin')} type="button">
              Sign in
            </button>
            <button className={`chip ${mode === 'signup' ? 'active' : ''}`} onClick={() => setMode('signup')} type="button">
              Sign up
            </button>
          </div>

          {mode === 'signup' ? (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="search-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button className="btn btn-ghost !min-h-0 !p-1" onClick={() => setShowPassword((value) => !value)} type="button" aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error ? <div className="alert">{error}</div> : null}

          <button className="btn btn-primary w-full" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </section>
      </PageShell>
    </div>
  );
}
