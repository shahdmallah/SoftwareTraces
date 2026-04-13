import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, SlidersHorizontal, Star, MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import { trails, type Trail } from '../data/trails';

const difficultyFilters = [
  { id: 'all', labelAr: 'الكل', label: 'All' },
  { id: 'Easy', labelAr: 'سهل', label: 'Easy' },
  { id: 'Moderate', labelAr: 'متوسط', label: 'Moderate' },
  { id: 'Hard', labelAr: 'صعب', label: 'Hard' },
];

const lengthFilters = [
  { id: 'all', labelAr: 'أي مسافة', label: 'Any' },
  { id: 'short', labelAr: 'أقل من 7كم', label: '<7km' },
  { id: 'medium', labelAr: '7–12كم', label: '7–12km' },
  { id: 'long', labelAr: 'أكثر من 12كم', label: '>12km' },
];

const featureFilters = [
  { id: 'all', labelAr: 'الكل', label: 'All', emoji: '🏔️' },
  { id: 'water', labelAr: 'مياه', label: 'Water', emoji: '💧' },
  { id: 'historical', labelAr: 'تاريخي', label: 'Historical', emoji: '🏛️' },
  { id: 'olive', labelAr: 'زيتون', label: 'Olive', emoji: '🫒' },
  { id: 'summit', labelAr: 'قمة', label: 'Summit', emoji: '⛰️' },
];

const difficultyColor: Record<string, string> = {
  Easy: '#7A9A3A',
  Moderate: '#D4A843',
  Hard: '#BB2823',
  Expert: '#630E13',
};

const difficultyAr: Record<string, string> = {
  Easy: 'سهل',
  Moderate: 'متوسط',
  Hard: 'صعب',
  Expert: 'خبير',
};

function TrailCard({ trail, onPress }: { trail: Trail; onPress: () => void }) {
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onPress}
      style={{
        background: 'white',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(44,36,24,0.08)',
        cursor: 'pointer',
        marginBottom: 12,
      }}
    >
      {/* Image */}
      <div className="relative" style={{ height: 160 }}>
        <img src={trail.image} alt={trail.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(44,36,24,0.7) 100%)' }} />
        {/* Difficulty badge */}
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '3px 10px',
            borderRadius: 12,
            background: difficultyColor[trail.difficulty],
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'Cairo',
          }}
        >
          {difficultyAr[trail.difficulty]}
        </span>
        {/* Rating */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: '3px 8px' }}>
          <Star size={11} color="#D4A843" fill="#D4A843" />
          <span style={{ fontSize: 11, color: 'white', fontFamily: 'Inter', fontWeight: 700 }}>{trail.rating}</span>
        </div>
        {/* Name on image */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
          <div style={{ fontFamily: 'Cairo', fontSize: 15, fontWeight: 800, color: 'white' }}>{trail.nameAr}</div>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 14px' }}>
        <div className="flex items-center gap-1 mb-2">
          <MapPin size={12} color="#8A7A6A" />
          <span style={{ fontFamily: 'Cairo', fontSize: 11, color: '#8A7A6A' }}>{trail.regionAr}</span>
          <span style={{ fontSize: 11, color: '#C4B896' }}>•</span>
          <span style={{ fontFamily: 'Inter', fontSize: 11, color: '#8A7A6A' }}>{trail.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>{trail.distance}km</div>
              <div style={{ fontSize: 9, color: '#8A7A6A', fontFamily: 'Cairo' }}>المسافة</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>{trail.duration}</div>
              <div style={{ fontSize: 9, color: '#8A7A6A', fontFamily: 'Cairo' }}>المدة</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>↑{trail.elevationGain}m</div>
              <div style={{ fontSize: 9, color: '#8A7A6A', fontFamily: 'Cairo' }}>الارتفاع</div>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end" style={{ maxWidth: 120 }}>
            {trail.featuresAr.slice(0, 2).map((f, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(99,14,19,0.1)', color: '#630E13', fontFamily: 'Cairo' }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ExploreScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [length, setLength] = useState('all');
  const [feature, setFeature] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = trails.filter(t => {
    const searchMatch = !search || t.nameAr.includes(search) || t.name.toLowerCase().includes(search.toLowerCase()) || t.regionAr.includes(search);
    const diffMatch = difficulty === 'all' || t.difficulty === difficulty;
    const lenMatch = length === 'all'
      || (length === 'short' && t.distance < 7)
      || (length === 'medium' && t.distance >= 7 && t.distance <= 12)
      || (length === 'long' && t.distance > 12);
    const featMatch = feature === 'all'
      || t.tags.includes(feature)
      || (feature === 'water' && t.features.some(f => ['Spring', 'Dead Sea', 'River'].some(w => f.includes(w))))
      || (feature === 'historical' && t.tags.includes('historical'))
      || (feature === 'olive' && t.tags.includes('olive'))
      || (feature === 'summit' && t.tags.includes('summit'));
    return searchMatch && diffMatch && lenMatch && featMatch;
  });

  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Header */}
      <div style={{ background: '#630E13', padding: '16px 16px 12px', flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 style={{ fontFamily: 'Cairo', fontSize: 20, fontWeight: 800, color: 'white' }}>استكشاف المسارات</h1>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Explore Trails</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: showFilters ? '#D4A843' : 'rgba(255,255,255,0.2)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={18} color="white" />
          </button>
        </div>
        {/* Search */}
        <div style={{ background: 'white', borderRadius: 12, display: 'flex', alignItems: 'center', padding: '10px 12px', gap: 8 }}>
          <Search size={16} color="#8A7A6A" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن مسار... Search trails"
            style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#2C2418', background: 'transparent' }}
          />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ background: '#D4CBAF', padding: '10px 12px', flexShrink: 0 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo', marginBottom: 4 }}>الصعوبة</div>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {difficultyFilters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setDifficulty(f.id)}
                  style={{
                    flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                    background: difficulty === f.id ? '#630E13' : 'white',
                    border: 'none', color: difficulty === f.id ? 'white' : '#6B5D4E',
                    fontSize: 12, fontFamily: 'Cairo', cursor: 'pointer',
                  }}
                >
                  {f.labelAr}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo', marginBottom: 4 }}>المسافة</div>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {lengthFilters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setLength(f.id)}
                  style={{
                    flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                    background: length === f.id ? '#630E13' : 'white',
                    border: 'none', color: length === f.id ? 'white' : '#6B5D4E',
                    fontSize: 12, fontFamily: 'Cairo', cursor: 'pointer',
                  }}
                >
                  {f.labelAr}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo', marginBottom: 4 }}>المميزات</div>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {featureFilters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFeature(f.id)}
                  style={{
                    flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                    background: feature === f.id ? '#630E13' : 'white',
                    border: 'none', color: feature === f.id ? 'white' : '#6B5D4E',
                    fontSize: 12, fontFamily: 'Cairo', cursor: 'pointer',
                  }}
                >
                  {f.emoji} {f.labelAr}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feature chips row */}
      <div style={{ padding: '8px 12px', flexShrink: 0, background: '#EAE2CC' }}>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {featureFilters.map(f => (
            <button
              key={f.id}
              onClick={() => setFeature(f.id)}
              style={{
                flexShrink: 0, padding: '5px 12px', borderRadius: 16,
                background: feature === f.id ? '#630E13' : 'white',
                border: feature === f.id ? 'none' : '1px solid rgba(44,36,24,0.12)',
                color: feature === f.id ? 'white' : '#6B5D4E',
                fontSize: 12, fontFamily: 'Cairo', cursor: 'pointer',
              }}
            >
              {f.emoji} {f.labelAr}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div style={{ padding: '4px 16px 0', flexShrink: 0 }}>
        <span style={{ fontFamily: 'Cairo', fontSize: 12, color: '#8A7A6A' }}>
          {filtered.length} مسار متاح — {filtered.length} trails available
        </span>
      </div>

      {/* Trail list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '8px 14px 8px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏔️</div>
            <div style={{ fontFamily: 'Cairo', fontSize: 16, color: '#6B5D4E' }}>لا توجد مسارات مطابقة</div>
            <div style={{ fontFamily: 'Inter', fontSize: 13, color: '#8A7A6A', marginTop: 4 }}>No matching trails found</div>
          </div>
        ) : (
          filtered.map(trail => (
            <TrailCard
              key={trail.id}
              trail={trail}
              onPress={() => navigate(`/trail/${trail.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}