import { useState } from 'react';
import { X, Eye, EyeOff, Compass, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { login, signup } from '../api/auth';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSuccess: () => void;
  onToggleMode: () => void;
}

export function AuthModal({ mode, onClose, onSuccess, onToggleMode }: AuthModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'signin') await login(email, password);
      else await signup(name, email, password);
      setIsLoading(false);
      onSuccess();
    } catch (error) {
      setIsLoading(false);
      setError(error instanceof Error ? error.message : 'Authentication failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#2C2418]/65 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl flex min-h-[520px]">
        <div className="hidden md:flex md:w-1/2 relative flex-col justify-between p-10">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1595195253172-f4e9dc4e322a?w=800&auto=format&fit=crop"
            alt="Palestinian mountains"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#630E13]/80 via-[#630E13]/55 to-[#2C2418]/70" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#D4A843' }}>
                <Compass className="w-5 h-5 text-white" />
              </div>
              <span className="text-white text-xl font-semibold">Traces</span>
            </div>
            <p className="text-white/70 text-sm">تريسز</p>
          </div>
          <div className="relative z-10">
            <blockquote className="text-white text-lg leading-relaxed mb-4">
              "Every trail tells the story of this land. Walk it, remember it, share it."
            </blockquote>
            <p className="text-white/60 text-sm">— Palestine Trail Network</p>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#EFEAE2] transition-colors text-[#6B5D4E]"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-8">
            <h2 className="text-[#2C2418] mb-2">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-[#6B5D4E] text-sm">
              {mode === 'signin'
                ? 'Sign in to continue exploring Palestinian trails'
                : 'Join thousands of hikers discovering Palestine'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-[#2C2418] mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A6A]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ahmad Khalil"
                    className="w-full pl-10 pr-4 py-3 border border-[#C4B896]/50 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent bg-[#fbfaf8] text-[#2C2418]"
                    style={{ '--tw-ring-color': '#630E13' } as React.CSSProperties}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#2C2418] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A6A]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ahmad@example.com"
                  className="w-full pl-10 pr-4 py-3 border border-[#C4B896]/50 rounded-xl focus:outline-none bg-[#fbfaf8] text-[#2C2418]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2C2418] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A6A]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 border border-[#C4B896]/50 rounded-xl focus:outline-none bg-[#fbfaf8] text-[#2C2418]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7A6A] hover:text-[#630E13]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button type="button" className="text-sm hover:underline" style={{ color: '#630E13' }}>
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#630E13' }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#C4B896]/35 text-center">
            <p className="text-sm text-[#6B5D4E]">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={onToggleMode}
                className="font-medium hover:underline"
                style={{ color: '#630E13' }}
              >
                {mode === 'signin' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
