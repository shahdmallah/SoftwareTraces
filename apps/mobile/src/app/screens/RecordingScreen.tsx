import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';

type TrailCreatorComponent = typeof import('../components/TrailCreator').TrailCreator;

let TrailCreator: TrailCreatorComponent | null = null;
let trailCreatorLoadError: string | null = null;

try {
  // Load Mapbox-backed UI lazily so unsupported builds can still render a fallback.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TrailCreator = require('../components/TrailCreator').TrailCreator as TrailCreatorComponent;
} catch (error) {
  trailCreatorLoadError = error instanceof Error ? error.message : 'Mapbox native code not available.';
}

export function RecordingScreen() {
  return (
    <View style={styles.container}>
      {TrailCreator ? (
        <TrailCreator
          styleURL={MAPBOX_STYLE_URL}
          onSaved={() => {
            // Keep the user on the creation screen so they can immediately draw another trail if needed.
          }}
        />
      ) : (
        <View style={styles.fallbackCard}>
          <Ionicons name="warning-outline" size={30} color="#D4A843" />
          <Text style={styles.fallbackTitle}>Mapbox native build required</Text>
          <Text style={styles.fallbackText}>
            This trail creator needs a dev build with the native Mapbox module installed.
          </Text>
          <Text style={styles.fallbackCode}>{trailCreatorLoadError ?? 'Mapbox native code not available.'}</Text>
        </View>
      )}
      {!process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ? (
        <View style={styles.tokenWarning}>
          <Ionicons name="alert-circle-outline" size={16} color="#D4A843" />
          <Text style={styles.tokenWarningText}>
            Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to enable route drawing with Mapbox Directions.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAE2CC',
  },
  fallbackCard: {
    margin: 20,
    marginTop: 120,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(44,36,24,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fallbackTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 10,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  fallbackCode: {
    color: '#F4E6B0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tokenWarning: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(44,36,24,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.24)',
  },
  tokenWarningText: {
    flex: 1,
    color: '#F4E6B0',
    fontSize: 12,
    lineHeight: 18,
  },
});
