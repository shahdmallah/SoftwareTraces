import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/app/navigation/AppNavigator';
import { LanguageProvider } from './src/app/contexts/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </LanguageProvider>
  );
}
