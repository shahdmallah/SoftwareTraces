import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { LanguageProvider } from './src/app/contexts/LanguageContext';
import { AuthProvider } from './src/app/contexts/AuthContext';
import { TrailTrackingProvider } from './src/app/contexts/TrailTrackingContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <TrailTrackingProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </TrailTrackingProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
