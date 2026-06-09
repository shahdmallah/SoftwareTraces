import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DesktopNavigation, MobileNavigation } from './components/Navigation';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { MapPage } from './pages/MapPage';
import { TrailDetailPage } from './pages/TrailDetailPage';
import { CreateTrailPage } from './pages/CreateTrailPage';
import { TrailDraftsPage } from './pages/TrailDraftsPage';
import { MyTrailsPage } from './pages/MyTrailsPage';
import { SavedTrailsPage } from './pages/SavedTrailsPage';
import { ActivityPage } from './pages/ActivityPage';
import { RecordingPage } from './pages/RecordingPage';
import { ProfilePage } from './pages/ProfilePage';
import { OfflineDownloadsPage } from './pages/OfflineDownloadsPage';
import { AdminPage } from './pages/AdminPage';
import { FeedPage } from './pages/FeedPage';
import { SafetyPage } from './pages/SafetyPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { getAccessToken } from './api/client';
import { getMe, logout, type AuthUser } from './api/auth';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAccessToken()));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = Boolean(getAccessToken());
    setIsAuthenticated(token);
    if (!token) {
      setCurrentUser(null);
      return;
    }

    getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const refreshAuth = async () => {
    const token = Boolean(getAccessToken());
    setIsAuthenticated(token);
    if (!token) {
      setCurrentUser(null);
      return null;
    }

    try {
      const user = await getMe();
      setCurrentUser(user);
      return user;
    } catch {
      setCurrentUser(null);
      return null;
    }
  };

  const handleSignOut = () => {
    void logout().finally(() => {
      setIsAuthenticated(false);
      setCurrentUser(null);
    });
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage onAuth={refreshAuth} />} />
        <Route
          path="/*"
          element={(
            <div className="min-h-screen bg-background">
              <DesktopNavigation
                isAuthenticated={isAuthenticated}
                isAdmin={currentUser?.role === 'admin'}
                onSignIn={refreshAuth}
                onSignOut={handleSignOut}
              />
              <Routes>
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/trail/:id" element={<TrailDetailPage />} />
                <Route path="/create" element={<CreateTrailPage />} />
                <Route path="/drafts" element={<TrailDraftsPage />} />
                <Route path="/mine" element={<MyTrailsPage />} />
                <Route path="/saved" element={<SavedTrailsPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/safety" element={<SafetyPage />} />
                <Route path="/recording" element={<RecordingPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/downloads" element={<OfflineDownloadsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
              <MobileNavigation isAdmin={currentUser?.role === 'admin'} />
            </div>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
