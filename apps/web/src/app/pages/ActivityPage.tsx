import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Clock, Mountain, Zap, Calendar, Users, MessageCircle, Play, Trophy, Shield } from 'lucide-react';
import { Link } from 'react-router';
import { StatCard } from '../components/StatCard';
import { getActivityJournal, getMyActivities, type Activity } from '../api/activities';
import { getMyChallenges, joinChallenge, listChallenges, type Challenge } from '../api/challenges';
import { joinMeetup, listMeetups, type Meetup } from '../api/meetups';
import { getAccessToken } from '../api/client';

function km(activity: Activity) {
  return Number(activity.distance_km ?? (activity.distance_meters ? activity.distance_meters / 1000 : 0));
}

function elevation(activity: Activity) {
  return Number(activity.elevation_gain_m ?? activity.elevation_gain_meters ?? 0);
}

function durationHours(activity: Activity) {
  return Number(activity.duration_sec ?? 0) / 3600;
}

export function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [journal, setJournal] = useState<Activity[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const isGuest = !getAccessToken();

  useEffect(() => {
    if (isGuest) return;

    void Promise.all([
      getMyActivities().then(setActivities),
      getActivityJournal({ limit: 10 }).then(setJournal).catch(() => setJournal([])),
      Promise.all([listChallenges(), getMyChallenges().catch(() => [])]).then(([publicRows, myRows]) => {
        const merged = new Map<string, Challenge>();
        publicRows.forEach((row) => merged.set(row.id, row));
        myRows.forEach((row) => merged.set(row.id, { ...merged.get(row.id), ...row }));
        setChallenges([...merged.values()]);
      }),
      listMeetups({ limit: 10 }).then(setMeetups).catch(() => setMeetups([])),
    ]).catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load activities.'));
  }, [isGuest]);

  const totals = useMemo(() => ({
    distance: activities.reduce((sum, activity) => sum + km(activity), 0),
    hours: activities.reduce((sum, activity) => sum + durationHours(activity), 0),
    elevation: activities.reduce((sum, activity) => sum + elevation(activity), 0),
    avgSpeed: activities.length ? activities.reduce((sum, activity) => sum + km(activity), 0) / Math.max(1, activities.reduce((sum, activity) => sum + durationHours(activity), 0)) : 0,
  }), [activities]);

  const activeActivity = activities.find((activity) => activity.status === 'recording' || activity.status === 'active');

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="mb-2">Activity</h1>
            <p className="text-secondary">Activities, challenges, meetups, and journal entries from the API.</p>
          </div>
          <Link to="/recording" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" />
            <span>Start Recording</span>
          </Link>
        </div>

        {errorMessage && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{errorMessage}</div>}

        {isGuest && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h3 className="text-foreground mb-2">Activity sync is optional</h3>
            <p className="text-sm text-secondary">
              You can browse trails without signing in. Sign in when you want activities, stats, and recordings saved to your account.
            </p>
          </div>
        )}

        {activeActivity && (
          <div className="bg-gradient-to-br from-primary/10 to-success/10 rounded-xl border border-primary/20 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse"></div>
              <h3 className="text-foreground">Recording in Progress</h3>
            </div>
            <p className="text-secondary mb-4">{activeActivity.title || 'Active hike'}</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><p className="text-2xl font-semibold text-foreground">{km(activeActivity).toFixed(1)} km</p><p className="text-sm text-secondary">Distance</p></div>
              <div><p className="text-2xl font-semibold text-foreground">{Math.round(durationHours(activeActivity) * 60)} min</p><p className="text-sm text-secondary">Duration</p></div>
              <div><p className="text-2xl font-semibold text-foreground">{Math.round(elevation(activeActivity))}m</p><p className="text-sm text-secondary">Elevation</p></div>
            </div>
            <Link to="/recording" className="block w-full px-4 py-3 bg-primary text-primary-foreground text-center rounded-lg hover:bg-primary/90 transition-colors">
              View Recording
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Distance" value={totals.distance.toFixed(1)} unit="km" variant="primary" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Total Time" value={totals.hours.toFixed(1)} unit="hrs" />
          <StatCard icon={<Mountain className="w-4 h-4" />} label="Elevation Gain" value={Math.round(totals.elevation).toLocaleString()} unit="m" />
          <StatCard icon={<Zap className="w-4 h-4" />} label="Avg Speed" value={totals.avgSpeed.toFixed(1)} unit="km/h" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-secondary" />
              <h3>Community</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/feed" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/20">Open feed</Link>
              <Link to="/messages" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/20">Messages</Link>
              <Link to="/safety" className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/20 inline-flex items-center gap-1">
                <Shield className="w-4 h-4" />
                Safety
              </Link>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-secondary" />
              <h3>Meetups</h3>
            </div>
            <div className="space-y-2">
              {meetups.slice(0, 4).map((meetup) => (
                <div key={meetup.id} className="flex items-center justify-between text-sm">
                  <span>{meetup.title}</span>
                  <button
                    type="button"
                    onClick={() => void joinMeetup(meetup.id)}
                    className="text-primary hover:underline"
                  >
                    Join
                  </button>
                </div>
              ))}
              {!meetups.length && <p className="text-sm text-secondary">No upcoming meetups.</p>}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-secondary" />
            <h3>Challenges</h3>
          </div>
          <div className="space-y-3">
            {challenges.slice(0, 5).map((challenge) => (
              <div key={challenge.id} className="flex items-start justify-between gap-4 text-sm border border-border rounded-lg p-3">
                <div>
                  <p className="font-medium text-foreground">{challenge.title}</p>
                  <p className="text-secondary">{challenge.description}</p>
                  {challenge.participant_status && <p className="text-xs text-primary mt-1">Status: {challenge.participant_status}</p>}
                </div>
                {!challenge.participant_status && (
                  <button type="button" onClick={() => void joinChallenge(challenge.id)} className="text-primary hover:underline shrink-0">
                    Join
                  </button>
                )}
              </div>
            ))}
            {!challenges.length && <p className="text-sm text-secondary">No active challenges.</p>}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-secondary" />
            <h3>Activity journal</h3>
          </div>
          <div className="space-y-3">
            {journal.slice(0, 5).map((activity) => (
              <div key={activity.id} className="text-sm flex justify-between">
                <span>{activity.title || 'Trail activity'}</span>
                <span className="text-secondary">{new Date(activity.started_at).toLocaleDateString()}</span>
              </div>
            ))}
            {!journal.length && <p className="text-sm text-secondary">No journal entries yet.</p>}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-secondary" />
            <h3>Recent Activities</h3>
          </div>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-secondary">No activities synced yet.</p>
            ) : activities.map((activity) => (
              <div key={activity.id} className="p-4 rounded-lg border border-border hover:bg-muted/5 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">{activity.title || 'Trail activity'}</h4>
                    <p className="text-sm text-secondary">{new Date(activity.started_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm text-muted">{activity.status || 'completed'}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p className="text-xs text-muted">Distance</p><p className="font-medium text-foreground">{km(activity).toFixed(1)} km</p></div>
                  <div><p className="text-xs text-muted">Duration</p><p className="font-medium text-foreground">{Math.round(durationHours(activity) * 60)} min</p></div>
                  <div><p className="text-xs text-muted">Elevation</p><p className="font-medium text-foreground">{Math.round(elevation(activity))}m</p></div>
                  <div><p className="text-xs text-muted">Avg Speed</p><p className="font-medium text-foreground">{Number(activity.avg_speed_kph ?? 0).toFixed(1)} km/h</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
