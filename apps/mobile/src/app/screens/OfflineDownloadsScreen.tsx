import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { AnimatedScreen } from '../components/AnimatedUI';
import { downloadOfflineMap, getPendingSync, syncOfflineActivities } from '../api/offlineApi';

type OfflineDownloadsNavigationProp = StackNavigationProp<RootStackParamList, 'OfflineDownloads'>;

export function OfflineDownloadsScreen() {
  const navigation = useNavigation<OfflineDownloadsNavigationProp>();
  const [pendingItems, setPendingItems] = useState<Record<string, unknown>[]>([]);
  const [trailId, setTrailId] = useState('');
  const [downloadedMaps, setDownloadedMaps] = useState<Array<{ trailId: string; tileRegion: string; tileUrlTemplate: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadPending = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await getPendingSync();
      setPendingItems(Array.isArray(data) ? data : []);
    } catch (error) {
      setPendingItems([]);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load offline sync queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMessage('');
    try {
      const result = await syncOfflineActivities([]);
      Alert.alert('Offline sync complete', `${Number((result as any).uploaded?.length ?? 0)} uploaded, ${Number((result as any).conflicts?.length ?? 0)} conflicts.`);
      await loadPending();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sync offline activity.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadMap = async () => {
    const id = trailId.trim();
    if (!id) {
      setErrorMessage('Enter a trail ID to download its offline map pack.');
      return;
    }

    setIsDownloading(true);
    setErrorMessage('');
    try {
      const map = await downloadOfflineMap(id);
      setDownloadedMaps((current) => [map, ...current.filter((item) => item.trailId !== map.trailId)]);
      setTrailId('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to download offline map.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="#2C2418" />
        </Pressable>
        <Text style={styles.title}>Offline Downloads</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sync queue</Text>
            {isLoading ? <ActivityIndicator color="#630E13" /> : null}
          </View>
          <Text style={styles.subtitle}>
            {pendingItems.length ? `${pendingItems.length} server updates are waiting to reconcile.` : 'No server-side updates are waiting.'}
          </Text>
          <Pressable style={[styles.primaryButton, isSyncing && styles.buttonDisabled]} onPress={handleSync} disabled={isSyncing}>
            {isSyncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Run offline sync</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void loadPending()}>
            <Text style={styles.secondaryButtonText}>Refresh queue</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offline map pack</Text>
          <TextInput
            value={trailId}
            onChangeText={(value) => {
              setTrailId(value);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder="Trail ID"
            placeholderTextColor="#A18F7A"
            style={styles.input}
            autoCapitalize="none"
          />
          <Pressable style={[styles.primaryButton, isDownloading && styles.buttonDisabled]} onPress={handleDownloadMap} disabled={isDownloading}>
            {isDownloading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Download map</Text>}
          </Pressable>
        </View>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {downloadedMaps.map((map) => (
          <View key={map.trailId} style={styles.mapRow}>
            <View>
              <Text style={styles.mapTitle}>Trail {map.trailId}</Text>
              <Text style={styles.mapMeta}>{map.tileRegion}</Text>
            </View>
            <Ionicons name="cloud-done-outline" size={20} color="#1E7A46" />
          </View>
        ))}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F1ED', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#2C2418', fontSize: 24, fontWeight: '900' },
  content: { paddingTop: 20, paddingBottom: 24, gap: 14 },
  subtitle: { color: '#6B5D4E', fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 20, padding: 16, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#2C2418', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  input: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F6F0E0',
    color: '#2C2418',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButton: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#630E13', marginTop: 12 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7EBE8', marginTop: 8 },
  secondaryButtonText: { color: '#630E13', fontSize: 13, fontWeight: '900' },
  buttonDisabled: { opacity: 0.7 },
  errorText: { color: '#8B1E1E', fontSize: 13, fontWeight: '800' },
  mapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 14, backgroundColor: '#FFF8F1' },
  mapTitle: { color: '#2C2418', fontSize: 14, fontWeight: '900' },
  mapMeta: { marginTop: 3, color: '#6B5D4E', fontSize: 12 },
});
