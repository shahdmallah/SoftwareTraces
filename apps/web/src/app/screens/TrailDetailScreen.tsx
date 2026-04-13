import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Star, Clock, TrendingUp, Ruler, AlertTriangle, Wind, Droplets, Thermometer, ChevronRight, Heart, Share2, Play, Sun, Mountain } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { trails, mockElevationData, mockReviews } from '../data/trails';

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

export function TrailDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [imageIdx, setImageIdx] = useState(0);

  const trail = trails.find(t => t.id === id) || trails[0];

  return (
    <div
      className="relative w-full h-full overflow-y-auto"
      style={{ background: '#EAE2CC', fontFamily: 'Cairo, Inter, sans-serif' }}
    >
      {/* Photo Carousel */}
      <div className="relative" style={{ height: 260 }}>
        <img
          src={trail.images[imageIdx]}
          alt={trail.name}
          className="w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 50%, rgba(0,0,0,0.6) 100%)' }}
        />

        {/* Back & actions */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
          <button
            onClick={() => navigate(-1)}
            style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(0,0,0,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setLiked(!liked)}
              style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(0,0,0,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Heart size={18} color={liked ? '#BB2823' : 'white'} fill={liked ? '#BB2823' : 'none'} />
            </button>
            <button
              style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(0,0,0,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Share2 size={18} color="white" />
            </button>
          </div>
        </div>

        {/* Difficulty badge */}
        <div className="absolute bottom-4 left-4">
          <span style={{
            background: difficultyColor[trail.difficulty],
            color: 'white',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'Cairo',
          }}>
            {difficultyAr[trail.difficulty]}
          </span>
        </div>

        {/* Image dots */}
        <div className="absolute bottom-4 right-4 flex gap-1.5">
          {trail.images.map((_, i) => (
            <button
              key={i}
              onClick={() => setImageIdx(i)}
              style={{
                width: i === imageIdx ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === imageIdx ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 100px' }}>
        {/* Title */}
        <div className="py-4 border-b" style={{ borderColor: 'rgba(44,36,24,0.08)' }}>
          <div className="flex items-start justify-between">
            <div>
              <h1 style={{ fontFamily: 'Cairo', fontSize: 22, fontWeight: 800, color: '#2C2418', marginBottom: 2 }}>{trail.nameAr}</h1>
              <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#8A7A6A' }}>{trail.name}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <Star size={14} color="#D4A843" fill="#D4A843" />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>{trail.rating}</span>
              </div>
              <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo' }}>{trail.reviews} تقييم</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: '#8A7A6A', fontFamily: 'Cairo' }}>📍 {trail.regionAr}</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 py-4">
          {[
            { icon: Ruler, labelAr: 'المسافة', value: `${trail.distance} km`, color: '#630E13' },
            { icon: Clock, labelAr: 'المدة', value: trail.duration, color: '#D4A843' },
            { icon: TrendingUp, labelAr: 'الارتفاع', value: `${trail.elevationGain}m+`, color: '#BB2823' },
            { icon: Mountain, labelAr: 'أعلى نقطة', value: `${trail.elevationMax}m`, color: '#7A9A3A' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.labelAr}
                style={{
                  background: 'white',
                  borderRadius: 14,
                  padding: '14px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, background: stat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={20} color={stat.color} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#8A7A6A', fontFamily: 'Cairo' }}>{stat.labelAr}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dead Sea elevation note */}
        {trail.elevationMin < 0 && (
          <div style={{ background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)', borderRadius: 14, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 24 }}>🌊</div>
            <div>
              <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#1565C0' }}>يصل إلى {trail.elevationMin}م تحت سطح البحر</div>
              <div style={{ fontFamily: 'Inter', fontSize: 11, color: '#1976D2' }}>Descends to {trail.elevationMin}m below sea level</div>
            </div>
          </div>
        )}

        {/* Elevation Chart */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px', marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, color: '#2C2418', marginBottom: 10 }}>مخطط الارتفاع — Elevation Profile</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={mockElevationData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#630E13" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#630E13" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dist" tick={{ fontSize: 9, fill: '#9E8E80' }} tickFormatter={v => `${v}km`} />
              <YAxis tick={{ fontSize: 9, fill: '#9E8E80' }} tickFormatter={v => `${v}m`} />
              <Tooltip
                formatter={(val: number) => [`${val}m`, 'Elevation']}
                labelFormatter={(l) => `${l}km`}
                contentStyle={{ fontSize: 11, borderRadius: 8, fontFamily: 'Inter' }}
              />
              <ReferenceLine y={0} stroke="#42A5F5" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="elev" stroke="#630E13" strokeWidth={2} fill="url(#elevGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Weather Widget */}
        <div style={{ background: 'linear-gradient(135deg, #F9EEEE, #FCF4F4)', borderRadius: 14, padding: '12px 14px', marginBottom: 12, border: '1px solid rgba(99,14,19,0.12)' }}>
          <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#2C2418', marginBottom: 8 }}>الطقس اليوم — Weather Today</div>
          <div className="flex justify-between">
            {[
              { icon: Thermometer, value: '22°C', labelAr: 'الحرارة' },
              { icon: Wind, value: '12 km/h', labelAr: 'الرياح' },
              { icon: Droplets, value: '45%', labelAr: 'الرطوبة' },
              { icon: Sun, value: '18:52', labelAr: 'الغروب' },
            ].map(w => {
              const Icon = w.icon;
              return (
                <div key={w.labelAr} style={{ textAlign: 'center' }}>
                  <Icon size={16} color="#630E13" style={{ margin: '0 auto 2px' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2C2418', fontFamily: 'Inter' }}>{w.value}</div>
                  <div style={{ fontSize: 9, color: '#8A7A6A', fontFamily: 'Cairo' }}>{w.labelAr}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkpoint Alert */}
        {trail.hasCheckpoint && (
          <div style={{ background: '#FFF8E1', borderRadius: 14, padding: '12px 14px', marginBottom: 12, border: '1px solid #D4A843', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#BB2823" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#BB2823' }}>⚠️ تنبيه: نقطة تفتيش على المسار</div>
              <div style={{ fontFamily: 'Cairo', fontSize: 12, color: '#5D4037', marginTop: 2 }}>{trail.checkpointNote}</div>
            </div>
          </div>
        )}

        {/* Features */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, color: '#2C2418', marginBottom: 8 }}>المميزات — Features</div>
          <div className="flex flex-wrap gap-2">
            {trail.featuresAr.map((f, i) => (
              <span key={i} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(99,14,19,0.1)', color: '#630E13', fontSize: 12, fontFamily: 'Cairo', fontWeight: 600 }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ background: 'white', borderRadius: 14, padding: '14px', marginBottom: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, color: '#2C2418', marginBottom: 6 }}>عن المسار</div>
          <p style={{ fontFamily: 'Cairo', fontSize: 13, color: '#6B5D4E', lineHeight: 1.7, direction: 'rtl', textAlign: 'right' }}>{trail.descriptionAr}</p>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#8A7A6A', lineHeight: 1.6, marginTop: 8 }}>{trail.description}</p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(91,100,53,0.15)', margin: '8px 0' }} />

        {/* Reviews */}
        <div style={{ marginTop: 12 }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: 'Cairo', fontSize: 14, fontWeight: 700, color: '#2C2418' }}>التقييمات — Reviews</span>
            <button style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: '#5B6435', fontFamily: 'Cairo' }}>الكل</span>
              <ChevronRight size={14} color="#5B6435" />
            </button>
          </div>
          {mockReviews.map(review => (
            <div key={review.id} style={{ background: 'white', borderRadius: 14, padding: '12px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div style={{ width: 36, height: 36, borderRadius: 18, background: '#630E13', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'white', fontFamily: 'Cairo', fontWeight: 700 }}>{review.avatar}</span>
                </div>
                <div className="flex-1">
                  <div style={{ fontFamily: 'Cairo', fontSize: 13, fontWeight: 700, color: '#2C2418' }}>{review.name}</div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={10} color="#D4A843" fill={i < review.rating ? '#D4A843' : 'none'} />
                    ))}
                    <span style={{ fontSize: 10, color: '#8A7A6A', marginLeft: 4, fontFamily: 'Inter' }}>{review.date}</span>
                  </div>
                </div>
              </div>
              <p style={{ fontFamily: review.lang === 'ar' ? 'Cairo' : 'Inter', fontSize: 12, color: '#6B5D4E', lineHeight: 1.6, direction: review.lang === 'ar' ? 'rtl' : 'ltr', textAlign: review.lang === 'ar' ? 'right' : 'left' }}>
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed CTA */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ padding: '10px 16px 20px', background: 'linear-gradient(to top, white, rgba(255,255,255,0.95) 80%, transparent)', zIndex: 20 }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/recording')}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 16,
            border: 'none',
            background: 'linear-gradient(135deg, #630E13, #BB2823)',
            color: 'white',
            fontFamily: 'Cairo, sans-serif',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 4px 20px rgba(99,14,19,0.45)',
          }}
        >
          <Play size={18} fill="white" />
          سجّل هذا المسار — Record This Trail
        </motion.button>
      </div>
    </div>
  );
}