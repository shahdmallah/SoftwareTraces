import { Outlet, useNavigate, useLocation } from 'react-router';
import { Map, Compass, CircleDot, BookOpen, User } from 'lucide-react';

const tabs = [
  { id: 'map', path: '/app/map', icon: Map, labelAr: 'خريطة', label: 'Map' },
  { id: 'explore', path: '/app/explore', icon: Compass, labelAr: 'استكشاف', label: 'Explore' },
  { id: 'record', path: '/recording', icon: CircleDot, labelAr: 'تسجيل', label: 'Record', isFAB: true },
  { id: 'history', path: '/app/history', icon: BookOpen, labelAr: 'السجل', label: 'History' },
  { id: 'profile', path: '/app/profile', icon: User, labelAr: 'الملف', label: 'Profile' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabs.find(t => location.pathname === t.path)?.id || 'map';

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        <Outlet />
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="flex-shrink-0 flex items-center relative"
        style={{
          background: 'white',
          borderTop: '1px solid rgba(44,36,24,0.08)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 68,
          boxShadow: '0 -4px 20px rgba(44,36,24,0.08)',
        }}
      >
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.isFAB) {
            return (
              <div key={tab.id} className="flex-1 flex justify-center items-center">
                <button
                  onClick={() => navigate(tab.path)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    background: 'linear-gradient(135deg, #630E13, #BB2823)',
                    border: '3px solid white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(99,14,19,0.45)',
                    marginBottom: 16,
                    outline: 'none',
                    position: 'relative',
                    top: -8,
                  }}
                >
                  <Icon size={22} color="white" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                height: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                paddingTop: 8,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'rgba(99,14,19,0.12)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Icon
                  size={20}
                  color={isActive ? '#630E13' : '#9E8E80'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'Cairo, sans-serif',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#630E13' : '#9E8E80',
                }}
              >
                {tab.labelAr}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}