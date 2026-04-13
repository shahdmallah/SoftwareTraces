import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    navigate('/app/map');
  };

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Top decoration */}
      <div
        className="relative flex-shrink-0"
        style={{ height: 200, overflow: 'hidden' }}
      >
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #3D0A0C 0%, #630E13 50%, #7A1215 100%)' }}
        />

        {/* Back button */}
        <button
          onClick={() => navigate('/onboarding')}
          className="absolute top-8 left-4 p-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          <ArrowLeft size={18} color="white" />
        </button>

        {/* Logo */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-1">
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
            {mode === 'signin' ? 'أهلاً وسهلاً — Welcome back' : 'انضم إلينا — Join us today'}
          </p>
        </div>
      </div>

      {/* Form area */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Tab toggle */}
        <div
          className="flex mb-5 rounded-xl overflow-hidden"
          style={{ background: '#D4CBAF', padding: 4, borderRadius: 12 }}
        >
          {(['signin', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: 'none',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: mode === m ? '#630E13' : 'transparent',
                color: mode === m ? 'white' : '#6B5D4E',
              }}
            >
              {m === 'signin' ? 'تسجيل الدخول' : 'حساب جديد'}
            </button>
          ))}
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Name field for signup */}
          {mode === 'signup' && (
            <div className="mb-3">
              <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 4 }}>
                الاسم الكامل — Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="أدخل اسمك — Enter your name"
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #C4B896',
                  background: 'white',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 14,
                  color: '#2C2418',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Email */}
          <div className="mb-3">
            <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 4 }}>
              البريد الإلكتروني — Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '13px 14px',
                borderRadius: 12,
                border: '1.5px solid #C4B896',
                background: 'white',
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                color: '#2C2418',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: '#6B5D4E', display: 'block', marginBottom: 4 }}>
              كلمة المرور — Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '13px 44px 13px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #C4B896',
                  background: 'white',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  color: '#2C2418',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={18} color="#999" /> : <Eye size={18} color="#999" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: 14,
              border: 'none',
              background: '#630E13',
              color: 'white',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: 16,
              boxShadow: '0 4px 16px rgba(99,14,19,0.35)',
            }}
          >
            {mode === 'signin' ? 'دخول — Sign In' : 'إنشاء حساب — Create Account'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div style={{ flex: 1, height: 1, background: '#C4B896' }} />
            <span style={{ fontSize: 12, color: '#9E8E80' }}>أو — or</span>
            <div style={{ flex: 1, height: 1, background: '#C4B896' }} />
          </div>

          {/* Social login */}
          <div className="flex gap-3 mb-5">
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: '1.5px solid #C4B896',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: '#2C2418',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
                <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/>
                <path d="M4.51 10.52A4.8 4.8 0 014.26 9c0-.53.09-1.04.25-1.52V5.41H1.83A8 8 0 001 9c0 1.3.31 2.52.83 3.59l2.68-2.07z" fill="#FBBC05"/>
                <path d="M8.98 3.58c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.51 7.48c.63-1.89 2.39-3.9 4.47-3.9z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 12,
                border: '1.5px solid #C4B896',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: '#2C2418',
              }}
            >
              <svg width="16" height="18" viewBox="0 0 814 1000">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.6 58 290.7 58 282.6c0-197.2 167-245.7 164-246.6C236.2 32.7 254 21.3 266.4 14c22.4-13.4 70.2-24.5 100.6-24.5 27.4 0 73.6 10.2 103.7 39C508.8 64.2 535.6 68 549.7 68c10.3 0 58.5-7.7 101.4-38.8 50.7-36.1 73-29.5 81.6-32.6 7-2.5 26.1-1.3 33.2 5.3l-74 128.1c-5.9 10.3-11.7 24.2-11.7 43.2 0 10.7 2.6 21.2 7.9 32.5 19.2 40.8 83.2 74.2 83.2 74.2-19.2 62.2-101.1 140.8-158.9 194.1-38.2 35-73.9 52.8-109.5 52.8-35.1 0-56.2-20.8-130.4-20.8-72 0-95.4 21.2-128.7 21.2-33.3 0-60.3-15.2-101.1-57.7z" fill="#000"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Guest */}
          <button
            onClick={() => navigate('/app/map')}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: '1.5px solid #C4B896',
              background: 'transparent',
              fontFamily: 'Cairo, sans-serif',
              fontSize: 13,
              color: '#8A7A6A',
              cursor: 'pointer',
            }}
          >
            تصفح بدون حساب — Browse as Guest
          </button>
        </motion.div>
      </div>
    </div>
  );
}