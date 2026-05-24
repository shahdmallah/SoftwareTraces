import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AnimatedScreen } from '../components/AnimatedUI';
import {
  deleteOfflineMap,
  getPendingSync,
  getUserOfflineMaps,
  syncOfflineActivities,
  type OfflineMapRecord,
} from '../api/offlineApi';
import { buildMapImageUri } from '../config/mapConfig';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { getOfflineMapPacks, type OfflineMapPack } from '../state/offlineMaps';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OfflineDownloadsNavigationProp = StackNavigationProp<RootStackParamList, 'OfflineDownloads'>;

function formatDownloadedAt(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatBytes(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return '';
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function OfflineMapCard({
  map,
  isArabic,
  locale,
  onOpenMap,
}: {
  map: OfflineMapPack;
  isArabic: boolean;
  locale: string;
  onOpenMap: () => void;
}) {
  const mapImageUri = useMemo(() => {
    if (!map.coordinates) {
      return '';
    }

    const [lat, lng] = map.coordinates;
    return buildMapImageUri(lng, lat);
  }, [map.coordinates]);
  const trailName = isArabic ? map.trailNameAr || map.trailName : map.trailName;
  const region = isArabic ? map.regionAr || map.region : map.region;
  const downloadedAt = formatDownloadedAt(map.downloadedAt, locale);

  return (
    <Pressable style={({ pressed }) => [styles.mapCard, pressed && styles.mapCardPressed]} onPress={onOpenMap}>
      <View style={styles.mapPreview}>
        {mapImageUri ? (
          <Image source={{ uri: mapImageUri }} style={styles.mapImage} resizeMode="cover" />
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={34} color="#630E13" />
          </View>
        )}
        <View style={styles.mapStatusBadge}>
          <Ionicons name="cloud-done" size={15} color="#1E7A46" />
          <Text style={styles.mapStatusText}>{isArabic ? '\u062c\u0627\u0647\u0632' : 'Offline'}</Text>
        </View>
      </View>

      <View style={[styles.mapInfo, isArabic ? rtlRow : ltrRow]}>
        <View style={styles.mapCopy}>
          <Text style={[styles.mapTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
            {trailName}
          </Text>
          {region ? (
            <Text style={[styles.mapRegion, isArabic ? rtlText : ltrText]} numberOfLines={1}>
              {region}
            </Text>
          ) : null}
          {downloadedAt ? (
            <Text style={[styles.mapMeta, isArabic ? rtlText : ltrText]}>
              {isArabic ? '\u062a\u0645 \u0627\u0644\u062a\u062d\u0645\u064a\u0644 ' : 'Downloaded '}
              {downloadedAt}
            </Text>
          ) : null}
        </View>
        <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={20} color="#6B5D4E" />
      </View>
    </Pressable>
  );
}

export function OfflineDownloadsScreen() {
  const navigation = useNavigation<OfflineDownloadsNavigationProp>();
  const insets = useSafeAreaInsets();
  const [offlineMaps, setOfflineMaps] = useState<OfflineMapPack[]>([]);
  const [cloudMaps, setCloudMaps] = useState<OfflineMapRecord[]>([]);
  const [pendingSyncItems, setPendingSyncItems] = useState<Record<string, unknown>[]>([]);
  const [remoteError, setRemoteError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isLoadingRemote, setIsLoadingRemote] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingCloudMapId, setDeletingCloudMapId] = useState<string | null>(null);
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-PS' : 'en-US';

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadOfflineMaps = async () => {
        setIsLoadingRemote(true);
        setRemoteError('');

        const [localMaps, remoteMaps, syncRows] = await Promise.all([
          getOfflineMapPacks().catch(() => [] as OfflineMapPack[]),
          getUserOfflineMaps().catch((error) => {
            if (active) {
              setRemoteError(error instanceof Error ? error.message : 'Unable to load cloud offline maps.');
            }
            return [] as OfflineMapRecord[];
          }),
          getPendingSync().catch(() => [] as Record<string, unknown>[]),
        ]);

        if (active) {
          setOfflineMaps(localMaps);
          setCloudMaps(remoteMaps);
          setPendingSyncItems(syncRows);
          setIsLoadingRemote(false);
        }
      };

      void loadOfflineMaps();

      return () => {
        active = false;
      };
    }, []),
  );

  const handleOpenMap = (trailId: string) => {
    navigation.navigate('AppTabs', {
      screen: 'Map',
      params: { selectedTrailId: trailId },
    });
  };

  const handleSyncNow = async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncMessage('');
    try {
      const result = await syncOfflineActivities([]);
      const updates = await getPendingSync().catch(() => [] as Record<string, unknown>[]);
      setPendingSyncItems(updates);
      setSyncMessage(`${result.uploaded.length} uploaded, ${result.conflicts.length} conflicts`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Unable to sync offline changes.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteCloudMap = (map: OfflineMapRecord) => {
    Alert.alert('Delete offline map?', `Remove ${map.trail_name || 'this trail'} from your cloud downloads?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingCloudMapId(map.id);
          try {
            await deleteOfflineMap(map.id);
            setCloudMaps((current) => current.filter((item) => item.id !== map.id));
          } catch (error) {
            Alert.alert('Unable to delete map', error instanceof Error ? error.message : 'Please try again.');
          } finally {
            setDeletingCloudMapId(null);
          }
        },
      },
    ]);
  };

  return (
    <AnimatedScreen style={[styles.container, { paddingTop: Math.max(insets.top + 16, 32) }]}>
      <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
        </Pressable>
        <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
          {isArabic ? '\u062e\u0631\u0627\u0626\u0637 \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644' : 'Offline Maps'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.syncCard}>
          <View style={[styles.syncHeader, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.syncIcon}>
              <Ionicons name="sync-outline" size={18} color="#630E13" />
            </View>
            <View style={styles.syncCopy}>
              <Text style={[styles.syncTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'Cloud sync' : 'Cloud sync'}</Text>
              <Text style={[styles.syncText, isArabic ? rtlText : ltrText]}>
                {pendingSyncItems.length
                  ? `${pendingSyncItems.length} server updates ready`
                  : 'No server updates waiting'}
              </Text>
              {syncMessage ? <Text style={[styles.syncMessage, isArabic ? rtlText : ltrText]}>{syncMessage}</Text> : null}
            </View>
            <Pressable style={styles.syncButton} onPress={() => void handleSyncNow()} disabled={isSyncing}>
              {isSyncing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />}
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'Cloud downloads' : 'Cloud downloads'}</Text>
          {isLoadingRemote ? <ActivityIndicator size="small" color="#630E13" /> : null}
        </View>

        {remoteError ? <Text style={[styles.remoteError, isArabic ? rtlText : ltrText]}>{remoteError}</Text> : null}

        {cloudMaps.map((map) => {
          const downloadedAt = map.downloaded_at ? formatDownloadedAt(map.downloaded_at, locale) : '';
          const size = formatBytes(map.metadata?.bytes);

          return (
            <View key={map.id} style={styles.cloudMapCard}>
              <Pressable style={styles.cloudMapMain} onPress={() => handleOpenMap(map.trail_id)}>
                <View style={styles.cloudMapIcon}>
                  <Ionicons name="map-outline" size={20} color="#630E13" />
                </View>
                <View style={styles.cloudMapCopy}>
                  <Text style={[styles.cloudMapTitle, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                    {map.trail_name || 'Offline trail map'}
                  </Text>
                  <Text style={[styles.cloudMapMeta, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                    {[downloadedAt, size].filter(Boolean).join(' · ') || 'Saved in your account'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.cloudDeleteButton}
                onPress={() => handleDeleteCloudMap(map)}
                disabled={deletingCloudMapId === map.id}
              >
                {deletingCloudMapId === map.id ? (
                  <ActivityIndicator size="small" color="#8B1E1E" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color="#8B1E1E" />
                )}
              </Pressable>
            </View>
          );
        })}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>{isArabic ? 'On this device' : 'On this device'}</Text>
        </View>

        {offlineMaps.length ? (
          offlineMaps.map((map) => (
            <OfflineMapCard
              key={map.trailId}
              map={map}
              isArabic={isArabic}
              locale={locale}
              onOpenMap={() => handleOpenMap(map.trailId)}
            />
          ))
        ) : !cloudMaps.length && !isLoadingRemote ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-download-outline" size={34} color="#630E13" />
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u062e\u0631\u0627\u0626\u0637 \u0645\u062d\u0645\u0644\u0629' : 'No offline maps yet'}
            </Text>
            <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
              {isArabic
                ? '\u0627\u0636\u063a\u0637 \u0632\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644 \u0639\u0644\u0649 \u0623\u064a \u0645\u0633\u0627\u0631 \u0641\u064a \u0627\u0644\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0644\u062d\u0641\u0638\u0647 \u0647\u0646\u0627.'
                : 'Use the download button on a trail in Explore to save its map here.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1ED',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#2C2418',
    fontSize: 24,
    fontWeight: '900',
  },
  content: {
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  syncCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#E7D8C3',
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  syncCopy: {
    flex: 1,
  },
  syncTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  syncText: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '700',
  },
  syncMessage: {
    marginTop: 5,
    color: '#1E7A46',
    fontSize: 12,
    fontWeight: '800',
  },
  syncButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#630E13',
  },
  sectionHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  remoteError: {
    color: '#8B1E1E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  cloudMapCard: {
    minHeight: 74,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  cloudMapMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cloudMapIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F0E0',
  },
  cloudMapCopy: {
    flex: 1,
  },
  cloudMapTitle: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  cloudMapMeta: {
    marginTop: 4,
    color: '#7B6D5A',
    fontSize: 12,
    fontWeight: '700',
  },
  cloudDeleteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  mapCard: {
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  mapCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  mapPreview: {
    height: 190,
    backgroundColor: '#E8DFCE',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE7D7',
  },
  mapStatusBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  mapStatusText: {
    color: '#1E7A46',
    fontSize: 12,
    fontWeight: '900',
  },
  mapInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  mapCopy: {
    flex: 1,
  },
  mapTitle: {
    color: '#2C2418',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  mapRegion: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 13,
    fontWeight: '700',
  },
  mapMeta: {
    marginTop: 7,
    color: '#8B8172',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    minHeight: 260,
    borderRadius: 22,
    padding: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
