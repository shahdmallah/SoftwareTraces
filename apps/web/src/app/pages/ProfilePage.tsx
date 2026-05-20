import { useEffect, useState } from 'react';
import { MapPin, Award, FileText, Clock, Book, Download, Settings, ChevronRight, Edit } from 'lucide-react';
import { Link } from 'react-router';
import { StatCard } from '../components/StatCard';
import { getMe, type AuthUser } from '../api/auth';
import { getMyActivities } from '../api/activities';
import { getMyTrailDrafts } from '../api/trails';

export function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
    getMyActivities().then((items) => setActivityCount(items.length)).catch(() => setActivityCount(0));
    getMyTrailDrafts().then((items) => setDraftCount(items.length)).catch(() => setDraftCount(0));
  }, []);

  const initials = (user?.full_name || user?.email || 'TR').slice(0, 2).toUpperCase();
  const menuSections = [
    {
      title: 'My Content',
      items: [
        { icon: MapPin, label: 'My Trails', count: draftCount, link: '/drafts' },
        { icon: FileText, label: 'Drafts', count: draftCount, link: '/drafts' },
        { icon: Clock, label: 'History', count: activityCount, link: '/activity' },
        { icon: Book, label: 'Journal', count: 0, link: '#' },
      ],
    },
    {
      title: 'Data & Settings',
      items: [
        { icon: Download, label: 'Offline Downloads', link: '/downloads' },
        { icon: Settings, label: 'Settings', link: '#' },
      ],
    },
  ];

  const achievements = [
    { label: 'Summit Seeker', description: '10 summits reached' },
    { label: 'Spring Explorer', description: '5 water trails' },
    { label: 'Nature Lover', description: '50km in nature' },
    { label: 'Top Contributor', description: '5 trails created' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-gradient-to-br from-primary/10 to-success/10 rounded-xl border border-border p-6 mb-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-semibold text-primary">{initials}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-foreground mb-1">{user?.full_name || 'Traces user'}</h2>
                  <p className="text-secondary">{user?.email || 'Signed in'}</p>
                </div>
                <button className="p-2 hover:bg-white/50 rounded-lg transition-colors">
                  <Edit className="w-5 h-5 text-secondary" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-secondary mb-4">
                <MapPin className="w-4 h-4" />
                <span>{user?.location || 'Palestine'}</span>
              </div>
              <button className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium hover:bg-muted/20 transition-colors">
                View Public Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <p className="text-2xl font-semibold text-foreground mb-1">{activityCount}</p>
              <p className="text-xs text-secondary">Activities</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <p className="text-2xl font-semibold text-foreground mb-1">0</p>
              <p className="text-xs text-secondary">Total km</p>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <p className="text-2xl font-semibold text-foreground mb-1">{draftCount}</p>
              <p className="text-xs text-secondary">Trails Created</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<MapPin className="w-4 h-4" />} label="Distance" value="0" unit="km" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Activities" value={activityCount} />
          <StatCard icon={<Award className="w-4 h-4" />} label="Elevation" value="0" unit="m" />
          <StatCard icon={<Award className="w-4 h-4" />} label="Trails" value={draftCount} variant="success" />
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-accent" />
            <h3>Achievements</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {achievements.map((achievement) => (
              <div key={achievement.label} className="text-center p-4 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-accent/20" />
                <p className="text-sm font-medium text-foreground mb-1">{achievement.label}</p>
                <p className="text-xs text-muted">{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>

        {menuSections.map((section) => (
          <div key={section.title} className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="mb-4">{section.title}</h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={item.link} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/10 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-secondary group-hover:text-primary transition-colors" />
                      <span className="font-medium text-foreground">{item.label}</span>
                      {'count' in item && <span className="px-2 py-0.5 bg-muted/20 text-muted rounded-full text-xs">{item.count}</span>}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
