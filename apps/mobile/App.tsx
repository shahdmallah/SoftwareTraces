import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { LanguageProvider } from './src/app/contexts/LanguageContext';
import { AuthProvider } from './src/app/contexts/AuthContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </LanguageProvider>
  );
}
