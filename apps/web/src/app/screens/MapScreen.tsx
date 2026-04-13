import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Layers, Navigation, AlertTriangle, Sun, Moon, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PalestineMap } from '../components/PalestineMap';
import { trails, prayerTimes, type Trail } from '../data/trails';

const filters = [
  { id: 'all', labelAr: 'الكل', label: 'All' },
  { id: 'easy', labelAr: 'سهل', label: 'Easy' },
  { id: 'moderate', labelAr: 'متوسط', label: 'Moderate' },
  { id: 'hard', labelAr: 'صعب', label: 'Hard' },
  { id: 'water', labelAr: 'مياه', label: 'Water' },
];

const difficultyColor: Record<string, string> = {
  Easy: '#7A9A3A',
  Moderate: '#D4A843',
  Hard: '#BB2823',
  Expert: '#630E13',
};

export function MapScreen() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [ramadanMode, setRamadanMode] = useState(false);
  const [showPrayer, setShowPrayer] = useState(false);

  const filteredTrails = trails.filter(t => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'easy') return t.difficulty === 'Easy';
    if (selectedFilter === 'moderate') return t.difficulty === 'Moderate';
    if (selectedFilter === 'hard') return t.difficulty === 'Hard';
    if (selectedFilter === 'water') return t.features.some(f => f.toLowerCase().includes('water') || f.toLowerCase().includes('spring') || f.toLowerCase().includes('sea'));
    return true;
  });

  const handleTrailSelect = (trail: Trail) => {
    setSelectedTrail(trail);
    setShowSheet(true);
  };

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#EAE2CC' }}>
      {/* TOP BAR */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-3 pt-3 pb-2"
        style={{ background: 'linear-gradient(to bottom, rgba(234,226,204,0.98) 0%, rgba(234,226,204,0.82) 80%, transparent 100%)' }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-1">
            <svg width="22" height="22" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="10" fill="#630E13" />
              <path d="M11 19 C7 15 6 8 10 5 C14 8 15 15 11 19Z" fill="#F5A0A0" />
              <circle cx="11" cy="5" r="2" fill="#D4A843" />
            </svg>
            <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 18, fontWeight: 800, color: '#2C2418' }}>مسارات</span>
          </div>

          {/* Prayer times button */}
          <button
            onClick={() => setShowPrayer(!showPrayer)}
            style={{
              padding: '6px 10px',
              borderRadius: 20,
              border: '1px solid rgba(44,36,24,0.15)',
              background: showPrayer ? '#630E13' : 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            <Sun size={14} color={showPrayer ? 'white' : '#D4A843'} />
            <span style={{ fontSize: 11, fontFamily: 'Cairo', color: showPrayer ? 'white' : '#2C2418' }}>الصلاة</span>
          </button>

          {/* Ramadan toggle */}
          <button
            onClick={() => setRamadanMode(!ramadanMode)}
            style={{
              padding: '6px 10px',
              borderRadius: 20,
              border: '1px solid rgba(44,36,24,0.15)',
              background: ramadanMode ? '#D4A843' : 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}
          >
            <Moon size={14} color={ramadanMode ? 'white' : '#D4A843'} />
            <span style={{ fontSize: 11, fontFamily: 'Cairo', color: ramadanMode ? 'white' : '#2C2418' }}>رمضان</span>
          </button>
        </div>

        {/* Search bar */}
        <div
          style={{
            background: 'white',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            gap: 8,
            boxShadow: '0 2px 8px rgba(44,36,24,0.1)',
            border: '1px solid rgba(44,36,24,0.08)',
            marginBottom: 8,
          }}
        >
          <Search size={16} color="#9E8E80" />
          <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 14, color: '#B0A090', flex: 1 }}>
            ابحث عن مسار — Search trails
          </span>
          <Layers size={16} color="#9E8E80" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: 20,
                border: selectedFilter === f.id ? 'none' : '1px solid rgba(44,36,24,0.15)',
                background: selectedFilter === f.id ? '#630E13' : 'white',
                color: selectedFilter === f.id ? 'white' : '#6B5D4E',
                fontFamily: 'Cairo, sans-serif',
                fontSize: 12,
                fontWeight: selectedFilter === f.id ? 700 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.labelAr}
            </button>
          ))}
        </div>
      </div>

      {/* Prayer times overlay */}
      <AnimatePresence>
        {showPrayer && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ position: 'absolute', zIndex: 30, top: 130, left: 12, right: 12, background: 'white', borderRadius: 16, padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#2C2418' }}>أوقات الصلاة — Prayer Times</span>
              <span style={{ fontSize: 11, color: '#9E8E80' }}>القدس • Jerusalem</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { name: 'الفجر', time: prayerTimes.fajr },
                { name: 'الظهر', time: prayerTimes.dhuhr },
                { name: 'العصر', time: prayerTimes.asr },
                { name: 'المغرب', time: prayerTimes.maghrib },
                { name: 'العشاء', time: prayerTimes.isha },
              ].map(p => (
                <div key={p.name} style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, background: '#EAE2CC' }}>
                  <div style={{ fontSize: 10, color: '#9E8E80', fontFamily: 'Cairo' }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: '#630E13', fontWeight: 700, fontFamily: 'Inter' }}>{p.time}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ramadan mode banner */}
      {ramadanMode && (
        <div
          style={{ position: 'absolute', zIndex: 20, top: 130, left: 12, right: 12, background: 'linear-gradient(135deg, #D4A843, #B8902E)', borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Moon size={16} color="white" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Cairo' }}>وضع رمضان مفعّل</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: 'Cairo' }}>الإفطار: {prayerTimes.maghrib} • مسارات مسائية متاحة</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div
        className="absolute inset-0"
        style={{ top: 130, zIndex: 1 }}
      >
        <PalestineMap
          onTrailSelect={handleTrailSelect}
          selectedTrailId={selectedTrail?.id}
          height={480}
        />
      </div>

      {/* Location FAB */}
      <button
        style={{
          position: 'absolute',
          bottom: showSheet ? 250 : 16,
          right: 14,
          zIndex: 25,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: 'white',
          border: '1px solid rgba(44,36,24,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          transition: 'bottom 0.3s',
        }}
      >
        <Navigation size={20} color="#630E13" />
      </button>

      {/* Checkpoint alert */}
      {selectedTrail?.hasCheckpoint && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ position: 'absolute', zIndex: 25, bottom: showSheet ? 340 : 70, left: 14, right: 14 }}
        >
          <div style={{ background: '#FFF3E0', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8, border: '1px solid #D4A843' }}>
            <AlertTriangle size={16} color="#BB2823" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#BB2823', fontFamily: 'Cairo' }}>تنبيه: نقطة تفتيش</div>
              <div style={{ fontSize: 10, color: '#5D4037', fontFamily: 'Cairo' }}>{selectedTrail.checkpointNote}</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bottom trail sheet */}
      <AnimatePresence>
        {showSheet && selectedTrail && (
          <motion.div
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-30"
            style={{
              background: 'white',
              borderRadius: '20px 20px 0 0',
              padding: '0 0 16px',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.15)',
              maxHeight: 280,
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#C4B896' }} />
            </div>

            <div className="flex gap-3 px-4 pb-3">
              <img
                src={selectedTrail.image}
                alt={selectedTrail.name}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: 'Cairo', fontSize: 16, fontWeight: 800, color: '#2C2418' }}>{selectedTrail.nameAr}</div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: '#9E8E80', marginBottom: 6 }}>{selectedTrail.name}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: difficultyColor[selectedTrail.difficulty] + '20', color: difficultyColor[selectedTrail.difficulty], fontWeight: 700, fontFamily: 'Cairo' }}>
                    {selectedTrail.difficulty === 'Easy' ? 'سهل' : selectedTrail.difficulty === 'Moderate' ? 'متوسط' : selectedTrail.difficulty === 'Hard' ? 'صعب' : 'خبير'}
                  </span>
                  <span style={{ fontSize: 11, color: '#9E8E80', fontFamily: 'Inter' }}>⭐ {selectedTrail.rating}</span>
                  <span style={{ fontSize: 11, color: '#9E8E80', fontFamily: 'Inter' }}>{selectedTrail.distance} km</span>
                </div>
              </div>
              <button onClick={() => setShowSheet(false)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <ChevronUp size={20} color="#9E8E80" />
              </button>
            </div>

            {/* Stats row */}
            <div className="flex px-4 gap-3 mb-3">
              {[
                { labelAr: 'المسافة', value: `${selectedTrail.distance}km` },
                { labelAr: 'المدة', value: selectedTrail.duration },
                { labelAr: 'الارتفاع', value: `${selectedTrail.elevationGain}m` },
              ].map(s => (
                <div key={s.labelAr} style={{ flex: 1, textAlign: 'center', background: '#EAE2CC', borderRadius: 10, padding: '6px 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#5B6435', fontFamily: 'Inter' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#9E8E80', fontFamily: 'Cairo' }}>{s.labelAr}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex gap-2 px-4">
              <button
                onClick={() => navigate(`/trail/${selectedTrail.id}`)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 12,
                  background: '#630E13',
                  border: 'none',
                  color: 'white',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                تفاصيل المسار
              </button>
              <button
                onClick={() => navigate('/recording')}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#D4A843',
                  border: 'none',
                  color: 'white',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ابدأ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nearby trails bottom pill (when no trail selected) */}
      {!showSheet && (
        <div
          style={{ position: 'absolute', bottom: 16, left: 16, right: 16, zIndex: 20 }}
        >
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            <Navigation size={16} color="#630E13" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2418', fontFamily: 'Cairo' }}>{filteredTrails.length} مسار قريب منك</div>
              <div style={{ fontSize: 10, color: '#9E8E80', fontFamily: 'Cairo' }}>اضغط على علامة لتفاصيل المسار</div>
            </div>
            <div style={{ display: 'flex' }}>
              {filteredTrails.slice(0, 3).map(t => (
                <img key={t.id} src={t.image} style={{ width: 28, height: 28, borderRadius: 14, border: '2px solid white', objectFit: 'cover', marginLeft: -6 }} alt={t.name} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}