import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';

const slides = [
  {
    id: 0,
    image: 'https://images.unsplash.com/photo-1636385927808-8177f1c8f570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleAr: 'اكتشف مسارات فلسطين',
    title: 'Discover Palestine\'s Trails',
    subtitleAr: 'استكشف الجمال الطبيعي من وادي القلط إلى جبال الخليل',
    subtitle: 'Explore the natural beauty from Wadi Qelt to the Hebron Mountains',
    accent: '#630E13',
  },
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1772013971664-5808a8e1a102?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleAr: 'سجّل رحلتك',
    title: 'Record Your Journey',
    subtitleAr: 'تتبع مساراتك في الوقت الفعلي، وحافظ على ذكرياتك للأبد',
    subtitle: 'Track your routes in real time and keep your memories forever',
    accent: '#D4A843',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1726091983472-a7da2540c492?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
    titleAr: 'انضم إلى المجتمع',
    title: 'Join the Community',
    subtitleAr: 'شارك تجاربك مع آلاف المتسلقين الفلسطينيين حول العالم',
    subtitle: 'Share your adventures with thousands of Palestinian hikers worldwide',
    accent: '#630E13',
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (current < slides.length - 1) {
      setDirection(1);
      setCurrent(c => c + 1);
    } else {
      navigate('/auth');
    }
  };

  const goTo = (idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  };

  const slide = slides[current];

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: '#EAE2CC', minHeight: '100dvh' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ x: direction * 390, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -direction * 390, opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* Hero Image */}
          <div className="absolute inset-0">
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 35%, rgba(44,36,24,0.88) 72%, rgba(44,36,24,1) 100%)',
              }}
            />
          </div>

          {/* Logo top center */}
          <div className="absolute top-10 left-0 right-0 flex justify-center z-10">
            <div className="flex items-center gap-2">
              {/* Icon */}
              <svg width="30" height="30" viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="14" fill="#630E13" />
                <path d="M15 24 C11 19 9 12 13 8 C17 12 19 19 15 24Z" fill="#F5A0A0" />
                <path d="M15 24 C13 18 10 15 8 15 C10 18 13 22 15 24Z" fill="#BB2823" />
                <circle cx="15" cy="8" r="2.5" fill="#D4A843" />
              </svg>
              <span style={{ color: 'white', fontFamily: 'Cairo, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
                Traces
              </span>
              <span style={{ color: '#D4A843', fontFamily: 'Cairo, sans-serif', fontSize: 14, fontWeight: 400, marginTop: 4 }}>
                مسارات
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 z-10">
            {/* Slide dots */}
            <div className="flex justify-center gap-2 mb-6">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === current ? 28 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === current ? '#D4A843' : 'rgba(255,255,255,0.45)',
                    border: 'none',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>

            {/* Text content */}
            <div className="text-center mb-6">
              <h1 style={{ fontFamily: 'Cairo, sans-serif', color: '#D4A843', fontSize: 28, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
                {slide.titleAr}
              </h1>
              <h2 style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.9)', fontSize: 17, fontWeight: 600, marginBottom: 10 }}>
                {slide.title}
              </h2>
              <p style={{ fontFamily: 'Cairo, sans-serif', color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.7, direction: 'rtl' }}>
                {slide.subtitleAr}
              </p>
              <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 }}>
                {slide.subtitle}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={goNext}
                style={{
                  background: '#630E13',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  padding: '15px 0',
                  width: '100%',
                  fontFamily: 'Cairo, sans-serif',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(99,14,19,0.45)',
                }}
              >
                {current === slides.length - 1 ? 'ابدأ الاستكشاف — Get Started' : 'التالي — Next'}
              </button>
              {current < slides.length - 1 && (
                <button
                  onClick={() => navigate('/auth')}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 14,
                    padding: '12px 0',
                    width: '100%',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Skip — تخطي
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}