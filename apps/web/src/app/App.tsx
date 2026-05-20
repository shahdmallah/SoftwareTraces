import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DesktopNavigation, MobileNavigation } from './components/Navigation';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { MapPage } from './pages/MapPage';
import { TrailDetailPage } from './pages/TrailDetailPage';
import { CreateTrailPage } from './pages/CreateTrailPage';
import { TrailDraftsPage } from './pages/TrailDraftsPage';
import { SavedTrailsPage } from './pages/SavedTrailsPage';
import { ActivityPage } from './pages/ActivityPage';
import { RecordingPage } from './pages/RecordingPage';
import { ProfilePage } from './pages/ProfilePage';
import { OfflineDownloadsPage } from './pages/OfflineDownloadsPage';
import { getAccessToken } from './api/client';
import { logout } from './api/auth';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    setIsAuthenticated(Boolean(getAccessToken()));
  }, []);

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <LandingPage onAuth={() => setIsAuthenticated(true)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <DesktopNavigation onSignOut={() => { logout(); setIsAuthenticated(false); }} />
        <Routes>
          <Route path="/" element={<ExplorePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/trail/:id" element={<TrailDetailPage />} />
          <Route path="/create" element={<CreateTrailPage />} />
          <Route path="/drafts" element={<TrailDraftsPage />} />
          <Route path="/saved" element={<SavedTrailsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/recording" element={<RecordingPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/downloads" element={<OfflineDownloadsPage />} />
        </Routes>
        <MobileNavigation />
      </div>
    </BrowserRouter>
  );
}
