import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, TrendingUp, Navigation, Clock, ChevronRight, Award } from 'lucide-react';
import { motion } from 'motion/react';

const pastHikes = [
  {
    id: 'h1',
    trailId: '1',
    nameAr: 'مسار وادي القلط',
    name: 'Wadi Qelt Trail',
    date: '2026-04-05',
    dateAr: 'السبت، ٥ أبريل ٢٠٢٦',
    distance: 14.2,
    duration: '5h 24m',
    elevationGain: 610,
    image: 'https://images.unsplash.com/photo-1679940640486-967ee217bf8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
  {
    id: 'h2',
    trailId: '3',
    nameAr: 'مدرجات بتير',
    name: 'Battir Terraces',
    date: '2026-03-28',
    dateAr: 'السبت، ٢٨ مارس ٢٠٢٦',
    distance: 9.8,
    duration: '3h 52m',
    elevationGain: 318,
    image: 'https://images.unsplash.com/photo-1722228097356-bd0202d99367?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
  {
    id: 'h3',
    trailId: '6',
    nameAr: 'نجف رام الله',
    name: 'Ramallah Ridge',
    date: '2026-03-21',
    dateAr: 'السبت، ٢١ مارس ٢٠٢٦',
    distance: 6.5,
    duration: '2h 18m',
    elevationGain: 185,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 4,
  },
  {
    id: 'h4',
    trailId: '5',
    nameAr: 'شاطئ البحر الميت',
    name: 'Dead Sea Shore',
    date: '2026-03-14',
    dateAr: 'السبت، ١٤ مارس ٢٠٢٦',
    distance: 5.5,
    duration: '1h 58m',
    elevationGain: 10,
    image: 'https://images.unsplash.com/photo-1715273504630-7c42124bc0ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
    rating: 5,
  },
];

const calendarDays = [
  { d: 1, hasHike: false }, { d: 2, hasHike: false }, { d: 3, hasHike: false },
  { d: 4, hasHike: false }, { d: 5, hasHike: true }, { d: 6, hasHike: false },
  { d: 7, hasHike: false }, { d: 8, hasHike: false }, { d: 9, hasHike: false },
  { d: 10, hasHike: false }, { d: 11, hasHike: false }, { d: 12, hasHike: false },
  { d: 13, hasHike: false }, { d: 14, hasHike: false }, { d: 15, hasHike: false },
  { d: 16, hasHike: false }, { d: 17, hasHike: false }, { d: 18, hasHike: false },
  { d: 19, hasHike: false }, { d: 20, hasHike: false }, { d: 21, hasHike: false },
  { d: 22, hasHike: false }, { d: 23, hasHike: false }, { d: 24, hasHike: false },
  { d: 25, hasHike: false }, { d: 26, hasHike: false }, { d: 27, hasHike: false },
  { d: 28, hasHike: true }, { d: 29, hasHike: false }, { d: 30, hasHike: false },
];

const dayNames = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];

export function HistoryScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');

  const totalDistance = pastHikes.reduce((sum, h) => sum + h.distance, 0);
  const totalDuration = '13h 32m';
  const totalHikes = pastHikes.length;

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ background: '#630E13', padding: '16px 16px 0' }}>
          <h1 style={{ fontFamily: 'Cairo', fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 2 }}>سجل الرحلات</h1>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>Hiking History</p>

          {/* Total stats */}
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '14px 14px 0 0', padding: '14px 16px', display: 'flex', justifyContent: 'space-around' }}>
            {[
              { labelAr: 'إجمالي المسافة', value: `${totalDistance.toFixed(1)}km`, icon: Navigation, color: '#B8CB8A' },
              { labelAr: 'عدد الرحلات', value: `${totalHikes}`, icon: Award, color: '#D4A843' },
              { labelAr: 'إجمالي الوقت', value: totalDuration, icon: Clock, color: '#80DEEA' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.labelAr} style={{ textAlign: 'center' }}>
                  <Icon size={18} color={s.color} style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'white', fontFamily: 'Inter' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontFamily: 'Cairo' }}>{s.labelAr}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thin accent divider */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, #630E13, #BB2823, #630E13, #BB2823, #630E13)' }} />

        {/* Tab toggle */}
        <div style={{ padding: '10px 16px 0', background: '#EAE2CC', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{
              flex: 1, padding: '8px', borderRadius: 10,
              background: activeTab === 'list' ? '#630E13' : 'white',
              border: activeTab === 'list' ? 'none' : '1px solid rgba(44,36,24,0.12)',
              color: activeTab === 'list' ? 'white' : '#6B5D4E',
              fontFamily: 'Cairo', fontSize: 13, fontWeight: activeTab === 'list' ? 700 : 400, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <TrendingUp size={14} />
            القائمة
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            style={{
              flex: 1, padding: '8px', borderRadius: 10,
              background: activeTab === 'calendar' ? '#630E13' : 'white',
              border: activeTab === 'calendar' ? 'none' : '1px solid rgba(44,36,24,0.12)',
              color: activeTab === 'calendar' ? 'white' : '#6B5D4E',
              fontFamily: 'Cairo', fontSize: 13, fontWeight: activeTab === 'calendar' ? 700 : 400, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Calendar size={14} />
            التقويم
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '10px 14px 16px' }}>
        {activeTab === 'list' ? (
          <div>
            {pastHikes.map((hike, index) => (
              <motion.div
                key={hike.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{ display: 'flex', gap: 10, marginBottom: 14 }}
              >
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 6, background: '#630E13', flexShrink: 0, zIndex: 1 }} />
                  {index < pastHikes.length - 1 && (
                    <div style={{ width: 2, flex: 1, background: 'rgba(99,14,19,0.2)', marginTop: 2 }} />
                  )}
                </div>
                {/* Card */}
                <div
                  style={{ flex: 1, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 8px rgba(44,36,24,0.08)', cursor: 'pointer', marginBottom: 4 }}
                  onClick={() => navigate(`/trail/${hike.trailId}`)}
                >
                  <div style={{ display: 'flex', gap: 10, padding: '10px' }}>
                    <img src={hike.image} alt={hike.name} style={{ width: 70, height: 70, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo', marginBottom: 2 }}>{hike.dateAr}</div>
                      <div style={{ fontFamily: 'Cairo', fontSize: 14, fontWeight: 800, color: '#2C2418', marginBottom: 2 }}>{hike.nameAr}</div>
                      <div className="flex gap-2 flex-wrap">
                        <span style={{ fontSize: 11, color: '#630E13', fontFamily: 'Inter', fontWeight: 700 }}>{hike.distance}km</span>
                        <span style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Inter' }}>•</span>
                        <span style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Inter' }}>{hike.duration}</span>
                        <span style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Inter' }}>• ↑{hike.elevationGain}m</span>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#8A7A6A" style={{ flexShrink: 0, alignSelf: 'center' }} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div>
            {/* Calendar */}
            <div style={{ background: 'white', borderRadius: 16, padding: 14, boxShadow: '0 2px 8px rgba(44,36,24,0.08)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'Cairo', fontSize: 15, fontWeight: 700, color: '#2C2418', textAlign: 'center', marginBottom: 12 }}>
                أبريل ٢٠٢٦ — April 2026
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#8A7A6A', fontFamily: 'Cairo' }}>{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty first days */}
                {[1, 2].map(i => <div key={`empty-${i}`} />)}
                {calendarDays.map(day => (
                  <div
                    key={day.d}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      background: day.hasHike ? '#630E13' : day.d === 7 ? '#EAE2CC' : 'transparent',
                      cursor: day.hasHike ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{
                      fontSize: 12, fontFamily: 'Inter',
                      color: day.hasHike ? 'white' : day.d === 7 ? '#5B6435' : '#2C2418',
                      fontWeight: day.hasHike || day.d === 7 ? 700 : 400
                    }}>
                      {day.d}
                    </span>
                    {day.hasHike && <div style={{ width: 4, height: 4, borderRadius: 2, background: '#D4A843', marginTop: 1 }} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly summary */}
            <div style={{ background: 'white', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(44,36,24,0.08)' }}>
              <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#2C2418', marginBottom: 10 }}>ملخص الشهر — Monthly Summary</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { labelAr: 'رحلات هذا الشهر', value: '2', color: '#630E13' },
                  { labelAr: 'المسافة الكلية', value: '24km', color: '#D4A843' },
                  { labelAr: 'أعلى ارتفاع', value: '630m', color: '#7DB3CC' },
                  { labelAr: 'متوسط المدة', value: '4.7h', color: '#BB2823' },
                ].map(s => (
                  <div key={s.labelAr} style={{ background: '#EAE2CC', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: 'Inter' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo', marginTop: 2 }}>{s.labelAr}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}