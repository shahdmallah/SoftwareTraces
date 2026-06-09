import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Compass,
  Map,
  Download,
  Activity,
  Star,
  ChevronRight,
  MapPin,
  Clock,
  TrendingUp,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { AuthModal } from '../components/AuthModal';

const HERO_IMG = 'https://images.unsplash.com/photo-1636386538644-0014e700cd32?w=1800&auto=format&fit=crop&q=80';
const SECTION_IMG_1 = 'https://images.unsplash.com/photo-1595195253172-f4e9dc4e322a?w=1200&auto=format&fit=crop&q=80';
const SECTION_IMG_2 = 'https://images.unsplash.com/photo-1767022093696-edf729f460c9?w=1200&auto=format&fit=crop&q=80';
const CTA_IMG = 'https://images.unsplash.com/photo-1771600245581-c3b2f6043626?w=1800&auto=format&fit=crop&q=80';

const featuredTrails = [
  {
    id: '1',
    name: 'Canyon Ridge Trail',
    region: 'Desert Highlands',
    distance: '8.5 km',
    duration: '3-4 hrs',
    difficulty: 'moderate' as const,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Summit Loop',
    region: 'Mountain Range',
    distance: '12.3 km',
    duration: '5-6 hrs',
    difficulty: 'hard' as const,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Terrace Walk',
    region: 'Valley Farms',
    distance: '6.3 km',
    duration: '2.5-3 hrs',
    difficulty: 'easy' as const,
    rating: 4.7,
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=600&auto=format&fit=crop',
  },
];

const features = [
  {
    icon: Map,
    title: 'Detailed Trail Maps',
    desc: 'Accurate offline-ready topographic maps for routes across many landscapes and regions.',
  },
  {
    icon: Activity,
    title: 'Activity Tracking',
    desc: 'Record your hikes with GPS, track elevation, pace, and distance in real time.',
  },
  {
    icon: Download,
    title: 'Offline Access',
    desc: 'Download trail maps before you go and navigate confidently without a signal.',
  },
  {
    icon: Compass,
    title: 'Discover Trails',
    desc: 'Browse curated routes, compare difficulty, and find trails that fit the day.',
  },
];

const difficultyStyle = {
  easy: { bg: 'bg-green-500/20', text: 'text-green-200', label: 'Easy' },
  moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-200', label: 'Moderate' },
  hard: { bg: 'bg-red-500/20', text: 'text-red-200', label: 'Hard' },
};

const navLinks = [
  { label: 'Explore', to: '/explore' },
  { label: 'Map', to: '/map' },
  { label: 'Trails', to: '/explore' },
  { label: 'Activity', to: '/activity' },
];

interface LandingPageProps {
  onAuth: () => Promise<{ role: string } | null>;
}

export function LandingPage({ onAuth }: LandingPageProps) {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f7', fontFamily: 'system-ui, sans-serif' }}>
      <nav className="fixed top-0 left-0 right-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow" style={{ backgroundColor: '#630E13' }}>
                <Compass className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold text-lg leading-none">Traces</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-white/80 hover:text-white transition-colors text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setAuthMode('signin')}
                className="px-5 py-2 text-white/90 hover:text-white text-sm font-medium transition-colors border border-white/20 rounded-lg hover:border-white/40"
              >
                Sign In
              </button>
              <Link
                to="/explore"
                className="px-5 py-2 text-white text-sm font-medium rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: '#630E13' }}
              >
                Explore
              </Link>
            </div>

            <button
              className="md:hidden p-2 text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#2C2418]/95 backdrop-blur-md border-t border-white/10 px-6 py-4 space-y-3">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left text-white/80 py-2 text-sm"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => { setAuthMode('signin'); setMobileMenuOpen(false); }}
                className="flex-1 py-2.5 border border-white/30 text-white rounded-lg text-sm"
              >
                Sign In
              </button>
              <Link
                to="/explore"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-2.5 text-white rounded-lg text-sm text-center"
                style={{ backgroundColor: '#630E13' }}
              >
                Explore
              </Link>
            </div>
          </div>
        )}
      </nav>

      <section className="relative h-screen min-h-[640px] flex items-center">
        <ImageWithFallback
          src={HERO_IMG}
          alt="Mountain valley landscape"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#2C2418]/55 via-[#630E13]/35 to-[#2C2418]/70" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full pt-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
              <MapPin className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-white/90 text-xs font-medium">Trail discovery platform</span>
            </div>

            <h1 className="text-white mb-6 leading-tight" style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 700, lineHeight: 1.1 }}>
              Discover your next{' '}
              <span style={{ color: '#D4A843' }}>Trail</span>
            </h1>

            <p className="text-white/75 mb-8 max-w-xl" style={{ fontSize: '1.125rem', lineHeight: 1.7 }}>
              Find scenic routes, navigate with confidence, and keep track of the journeys that matter to you.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/explore"
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold transition-all hover:opacity-90 hover:shadow-lg shadow-md"
                style={{ backgroundColor: '#630E13' }}
              >
                Start Exploring
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/map"
                className="flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold border border-white/30 hover:bg-white/10 backdrop-blur-sm transition-all"
              >
                Open Map
              </Link>
            </div>
          </div>
        </div>

      </section>

      <section className="py-24 px-6 lg:px-8" style={{ backgroundColor: '#f7f7f7' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ color: '#630E13', fontSize: '2rem', fontWeight: 700 }} className="mb-3">
              Everything you need on the trail
            </h2>
            <p className="text-[#6B5D4E] max-w-xl mx-auto">
              Traces is built for hikers who want a calmer way to plan, navigate, record, and share routes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white rounded-2xl p-6 border border-[#C4B896]/40 hover:shadow-md transition-shadow group"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors group-hover:scale-105"
                    style={{ backgroundColor: '#630E13' + '15' }}
                  >
                    <Icon className="w-6 h-6" style={{ color: '#630E13' }} />
                  </div>
                  <h3 className="text-[#2C2418] mb-3" style={{ fontSize: '1rem', fontWeight: 600 }}>{feature.title}</h3>
                  <p className="text-[#6B5D4E] text-sm leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[600px]">
          <div className="relative">
            <ImageWithFallback
              src={SECTION_IMG_1}
              alt="Mountain trail landscape"
              className="w-full h-full object-cover min-h-[360px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#2C2418]/35 to-transparent" />
            <div className="absolute bottom-8 left-8">
              <span className="text-white/80 text-sm">Featured terrain</span>
              <p className="text-white font-semibold text-xl mt-1">Mountains, valleys, and open paths</p>
            </div>
          </div>

          <div className="flex flex-col justify-center px-10 py-16 bg-white lg:px-16">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-8 h-0.5 rounded" style={{ backgroundColor: '#D4A843' }} />
              <span className="text-sm font-medium uppercase tracking-wider" style={{ color: '#630E13' }}>
                Featured Trails
              </span>
            </div>
            <h2 className="text-[#2C2418] mb-3" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              Start with a route that fits
            </h2>
            <p className="text-[#6B5D4E] text-sm mb-8">
              Compare route length, difficulty, rating, and expected duration before you head out.
            </p>

            <div className="space-y-4">
              {featuredTrails.map((trail) => {
                const d = difficultyStyle[trail.difficulty];
                return (
                  <Link
                    key={trail.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-[#fbfaf8] border border-[#C4B896]/40 hover:border-[#D4A843]/70 hover:shadow-sm transition-all cursor-pointer group"
                    to="/explore"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <ImageWithFallback
                        src={trail.image}
                        alt={trail.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#2C2418] text-sm">{trail.name}</p>
                      <p className="text-xs text-[#8A7A6A] mb-2">{trail.region}</p>
                      <div className="flex items-center gap-3 text-xs text-[#6B5D4E]">
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{trail.distance}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{trail.duration}</span>
                        <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />{trail.rating}</span>
                        <span className={`${d.bg} ${d.text} px-2 py-0.5 rounded-full`}>{d.label}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#D4A843] group-hover:text-[#6B5D4E] flex-shrink-0 transition-colors" />
                  </Link>
                );
              })}
            </div>

            <Link
              to="/explore"
              className="mt-8 flex items-center gap-2 text-sm font-medium hover:gap-3 transition-all"
              style={{ color: '#630E13' }}
            >
              View all trails <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 lg:px-8" style={{ backgroundColor: '#f7f7f7' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ color: '#630E13', fontSize: '2rem', fontWeight: 700 }} className="mb-3">
              Ready in minutes
            </h2>
            <p className="text-[#6B5D4E]">Your next hike is just a few steps away.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Browse trails', desc: 'Explore curated routes and filter by region, length, and difficulty.' },
              { step: '02', title: 'Plan your route', desc: 'Review maps, photos, terrain notes, and trail details before you go.' },
              { step: '03', title: 'Track the journey', desc: 'Record your hike, save favorites, and keep maps ready for offline use.' },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-6xl font-bold mb-4 leading-none" style={{ color: '#630E13' + '18' }}>{s.step}</div>
                <div className="w-8 h-0.5 mb-4 rounded" style={{ backgroundColor: '#7A9A3A' }} />
                <h3 className="text-[#2C2418] mb-2" style={{ fontSize: '1.1rem', fontWeight: 600 }}>{s.title}</h3>
                <p className="text-[#6B5D4E] text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative h-72 overflow-hidden">
        <ImageWithFallback
          src={SECTION_IMG_2}
          alt="Trail through trees"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#2C2418]/45" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/70 text-sm mb-2">Routes for every pace</p>
            <p className="text-white text-2xl font-semibold">Quiet paths. Long climbs. Better days outside.</p>
          </div>
        </div>
      </section>

      <section className="relative py-32 px-6 lg:px-8 overflow-hidden">
        <ImageWithFallback
          src={CTA_IMG}
          alt="Hiker on trail"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #630E13cc 0%, #2C2418cc 100%)' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-white mb-4" style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 700 }}>
            Begin your journey today
          </h2>
          <p className="text-white/70 mb-10 text-lg">
            Browse trails freely, then sign in whenever you want to save, record, or share your routes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/explore"
              className="px-10 py-4 rounded-xl text-white font-semibold text-lg border-2 border-white hover:bg-white hover:text-[#2C2418] transition-all"
            >
              Explore Trails
            </Link>
            <button
              onClick={() => setAuthMode('signin')}
              className="px-10 py-4 rounded-xl font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: '#D4A843', color: '#2C2418' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 lg:px-8 bg-[#2C2418]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-10">
            <div className="max-w-xs">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#630E13' }}>
                  <Compass className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold">Traces</span>
              </div>
              <p className="text-[#8A7A6A] text-sm leading-relaxed">
                A trail discovery and activity tracking platform for hikers, route builders, and outdoor communities.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              {[
                { heading: 'Product', links: ['Explore Trails', 'Trail Maps', 'Activity Tracking', 'Offline Downloads'] },
                { heading: 'Community', links: ['Trail Creators', 'Reviews', 'Events', 'Blog'] },
                { heading: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
              ].map((col) => (
                <div key={col.heading}>
                  <p className="text-[#D4A843] font-medium mb-3">{col.heading}</p>
                  <ul className="space-y-2">
                    {col.links.map((link) => (
                      <li key={link}>
                        <Link to="/explore" className="text-[#6B5D4E] hover:text-[#D4A843] transition-colors">{link}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-sm">Copyright 2026 Traces. Built for the trail.</p>
            <p className="text-white/40 text-sm">Plan. Navigate. Remember.</p>
          </div>
        </div>
      </footer>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={async () => {
            setAuthMode(null);
            const user = await onAuth();
            if (user?.role === 'admin') {
              navigate('/admin');
            }
          }}
          onToggleMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
        />
      )}
    </div>
  );
}
