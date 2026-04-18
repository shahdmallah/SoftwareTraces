import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Settings, Globe, Moon, Bell, Shield, ChevronRight, LogOut, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const achievements = [
  { id: 'a1', emoji: '🦅', nameAr: 'صقر الجبال', name: 'Mountain Hawk', desc: 'Completed 5 hard trails', earned: true },
  { id: 'a2', emoji: '🫒', nameAr: 'حارس الزيتون', name: 'Olive Guardian', desc: 'Walked through 3 olive groves', earned: true },
  { id: 'a3', emoji: '🌊', nameAr: 'ابن البحر الميت', name: 'Dead Sea Child', desc: 'Hiked at -430m elevation', earned: true },
  { id: 'a4', emoji: '⭐', nameAr: 'نجم الفجر', name: 'Dawn Star', desc: 'Started a hike before sunrise', earned: true },
  { id: 'a5', emoji: '🗺️', nameAr: 'المستكشف', name: 'Explorer', desc: 'Visited 10 different regions', earned: false },
  { id: 'a6', emoji: '🏆', nameAr: 'بطل المسارات', name: 'Trail Champion', desc: 'Complete 20 trails', earned: false },
  { id: 'a7', emoji: '🌙', nameAr: 'محارب رمضان', name: 'Ramadan Warrior', desc: 'Complete an iftar trail', earned: false },
  { id: 'a8', emoji: '🤝', nameAr: 'الجماعة', name: 'Community', desc: 'Join 3 group hikes', earned: false },
];

const settings = [
  { id: 's1', icon: Globe, labelAr: 'اللغة', label: 'Language', value: 'العربية / English', hasToggle: false },
  { id: 's2', icon: Moon, labelAr: 'وضع رمضان', label: 'Ramadan Mode', value: '', hasToggle: true },
  { id: 's3', icon: Bell, labelAr: 'الإشعارات', label: 'Notifications', value: 'مفعّل', hasToggle: false },
  { id: 's4', icon: Shield, labelAr: 'الخصوصية', label: 'Privacy', value: '', hasToggle: false },
  { id: 's5', icon: Settings, labelAr: 'الإعدادات العامة', label: 'General Settings', value: '', hasToggle: false },
];

export function ProfileScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, signOut, user } = useAuth();
  const [ramadanMode, setRamadanMode] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const displayName = user?.full_name?.trim() || user?.email || '';
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'TR';
  }, [displayName]);

  if (!isAuthenticated || !user) {
    return (
      <div
        className="relative w-full h-full flex flex-col items-center justify-center px-6 text-center"
        style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
            background: 'linear-gradient(135deg, #630E13, #BB2823)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 10px 28px rgba(99,14,19,0.18)',
          }}
        >
          <span style={{ fontSize: 34, color: 'white' }}>?</span>
        </div>
        <h1 style={{ color: '#2C2418', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          No user logged in
        </h1>
        <p style={{ color: '#6B5D4E', fontSize: 14, lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
          Create an account to save your trails, unlock achievements, and personalize your profile.
        </p>
        <button
          onClick={() => navigate('/auth?mode=signup')}
          style={{
            width: '100%',
            maxWidth: 280,
            padding: '14px 18px',
            borderRadius: 14,
            border: 'none',
            background: '#630E13',
            color: 'white',
            fontFamily: 'Cairo, sans-serif',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(99,14,19,0.24)',
          }}
        >
          Go to Sign Up
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div
          style={{
            background: 'linear-gradient(160deg, #3D0A0C 0%, #630E13 60%, #7A1215 100%)',
            padding: '24px 16px 0',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Olive branch decoration */}
          <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.08 }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <ellipse cx="60" cy="60" rx="55" ry="55" fill="#D4A843" />
              <path d="M60 100 C40 80 35 50 55 30 C75 50 80 80 60 100Z" fill="#F5A0A0" />
              <path d="M60 100 C50 75 35 60 25 60 C35 75 50 90 60 100Z" fill="#BB2823" />
            </svg>
          </div>

          {/* Avatar + info */}
          <div className="flex items-end gap-4 mb-4">
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 78, height: 78, borderRadius: 39,
                background: 'linear-gradient(135deg, #D4A843, #B8902E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid rgba(255,255,255,0.4)',
              }}>
                <span style={{ fontSize: 28, fontFamily: 'Cairo', fontWeight: 800, color: 'white' }}>{initials}</span>
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, background: '#7A9A3A', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10 }}>✓</span>
              </div>
            </div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <h1 style={{ fontFamily: 'Cairo', fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 2 }}>{displayName}</h1>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{user.email}</p>
              <p style={{ fontFamily: 'Cairo', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>رام الله، فلسطين 🇵🇸</p>
            </div>
            <button
              style={{ padding: '7px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', color: 'white', fontFamily: 'Cairo', fontSize: 12, cursor: 'pointer', marginBottom: 8 }}
            >
              تعديل
            </button>
          </div>

          {/* Stats bar */}
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '14px 14px 0 0', padding: '12px 0', display: 'flex' }}>
            {[
              { value: '36.0', unit: 'km', labelAr: 'إجمالي المسافة' },
              { value: '4', unit: 'رحلة', labelAr: 'رحلات مكتملة' },
              { value: '4', unit: 'شارة', labelAr: 'الإنجازات' },
            ].map((s, i) => (
              <div key={s.labelAr} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 800, color: 'white' }}>
                  {s.value} <span style={{ fontSize: 12, fontWeight: 400 }}>{s.unit}</span>
                </div>
                <div style={{ fontFamily: 'Cairo', fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{s.labelAr}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Thin accent divider */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #630E13, #BB2823, #630E13, #BB2823, #630E13)' }} />

        {/* Achievements */}
        <div style={{ padding: '14px 16px' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award size={16} color="#D4A843" />
              <span style={{ fontFamily: 'Cairo', fontSize: 15, fontWeight: 700, color: '#2C2418' }}>الإنجازات — Achievements</span>
            </div>
            <span style={{ fontFamily: 'Cairo', fontSize: 12, color: '#8A7A6A' }}>4/{achievements.length}</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {achievements.map(a => (
              <div
                key={a.id}
                style={{
                  textAlign: 'center',
                  opacity: a.earned ? 1 : 0.35,
                  cursor: 'default',
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: '0 auto 4px',
                  background: a.earned ? 'linear-gradient(135deg, #FFF8E1, #FFF3CD)' : '#D4CBAF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: a.earned ? '2px solid #D4A843' : '2px solid #C4B896',
                  boxShadow: a.earned ? '0 2px 8px rgba(212,168,67,0.3)' : 'none',
                  fontSize: 26,
                }}>
                  {a.emoji}
                </div>
                <div style={{ fontFamily: 'Cairo', fontSize: 10, color: '#2C2418', lineHeight: 1.3 }}>{a.nameAr}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Language Toggle */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ background: 'white', borderRadius: 14, padding: '10px 14px', boxShadow: '0 1px 6px rgba(44,36,24,0.06)' }}>
            <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#2C2418', marginBottom: 8 }}>اللغة — Language</div>
            <div style={{ display: 'flex', gap: 8, background: '#EAE2CC', borderRadius: 10, padding: 4 }}>
              <button
                onClick={() => setLang('ar')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: lang === 'ar' ? '#630E13' : 'transparent',
                  color: lang === 'ar' ? 'white' : '#6B5D4E',
                  fontFamily: 'Cairo', fontSize: 13, fontWeight: lang === 'ar' ? 700 : 400, cursor: 'pointer',
                }}
              >
                🇵🇸 العربية
              </button>
              <button
                onClick={() => setLang('en')}
                style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                  background: lang === 'en' ? '#630E13' : 'transparent',
                  color: lang === 'en' ? 'white' : '#6B5D4E',
                  fontFamily: 'Cairo', fontSize: 13, fontWeight: lang === 'en' ? 700 : 400, cursor: 'pointer',
                }}
              >
                🌍 English
              </button>
            </div>
          </div>
        </div>

        {/* Settings list */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 6px rgba(44,36,24,0.06)' }}>
            {settings.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px',
                    borderBottom: i < settings.length - 1 ? '1px solid rgba(44,36,24,0.06)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,14,19,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color="#630E13" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Cairo', fontSize: 14, color: '#2C2418' }}>{s.labelAr}</div>
                    <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#8A7A6A' }}>{s.label}</div>
                  </div>
                  {s.hasToggle ? (
                    <button
                      onClick={() => setRamadanMode(!ramadanMode)}
                      style={{
                        width: 44, height: 24, borderRadius: 12,
                        background: ramadanMode ? '#D4A843' : '#C4B896',
                        border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2,
                        left: ramadanMode ? 22 : 2,
                        width: 20, height: 20, borderRadius: 10,
                        background: 'white',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  ) : s.value ? (
                    <span style={{ fontSize: 12, color: '#8A7A6A', fontFamily: 'Cairo' }}>{s.value}</span>
                  ) : (
                    <ChevronRight size={16} color="#8A7A6A" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Logout */}
        <div style={{ padding: '12px 16px 24px' }}>
          <button
            onClick={() => {
              signOut();
              navigate('/auth', { replace: true });
            }}
            style={{
              width: '100%', padding: '14px', borderRadius: 14,
              border: '1px solid rgba(187,40,35,0.25)',
              background: 'rgba(187,40,35,0.05)',
              color: '#BB2823', fontFamily: 'Cairo', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <LogOut size={16} color="#BB2823" />
            تسجيل الخروج — Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
