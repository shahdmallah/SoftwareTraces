import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Pause, Play, Square, AlertTriangle, Navigation, Activity, TrendingUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type RecordingState = 'recording' | 'paused' | 'stopped';

const gpxPoints: [number, number][] = [
  [220, 150], [225, 165], [230, 180], [238, 195], [245, 210],
  [250, 225], [248, 240], [242, 255], [235, 265], [230, 278],
];

export function RecordingScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecordingState>('recording');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [elevation, setElevation] = useState(324);
  const [showSOS, setShowSOS] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [trackPoints, setTrackPoints] = useState<[number, number][]>([[220, 150]]);
  const [currentPos, setCurrentPos] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state === 'recording') {
      intervalRef.current = setInterval(() => {
        setElapsed(e => e + 1);
        setDistance(d => +(d + 0.003).toFixed(3));
        setElevation(e => e + Math.round((Math.random() - 0.4) * 3));
        setCurrentPos(p => {
          const next = Math.min(p + 1, gpxPoints.length - 1);
          if (next > p) setTrackPoints(pts => [...pts, gpxPoints[next]]);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pace = distance > 0 ? (elapsed / 60) / distance : 0;
  const paceStr = pace > 0 ? `${Math.floor(pace)}:${Math.round((pace % 1) * 60).toString().padStart(2, '0')}` : '--:--';

  const polyline = trackPoints.map(p => p.join(',')).join(' ');

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#1A0608', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Map Area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Terrain map background */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 390 400" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="mapBg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#2A0E10" />
              <stop offset="100%" stopColor="#160608" />
            </radialGradient>
          </defs>
          <rect width="390" height="400" fill="url(#mapBg)" />
          {/* Terrain contour lines */}
          <path d="M0,200 Q100,180 200,195 Q300,210 390,190" fill="none" stroke="#630E13" strokeWidth="1" opacity="0.35" />
          <path d="M0,220 Q100,200 200,215 Q300,230 390,210" fill="none" stroke="#630E13" strokeWidth="1" opacity="0.25" />
          <path d="M0,240 Q100,220 200,235 Q300,250 390,230" fill="none" stroke="#630E13" strokeWidth="1" opacity="0.18" />
          <path d="M0,160 Q100,140 200,155 Q300,170 390,150" fill="none" stroke="#630E13" strokeWidth="1" opacity="0.25" />
          <path d="M0,180 Q120,160 200,175 Q280,190 390,170" fill="none" stroke="#630E13" strokeWidth="1" opacity="0.2" />
          {/* Roads */}
          <path d="M50,350 Q120,300 200,250 Q280,200 350,150" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <path d="M0,250 Q100,230 200,240 Q300,250 390,240" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          {/* Grid lines */}
          {[50, 100, 150, 200, 250, 300, 350].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="400" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          ))}
          {[50, 100, 150, 200, 250, 300, 350].map(y => (
            <line key={y} x1="0" y1={y} x2="390" y2={y} stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
          ))}
          {/* Recorded track */}
          {trackPoints.length > 1 && (
            <polyline points={polyline} fill="none" stroke="#BB2823" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {/* Track glow */}
          {trackPoints.length > 1 && (
            <polyline points={polyline} fill="none" stroke="#BB2823" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
          )}
          {/* Current position */}
          <circle
            cx={trackPoints[trackPoints.length - 1]?.[0] || 220}
            cy={trackPoints[trackPoints.length - 1]?.[1] || 150}
            r="12"
            fill="rgba(187,40,35,0.25)"
          />
          <circle
            cx={trackPoints[trackPoints.length - 1]?.[0] || 220}
            cy={trackPoints[trackPoints.length - 1]?.[1] || 150}
            r="6"
            fill="white"
            stroke="#BB2823"
            strokeWidth="2.5"
          />
          {/* Start point */}
          <circle cx="220" cy="150" r="5" fill="#D4A843" />
          <text x="228" y="148" fontSize="8" fill="rgba(255,255,255,0.7)" fontFamily="Inter">Start</text>
        </svg>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/app/map')}
              style={{ width: 34, height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.15)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{
              width: 10, height: 10, borderRadius: 5,
              background: state === 'recording' ? '#BB2823' : state === 'paused' ? '#D4A843' : '#630E13',
              boxShadow: state === 'recording' ? '0 0 0 3px rgba(187,40,35,0.3)' : 'none',
            }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontFamily: 'Cairo' }}>
              {state === 'recording' ? 'جارٍ التسجيل' : state === 'paused' ? 'متوقف مؤقتاً' : 'تم الإيقاف'}
            </span>
          </div>
          {/* SOS button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSOS(true)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              background: '#630E13',
              border: '1px solid #BB2823',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Inter',
              boxShadow: '0 2px 8px rgba(187,40,35,0.45)',
            }}
          >
            🆘 SOS
          </motion.button>
        </div>

        {/* Compass */}
        <div className="absolute bottom-4 right-4">
          <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Navigation size={20} color="white" />
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      <div
        style={{
          background: '#0D0608',
          borderRadius: '24px 24px 0 0',
          padding: '20px 16px 16px',
          flexShrink: 0,
        }}
      >
        {/* Elapsed time */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 44, fontWeight: 300, color: 'white', fontFamily: 'Inter', letterSpacing: 2 }}>
            {formatTime(elapsed)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Cairo' }}>الوقت المنقضي</div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { icon: Navigation, value: `${distance.toFixed(2)}`, unit: 'km', labelAr: 'المسافة', color: '#7A9A3A' },
            { icon: Activity, value: paceStr, unit: 'دقيقة/كم', labelAr: 'الوتيرة', color: '#D4A843' },
            { icon: TrendingUp, value: `${elevation}`, unit: 'm', labelAr: 'الارتفاع', color: '#7DB3CC' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.labelAr}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 14,
                  padding: '12px 8px',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon size={16} color={stat.color} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, color: 'white', fontFamily: 'Inter' }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'Cairo', marginTop: 2 }}>{stat.unit}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'Cairo' }}>{stat.labelAr}</div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-5">
          {/* Stop button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowStop(true)}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              background: 'rgba(187,40,35,0.15)',
              border: '2px solid rgba(187,40,35,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Square size={22} color="#BB2823" fill="#BB2823" />
          </motion.button>

          {/* Play/Pause main button */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setState(s => s === 'recording' ? 'paused' : 'recording')}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: state === 'recording'
                ? 'linear-gradient(135deg, #630E13, #BB2823)'
                : 'linear-gradient(135deg, #B8902E, #D4A843)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: state === 'recording'
                ? '0 4px 20px rgba(99,14,19,0.55)'
                : '0 4px 20px rgba(212,168,67,0.55)',
            }}
          >
            {state === 'recording'
              ? <Pause size={30} color="white" fill="white" />
              : <Play size={30} color="white" fill="white" />
            }
          </motion.button>

          {/* Live indicator */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              background: 'rgba(212,168,67,0.12)',
              border: '2px solid rgba(212,168,67,0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={16} color="#D4A843" />
            <span style={{ fontSize: 9, color: '#D4A843', fontFamily: 'Inter', marginTop: 2 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* SOS Modal */}
      <AnimatePresence>
        {showSOS && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)', zIndex: 50 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{ background: 'white', borderRadius: 24, padding: 24, margin: 24, width: '100%' }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🆘</div>
                <h2 style={{ fontFamily: 'Cairo', fontSize: 20, fontWeight: 800, color: '#630E13' }}>نداء الطوارئ</h2>
                <p style={{ fontFamily: 'Cairo', fontSize: 13, color: '#5D4037', marginTop: 4 }}>Emergency SOS</p>
              </div>
              <div style={{ background: '#FFF0EE', borderRadius: 12, padding: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color="#BB2823" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 12, color: '#BB2823', fontFamily: 'Cairo', lineHeight: 1.6 }}>
                  سيتم مشاركة موقعك الحالي مع خدمات الطوارئ وجهات الاتصال المحددة.
                  <br />Your location will be shared with emergency services and designated contacts.
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSOS(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid #C4B896', background: 'white', fontFamily: 'Cairo', fontSize: 14, cursor: 'pointer', color: '#6B5D4E' }}
                >
                  إلغاء
                </button>
                <button
                  onClick={() => setShowSOS(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#BB2823', color: 'white', fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  🆘 إرسال SOS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stop Confirm Modal */}
      <AnimatePresence>
        {showStop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-end"
            style={{ background: 'rgba(0,0,0,0.75)', zIndex: 50 }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', width: '100%' }}
            >
              <div style={{ fontFamily: 'Cairo', fontSize: 18, fontWeight: 800, color: '#2C2418', marginBottom: 6 }}>
                إيقاف التسجيل؟
              </div>
              <p style={{ fontFamily: 'Cairo', fontSize: 13, color: '#6B5D4E', marginBottom: 20 }}>
                سيتم حفظ رحلتك. المسافة: {distance.toFixed(2)}km • الوقت: {formatTime(elapsed)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStop(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: '1px solid #C4B896', background: 'white', fontFamily: 'Cairo', fontSize: 14, cursor: 'pointer', color: '#6B5D4E' }}
                >
                  متابعة التسجيل
                </button>
                <button
                  onClick={() => navigate('/app/history')}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#5B6435', color: 'white', fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                >
                  حفظ وإيقاف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}