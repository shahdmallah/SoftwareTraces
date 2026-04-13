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
      { index: true, element: <Navigate to="/app/map" replace /> },
      { path: 'map', element: <MapScreen /> },
      { path: 'explore', element: <ExploreScreen /> },
      { path: 'history', element: <HistoryScreen /> },
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