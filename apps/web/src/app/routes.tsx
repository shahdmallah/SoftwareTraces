import { createBrowserRouter, Navigate } from 'react-router';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { AppLayout } from './screens/AppLayout';
import { MapScreen } from './screens/MapScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TrailDetailScreen } from './screens/TrailDetailScreen';
import { RecordingScreen } from './screens/RecordingScreen';
import { SavedTrailsScreen } from './screens/SavedTrailsScreen';
import { MyTrailsScreen } from './screens/MyTrailsScreen';
import { JournalScreen } from './screens/JournalScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { OfflineScreen } from './screens/OfflineScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/onboarding" replace />,
  },
  {
    path: '/onboarding',
    element: <OnboardingScreen />,
  },
  {
    path: '/auth',
    element: <AuthScreen />,
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/app/explore" replace /> },
      { path: 'map', element: <MapScreen /> },
      { path: 'explore', element: <ExploreScreen /> },
      { path: 'saved', element: <SavedTrailsScreen /> },
      { path: 'my-trails', element: <MyTrailsScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'journal', element: <JournalScreen /> },
      { path: 'community', element: <CommunityScreen /> },
      { path: 'offline', element: <OfflineScreen /> },
      { path: 'profile', element: <ProfileScreen /> },
    ],
  },
  {
    path: '/trail/:id',
    element: <TrailDetailScreen />,
  },
  {
    path: '/recording',
    element: <RecordingScreen />,
  },
]);
