import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import {
  searchOrGenerateTrail,
  type ExistingTrailSuggestion,
  type GeneratedTrailSuggestion,
  type TrailSearchOrGenerateResult,
} from '../api/trailsApi';
import { AnimatedScreen } from '../components/AnimatedUI';

type SearchResultsNavigationProp = StackNavigationProp<RootStackParamList, 'SearchResults'>;
type SearchResultsRouteProp = RouteProp<RootStackParamList, 'SearchResults'>;

function formatGeneratedSummary(trail: GeneratedTrailSuggestion) {
  const distance = `${(trail.length_meters / 1000).toFixed(1)} km`;
  const duration = `${Math.max(1, Math.round(trail.estimated_duration_minutes))} min`;
  return `${distance} | ${duration} | ${trail.difficulty}`;
}

export function SearchResultsScreen() {
  const navigation = useNavigation<SearchResultsNavigationProp>();
  const route = useRoute<SearchResultsRouteProp>();
  const query = route.params?.query?.trim() ?? '';
  const [result, setResult] = useState<TrailSearchOrGenerateResult | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(query));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadResults = async () => {
      if (!query) {
        setIsLoading(false);
        setResult(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextResult = await searchOrGenerateTrail(query);
        if (!cancelled) {
          setResult(nextResult);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to search trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const existingTrails = result?.existing_trails ?? [];
  const generatedTrail = result?.generated_trail ?? null;
  const hasGeneratedRoute = Boolean(generatedTrail && generatedTrail.coordinates.length >= 2);

  const renderExistingTrail = ({ item }: { item: ExistingTrailSuggestion }) => (
    <Pressable style={styles.resultCard} onPress={() => navigation.navigate('TrailDetail', { trailId: item.id })}>
      <View style={styles.resultIcon}>
        <Ionicons name="trail-sign-outline" size={20} color="#630E13" />
      </View>
      <View style={styles.resultCopy}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultMeta}>
          {[item.region, item.distance_km ? `${item.distance_km.toFixed(1)} km` : null, item.difficulty]
            .filter(Boolean)
            .join(' | ')}
        </Text>
        {item.labels?.length ? <Text style={styles.resultLabels} numberOfLines={1}>{item.labels.slice(0, 4).join('  ')}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A7A6A" />
    </Pressable>
  );

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#2C2418" />
        </Pressable>
        <Text style={styles.title}>AI trail search</Text>
      </View>

      {!query ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Describe a trail</Text>
          <Text style={styles.stateText}>Search from Explore with a prompt like "easy 5km hike with water near Ramallah".</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#630E13" />
          <Text style={styles.stateTitle}>Finding trail options...</Text>
          <Text style={styles.stateText}>{query}</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Search failed</Text>
          <Text style={styles.stateText}>{errorMessage}</Text>
        </View>
      ) : existingTrails.length ? (
        <FlatList
          data={existingTrails}
          keyExtractor={(item) => item.id}
          renderItem={renderExistingTrail}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Text style={styles.subtitle}>Matches for "{query}"</Text>
              <Text style={styles.helperText}>Pick a trail to open its details and map.</Text>
            </View>
          }
        />
      ) : generatedTrail && hasGeneratedRoute ? (
        <View style={styles.generatedCard}>
          <View style={styles.generatedIcon}>
            <Ionicons name="sparkles" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.generatedTitle}>{generatedTrail.name_suggestion || result?.parsed.name_suggestion || 'Suggested Trail'}</Text>
          <Text style={styles.generatedMeta}>{formatGeneratedSummary(generatedTrail)}</Text>
          <Text style={styles.generatedText}>
            {generatedTrail.description_suggestion || result?.parsed.description_suggestion || 'AI generated a new route from your prompt.'}
          </Text>
          {generatedTrail.labels.length ? (
            <View style={styles.labelRow}>
              {generatedTrail.labels.slice(0, 5).map((label) => (
                <View key={label} style={styles.labelChip}>
                  <Text style={styles.labelText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable style={styles.createButton} onPress={() => navigation.navigate('CreateTrail', { generatedTrail })}>
            <Ionicons name="map-outline" size={18} color="#fff" />
            <Text style={styles.createButtonText}>Draw and save this route</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No trail generated</Text>
          <Text style={styles.stateText}>Try adding a location, distance, or difficulty to the prompt.</Text>
        </View>
      )}
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  listContent: { paddingBottom: 32 },
  resultsHeader: { marginBottom: 12 },
  subtitle: { color: '#2C2418', fontSize: 18, fontWeight: '900' },
  helperText: { marginTop: 4, color: '#6B5D4E', fontSize: 13, lineHeight: 19 },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  resultIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#F7EBE8', alignItems: 'center', justifyContent: 'center' },
  resultCopy: { flex: 1 },
  resultTitle: { color: '#2C2418', fontSize: 16, fontWeight: '900' },
  resultMeta: { marginTop: 4, color: '#6B5D4E', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  resultLabels: { marginTop: 6, color: '#8A7A6A', fontSize: 11, fontWeight: '700' },
  stateCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  stateTitle: { marginTop: 12, color: '#2C2418', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  stateText: { marginTop: 8, color: '#6B5D4E', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  generatedCard: { padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF' },
  generatedIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13' },
  generatedTitle: { marginTop: 14, color: '#2C2418', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  generatedMeta: { marginTop: 8, color: '#630E13', fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  generatedText: { marginTop: 12, color: '#4A4131', fontSize: 14, lineHeight: 21 },
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  labelChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#F1E7D2' },
  labelText: { color: '#5F594E', fontSize: 11, fontWeight: '800' },
  createButton: {
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
