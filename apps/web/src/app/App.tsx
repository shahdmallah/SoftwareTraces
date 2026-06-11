import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router';
import { DesktopNavigation, MobileNavigation } from './components/Navigation';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { MapPage } from './pages/MapPage';
import { TrailDetailPage } from './pages/TrailDetailPage';
import { CreateTrailPage } from './pages/CreateTrailPage';
import { TrailDraftsPage } from './pages/TrailDraftsPage';
import { MyTrailsPage } from './pages/MyTrailsPage';
import { SavedTrailsPage } from './pages/SavedTrailsPage';
import { ProfilePage } from './pages/ProfilePage';
import { OfflineDownloadsPage } from './pages/OfflineDownloadsPage';
import { FeedPage } from './pages/FeedPage';
import { SafetyPage } from './pages/SafetyPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { getAccessToken } from './api/client';
import { getMe, logout, type AuthUser } from './api/auth';

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));

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
                <Route path="/activity" element={<Navigate to="/feed" replace />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/safety" element={<SafetyPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/downloads" element={<OfflineDownloadsPage />} />
                <Route
                  path="/admin"
                  element={(
                    <Suspense fallback={<div className="px-4 py-10 text-sm text-muted-foreground">Loading admin panel...</div>}>
                      <AdminPage />
                    </Suspense>
                  )}
                />
              </Routes>
              <MobileNavigation isAdmin={currentUser?.role === 'admin'} />
            </div>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
