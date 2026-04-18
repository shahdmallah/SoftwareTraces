import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
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
        await signup({
          email: trimmedEmail,
          password,
          full_name: trimmedName,
        });
      }

      const session = await login({
        email: trimmedEmail,
        password,
      });

      persistSession(session);
      setSession(session);
      navigate('/app/map');
    } catch (requestError) {
      clearSession();
      setSession(null);
      setError(requestError instanceof Error ? requestError.message : 'Unable to authenticate right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldStyle = {
    width: '100%',
    padding: '13px 14px',
    borderRadius: 16,
    border: '1px solid rgba(122,18,21,0.12)',
    background: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    color: '#2C2418',
    outline: 'none',
    boxSizing: 'border-box' as const,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
  };

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top, rgba(212,168,67,0.18), transparent 32%), linear-gradient(180deg, #F3EBD7 0%, #E7DCC0 100%)',
        fontFamily: 'Cairo, Inter, sans-serif',
      }}
    >
      <div
        className="absolute -top-24 -right-16 rounded-full"
        style={{
          width: 220,
          height: 220,
          background: 'rgba(122,18,21,0.08)',
          filter: 'blur(4px)',
        }}
      />
      <div
        className="absolute top-28 -left-20 rounded-full"
        style={{
          width: 180,
          height: 180,
          background: 'rgba(212,168,67,0.12)',
          filter: 'blur(6px)',
        }}
      />

      <div className="relative flex-shrink-0" style={{ height: 220, overflow: 'hidden' }}>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(145deg, #3D0A0C 0%, #630E13 52%, #8E1B1F 100%)' }}
        />

        <button
          onClick={() => navigate('/onboarding')}
          className="absolute left-4 top-8 rounded-full p-2"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          <ArrowLeft size={18} color="white" />
        </button>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            style={{
              color: '#F3D27C',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Trail Community
          </div>

          <div className="mb-1 flex items-center gap-3">
            <svg width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="17" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
              <path d="M18 28 C13 22 11 14 16 9 C21 14 23 22 18 28Z" fill="#F5A0A0" />
              <path d="M18 28 C15 22 11 18 9 18 C12 22 15 26 18 28Z" fill="#BB2823" />
              <circle cx="18" cy="9" r="3" fill="#D4A843" />
            </svg>
            <div>
              <div style={{ color: 'white', fontSize: 26, fontWeight: 800 }}>Traces</div>
              <div style={{ color: '#D4A843', fontSize: 14, marginTop: -4 }}>مسارات</div>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            {mode === 'signin' ? 'أهلاً وسهلاً - Welcome back' : 'انضم إلينا - Join us today'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div
          className="mb-5 flex overflow-hidden rounded-xl"
          style={{
            background: 'rgba(212, 203, 175, 0.72)',
            padding: 4,
            borderRadius: 16,
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(122,18,21,0.08)',
          }}
        >
          {(['signin', 'signup'] as const).map((screenMode) => (
            <button
              key={screenMode}
              onClick={() => {
                setMode(screenMode);
                setError('');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 12,
                border: 'none',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: mode === screenMode ? '#630E13' : 'transparent',
                color: mode === screenMode ? 'white' : '#6B5D4E',
              }}
            >
              {screenMode === 'signin' ? 'تسجيل الدخول' : 'حساب جديد'}
            </button>
          ))}
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: 'rgba(255,255,255,0.48)',
            border: '1px solid rgba(122,18,21,0.08)',
            borderRadius: 26,
            padding: 18,
            boxShadow: '0 18px 40px rgba(90, 61, 36, 0.12)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <div style={{ color: '#630E13', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </div>
            <div style={{ color: '#7B6A58', fontSize: 13, marginTop: 4 }}>
              {mode === 'signin'
                ? 'Sign in to keep your saved trails, maps, and progress close.'
                : 'Start saving routes, recording hikes, and building your trail history.'}
            </div>
          </div>

          {mode === 'signup' && (
            <div className="mb-3">
              <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 6, fontWeight: 700 }}>
                الاسم الكامل - Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                style={{ ...fieldStyle, fontFamily: 'Cairo, sans-serif' }}
              />
            </div>
          )}

          <div className="mb-3">
            <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              البريد الإلكتروني - Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={{ ...fieldStyle, fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          <div className="mb-4">
            <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 6, fontWeight: 700 }}>
              كلمة المرور - Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ ...fieldStyle, fontFamily: 'Inter, sans-serif', padding: '13px 44px 13px 14px' }}
              />
              <button
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} color="#999" /> : <Eye size={18} color="#999" />}
              </button>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              style={{
                marginBottom: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(187, 40, 35, 0.1)',
                border: '1px solid rgba(187, 40, 35, 0.3)',
                color: '#7A1215',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: 16,
              border: 'none',
              background: '#630E13',
              color: 'white',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              cursor: isSubmitting ? 'wait' : 'pointer',
              marginBottom: 16,
              boxShadow: '0 10px 24px rgba(99,14,19,0.28)',
              opacity: isSubmitting ? 0.75 : 1,
            }}
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'signin'
                ? 'دخول - Sign In'
                : 'إنشاء حساب - Create Account'}
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div style={{ flex: 1, height: 1, background: '#C4B896' }} />
            <span style={{ fontSize: 12, color: '#9E8E80' }}>أو - or</span>
            <div style={{ flex: 1, height: 1, background: '#C4B896' }} />
          </div>

          <div className="mb-5 flex gap-3">
            <button
              type="button"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 14,
                border: '1px solid rgba(122,18,21,0.12)',
                background: 'rgba(255,255,255,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'default',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: '#2C2418',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4" />
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 008.98 17z" fill="#34A853" />
                <path d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 001 9c0 1.3.31 2.52.83 3.59l2.68-2.07z" fill="#FBBC05" />
                <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.51 7.48c.63-1.89 2.39-3.9 4.47-3.9z" fill="#EA4335" />
              </svg>
              Google
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 14,
                border: '1px solid rgba(122,18,21,0.12)',
                background: 'rgba(255,255,255,0.92)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'default',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: '#2C2418',
              }}
            >
              <svg width="16" height="18" viewBox="0 0 814 1000">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.6 58 290.7 58 282.6c0-197.2 167-245.7 164-246.6C236.2 32.7 254 21.3 266.4 14c22.4-13.4 70.2-24.5 100.6-24.5 27.4 0 73.6 10.2 103.7 39C508.8 64.2 535.6 68 549.7 68c10.3 0 58.5-7.7 101.4-38.8 50.7-36.1 73-29.5 81.6-32.6 7-2.5 26.1-1.3 33.2 5.3l-74 128.1c-5.9 10.3-11.7 24.2-11.7 43.2 0 10.7 2.6 21.2 7.9 32.5 19.2 40.8 83.2 74.2 83.2 74.2-19.2 62.2-101.1 140.8-158.9 194.1-38.2 35-73.9 52.8-109.5 52.8-35.1 0-56.2-20.8-130.4-20.8-72 0-95.4 21.2-128.7 21.2-33.3 0-60.3-15.2-101.1-57.7z" fill="#000" />
              </svg>
              Apple
            </button>
          </div>

          <button
            onClick={() => navigate('/app/map')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 14,
              border: '1px solid rgba(122,18,21,0.12)',
              background: 'transparent',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 13,
              color: '#8A7A6A',
              cursor: 'pointer',
            }}
          >
            تصفح بدون حساب - Browse as Guest
          </button>
        </motion.div>
      </div>
    </div>
  );
}
