import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteOfflineMap, downloadOfflineMap, getUserOfflineMaps, type OfflineMapRecord } from '../api/offlineApi';
import { getTrailById, type Trail } from '../api/trailsApi';
import { AnimatedScreen } from '../components/AnimatedUI';
import { buildMapImageUri } from '../config/mapConfig';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/types';
import { getOfflineMapPacks, removeOfflineMapPack, saveOfflineMapPack, type OfflineMapPack } from '../state/offlineMaps';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type OfflineDownloadsNavigationProp = StackNavigationProp<RootStackParamList, 'OfflineDownloads'>;
type DisplayOfflineMapPack = OfflineMapPack & {
  recordId?: string;
  isOnDevice: boolean;
};

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

function formatLastUpdated(value?: string | null) {
  if (!value) return 'Last updated unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last updated unknown';
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
  if (sameDay) return 'Last updated today';
  return `Last updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
}

function countOfflineArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function getSnapshotUpdatedAt(map: OfflineMapPack) {
  if (map.safetySnapshot && typeof map.safetySnapshot === 'object' && 'generated_at' in map.safetySnapshot) {
    const generatedAt = (map.safetySnapshot as { generated_at?: unknown }).generated_at;
    if (typeof generatedAt === 'string') return generatedAt;
  }

  return map.generatedAt ?? map.downloadedAt;
}

function OfflineMapCard({
  map,
  isArabic,
  locale,
  onOpenMap,
  onDownloadToDevice,
  onRemovePackage,
  isDownloading,
}: {
  map: DisplayOfflineMapPack;
  isArabic: boolean;
  locale: string;
  onOpenMap: () => void;
  onDownloadToDevice: () => void;
  onRemovePackage: () => void;
  isDownloading: boolean;
}) {
  const mapImageUri = useMemo(() => {
    if (!map.coordinates) {
      return '';
    }

    const [lat, lng] = map.coordinates;
    return buildMapImageUri(lng, lat);
  }, [map.coordinates]);
  const previewImageUri = map.trail?.image || mapImageUri;
  const trailName = isArabic ? map.trailNameAr || map.trailName : map.trailName;
  const region = isArabic ? map.regionAr || map.region : map.region;
  const downloadedAt = formatDownloadedAt(map.downloadedAt, locale);
  const difficulty = map.trail?.difficulty ?? 'Offline';
  const checkpointCount = countOfflineArray(map.checkpointReports);
  const dangerZoneCount = countOfflineArray(map.safetyMarkers ?? map.safetyAlerts);
  const updatedLabel = formatLastUpdated(getSnapshotUpdatedAt(map));

  return (
    <Pressable style={({ pressed }) => [styles.mapCard, pressed && styles.mapCardPressed]} onPress={onOpenMap}>
      <View style={styles.mapPreview}>
        {previewImageUri ? (
          <Image source={{ uri: previewImageUri }} style={styles.mapImage} resizeMode="cover" />
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map-outline" size={34} color="#630E13" />
          </View>
        )}
        <View style={styles.mapStatusBadge}>
          <Ionicons name={map.isOnDevice ? 'cloud-done' : 'cloud-outline'} size={15} color={map.isOnDevice ? '#1E7A46' : '#6B5D4E'} />
          <Text style={[styles.mapStatusText, !map.isOnDevice && styles.mapStatusTextMuted]}>
            {map.isOnDevice ? (isArabic ? '\u062c\u0627\u0647\u0632' : 'Offline') : (isArabic ? '\u0641\u064a \u062d\u0633\u0627\u0628\u0643' : 'In account')}
          </Text>
        </View>
      </View>

      <View style={[styles.mapInfo, isArabic ? rtlRow : ltrRow]}>
        <View style={styles.mapCopy}>
          <View style={[styles.mapHeaderRow, isArabic ? rtlRow : ltrRow]}>
            <View style={styles.mapIdentity}>
              <Text style={[styles.mapTitle, isArabic ? rtlText : ltrText]} numberOfLines={2}>
                {trailName}
              </Text>
              {region ? (
                <Text style={[styles.mapRegion, isArabic ? rtlText : ltrText]} numberOfLines={1}>
                  {region}
                </Text>
              ) : null}
            </View>

            <View style={[styles.packageActions, isArabic ? rtlRow : ltrRow]}>
              <Pressable
                style={[styles.actionIconButton, styles.syncIconButton]}
                onPress={onDownloadToDevice}
                disabled={isDownloading}
                accessibilityLabel={map.isOnDevice ? 'Update offline snapshot' : 'Save offline package'}
                hitSlop={8}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#630E13" size="small" />
                ) : (
                  <Ionicons name={map.isOnDevice ? 'cloud-upload-outline' : 'cloud-download-outline'} size={19} color="#630E13" />
                )}
              </Pressable>
              <Pressable
                style={[styles.actionIconButton, styles.removeIconButton]}
                onPress={onRemovePackage}
                accessibilityLabel="Remove offline package"
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color="#8B1E1E" />
              </Pressable>
            </View>
          </View>
          <Text style={[styles.mapDifficulty, isArabic ? rtlText : ltrText]}>{difficulty}</Text>

          <View style={styles.packageLowerRow}>
            <View style={styles.packageFacts}>
              <View style={styles.packageFactRow}>
                <Ionicons name="checkmark-circle" size={15} color="#1E7A46" />
                <Text style={styles.packageFactText}>Available Offline</Text>
              </View>
              <Text style={styles.packageFactText}>{checkpointCount} checkpoints saved</Text>
              <Text style={styles.packageFactText}>{dangerZoneCount} danger zones nearby</Text>
              <Text style={styles.packageFactMuted}>{updatedLabel}{downloadedAt ? ` - ${downloadedAt}` : ''}</Text>
            </View>
          </View>
        </View>
        <Ionicons name={isArabic ? 'chevron-back' : 'chevron-forward'} size={20} color="#6B5D4E" />
      </View>
    </Pressable>
  );
}

function toOfflinePackFromTrail(record: OfflineMapRecord, trail?: Trail): DisplayOfflineMapPack {
  return {
    trailId: record.trail_id,
    trailName: trail?.name || record.trail_name || 'Downloaded trail',
    trailNameAr: trail?.nameAr,
    region: trail?.region,
    regionAr: trail?.regionAr,
    coordinates: trail?.coordinates,
    routeCoordinates: trail?.routeCoordinates,
    tileRegion: `trail-${record.trail_id}`,
    tileUrlTemplate: '',
    downloadedAt: record.downloaded_at ?? record.created_at ?? '',
    trail,
    recordId: record.id,
    isOnDevice: false,
  };
}

function mergeOfflineDownloads(
  localMaps: OfflineMapPack[],
  accountMaps: OfflineMapRecord[],
  accountTrails: Map<string, Trail>,
): DisplayOfflineMapPack[] {
  const byTrailId = new Map<string, DisplayOfflineMapPack>();

  localMaps.forEach((pack) => {
    byTrailId.set(pack.trailId, { ...pack, isOnDevice: true });
  });

  accountMaps.forEach((record) => {
    const existing = byTrailId.get(record.trail_id);
    const accountDownloadedAt = record.downloaded_at ?? record.created_at ?? existing?.downloadedAt ?? '';

    if (existing) {
      byTrailId.set(record.trail_id, {
        ...existing,
        recordId: existing.recordId ?? record.id,
        downloadedAt: existing.downloadedAt || accountDownloadedAt,
        trailName: existing.trailName || record.trail_name || accountTrails.get(record.trail_id)?.name || 'Downloaded trail',
      });
      return;
    }

    byTrailId.set(record.trail_id, toOfflinePackFromTrail(record, accountTrails.get(record.trail_id)));
  });

  return [...byTrailId.values()].sort((left, right) => {
    const leftTime = new Date(left.downloadedAt).getTime();
    const rightTime = new Date(right.downloadedAt).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

export function OfflineDownloadsScreen() {
  const navigation = useNavigation<OfflineDownloadsNavigationProp>();
  const insets = useSafeAreaInsets();
  const [offlineMaps, setOfflineMaps] = useState<DisplayOfflineMapPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingTrailIds, setDownloadingTrailIds] = useState<string[]>([]);
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-PS' : 'en-US';

  const loadOfflineMaps = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const localMaps = await getOfflineMapPacks().catch(() => [] as OfflineMapPack[]);
      let accountMaps: OfflineMapRecord[] = [];
      const accountTrails = new Map<string, Trail>();

      if (isAuthenticated) {
        try {
          accountMaps = await getUserOfflineMaps();
          const localTrailIds = new Set(localMaps.map((map) => map.trailId));
          const accountOnlyTrailIds = [...new Set(accountMaps.map((map) => map.trail_id))]
            .filter((trailId) => !localTrailIds.has(trailId));

          const trailEntries = await Promise.all(
            accountOnlyTrailIds.map(async (trailId) => {
              try {
                return [trailId, await getTrailById(trailId)] as const;
              } catch {
                return null;
              }
            }),
          );

          trailEntries.forEach((entry) => {
            if (entry) {
              accountTrails.set(entry[0], entry[1]);
            }
          });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load account downloads.');
        }
      }

      setOfflineMaps(mergeOfflineDownloads(localMaps, accountMaps, accountTrails));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void loadOfflineMaps();
    }, [loadOfflineMaps]),
  );

  const handleOpenMap = (trailId: string) => {
    navigation.navigate('AppTabs', {
      screen: 'Map',
      params: { selectedTrailId: trailId, mode: 'singleTrail' },
    });
  };

  const handleDownloadToDevice = async (map: DisplayOfflineMapPack) => {
    if (!isAuthenticated) {
      navigation.navigate('Auth', { mode: 'signin' });
      return;
    }

    if (downloadingTrailIds.includes(map.trailId)) {
      return;
    }

    setDownloadingTrailIds((current) => (current.includes(map.trailId) ? current : [...current, map.trailId]));

    try {
      const downloaded = await downloadOfflineMap(map.trailId);
      const trail = downloaded.trail ?? map.trail;

      await saveOfflineMapPack({
        trailId: downloaded.trailId,
        trailName: downloaded.trailName ?? map.trailName,
        trailNameAr: downloaded.trailNameAr ?? map.trailNameAr,
        region: downloaded.region ?? map.region,
        regionAr: downloaded.regionAr ?? map.regionAr,
        coordinates: downloaded.coordinates ?? map.coordinates,
        routeCoordinates: downloaded.routeCoordinates?.length ? downloaded.routeCoordinates : map.routeCoordinates,
        tileRegion: downloaded.tileRegion,
        tileUrlTemplate: downloaded.tileUrlTemplate,
        downloadedAt: new Date().toISOString(),
        trail,
        safetyAlerts: downloaded.safetyAlerts,
        safetyMarkers: downloaded.safetyMarkers,
        checkpointReports: downloaded.checkpointReports,
        accessRoute: downloaded.accessRoute,
        elevationProfile: downloaded.elevationProfile,
        safetySnapshot: downloaded.safetySnapshot,
        generatedAt: downloaded.generatedAt,
      });

      await loadOfflineMaps();
      Alert.alert(
        isArabic ? '\u062a\u0645 \u0627\u0644\u062d\u0641\u0638' : 'Saved to device',
        isArabic ? '\u0627\u0644\u0645\u0633\u0627\u0631 \u062c\u0627\u0647\u0632 \u0627\u0644\u0622\u0646 \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644.' : 'This trail is now ready offline on this device.',
      );
    } catch (error) {
      Alert.alert(
        isArabic ? '\u062a\u0639\u0630\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644' : 'Unable to download',
        error instanceof Error ? error.message : isArabic ? '\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.' : 'Please try again.',
      );
    } finally {
      setDownloadingTrailIds((current) => current.filter((trailId) => trailId !== map.trailId));
    }
  };

  const handleRemovePackage = (map: DisplayOfflineMapPack) => {
    Alert.alert(
      'Remove Offline Package',
      'This removes the saved trail and safety package from offline downloads.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await removeOfflineMapPack(map.trailId);
                if (map.recordId) {
                  await deleteOfflineMap(map.recordId).catch(() => undefined);
                }
                await loadOfflineMaps();
              } catch (error) {
                Alert.alert(
                  'Unable to remove package',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <AnimatedScreen style={[styles.container, { paddingTop: Math.max(insets.top + 16, 32) }]}>
      <View style={[styles.header, isArabic ? rtlRow : ltrRow]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name={isArabic ? 'chevron-forward' : 'chevron-back'} size={20} color="#2C2418" />
        </Pressable>
        <Text style={[styles.title, isArabic ? rtlText : ltrText]}>
          {isArabic ? '\u0627\u0644\u062a\u062d\u0645\u064a\u0644\u0627\u062a \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644' : 'Offline Downloads'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.packageHeader}>
          <Text style={[styles.packageTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? '\u062d\u0632\u0645\u0629 \u0627\u0644\u0623\u0645\u0627\u0646 \u0628\u062f\u0648\u0646 \u0627\u062a\u0635\u0627\u0644' : 'Offline Package Includes'}
          </Text>
          <View style={styles.packageList}>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0645\u0633\u0627\u0631 \u0627\u0644\u062a\u0631\u064a\u0644' : 'Trail geometry'}</Text>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0645\u0644\u0641 \u0627\u0644\u0627\u0631\u062a\u0641\u0627\u0639' : 'Elevation profile'}</Text>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0646\u0642\u0627\u0637 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0623\u0645\u0627\u0646' : 'Safety checkpoints'}</Text>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u062e\u0637\u0631 \u0627\u0644\u0642\u0631\u064a\u0628\u0629' : 'Danger zones nearby'}</Text>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0644\u0642\u0637\u0629 \u0645\u0633\u0627\u0631 \u0627\u0644\u0648\u0635\u0648\u0644' : 'Access route snapshot'}</Text>
            <Text style={[styles.packageItem, isArabic ? rtlText : ltrText]}>- {isArabic ? '\u0644\u0642\u0637\u0629 \u062d\u0627\u0644\u0629 \u0627\u0644\u0623\u0645\u0627\u0646' : 'Safety status snapshot'}</Text>
          </View>
          <Text style={[styles.packageNote, isArabic ? rtlText : ltrText]}>
            {isArabic
              ? '\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062d\u0645\u0644\u0629 \u0639\u0644\u0649 \u062d\u0633\u0627\u0628\u0643 \u0648\u0627\u0644\u062d\u0632\u0645 \u0627\u0644\u0645\u062d\u0641\u0648\u0638\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062c\u0647\u0627\u0632.'
              : 'Downloaded account trails appear here. Trails saved to this device stay available when your signal fades.'}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isArabic ? rtlText : ltrText]}>
            {isArabic ? '\u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062d\u0645\u0644\u0629' : 'Downloaded trails'}
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={17} color="#8A4B00" />
            <Text style={[styles.errorText, isArabic ? rtlText : ltrText]}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color="#630E13" />
            <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
              {isArabic ? '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062a...' : 'Loading downloaded trails...'}
            </Text>
          </View>
        ) : offlineMaps.length ? (
          offlineMaps.map((map) => (
            <OfflineMapCard
              key={map.trailId}
              map={map}
              isArabic={isArabic}
              locale={locale}
              onOpenMap={() => handleOpenMap(map.trailId)}
              onDownloadToDevice={() => void handleDownloadToDevice(map)}
              onRemovePackage={() => handleRemovePackage(map)}
              isDownloading={downloadingTrailIds.includes(map.trailId)}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-download-outline" size={34} color="#630E13" />
            <Text style={[styles.emptyTitle, isArabic ? rtlText : ltrText]}>
              {isArabic ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0633\u0627\u0631\u0627\u062a \u0645\u062d\u0645\u0644\u0629' : 'No downloaded trails yet'}
            </Text>
            <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
              {isArabic
                ? '\u0627\u0636\u063a\u0637 \u0632\u0631 \u0627\u0644\u062a\u062d\u0645\u064a\u0644 \u0639\u0644\u0649 \u0623\u064a \u0645\u0633\u0627\u0631 \u0641\u064a \u0627\u0644\u0627\u0633\u062a\u0643\u0634\u0627\u0641 \u0644\u062d\u0641\u0638\u0647 \u0647\u0646\u0627.'
                : 'Use the download button on a trail in Explore to save it here.'}
            </Text>
          </View>
        )}
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
  mapStatusTextMuted: {
    color: '#6B5D4E',
  },
  packageHeader: {
    marginBottom: 18,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FEF7EF',
  },
  packageTitle: {
    color: '#2C2418',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 10,
  },
  packageList: {
    gap: 8,
    marginBottom: 12,
  },
  packageItem: {
    color: '#5F594E',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  packageNote: {
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  mapInfo: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    padding: 16,
  },
  mapCopy: {
    flex: 1,
    minWidth: 0,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapIdentity: {
    flex: 1,
    minWidth: 0,
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
  mapDifficulty: {
    marginTop: 5,
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  mapMeta: {
    marginTop: 7,
    color: '#8B8172',
    fontSize: 12,
    fontWeight: '700',
  },
  packageLowerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 11,
  },
  packageFacts: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  packageFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageFactText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '800',
  },
  packageFactMuted: {
    color: '#8B8172',
    fontSize: 12,
    fontWeight: '700',
  },
  packageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 7,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  syncIconButton: {
    borderColor: '#F0CFC0',
    backgroundColor: '#F8E8DE',
  },
  removeIconButton: {
    borderColor: '#F2C9C7',
    backgroundColor: '#F8E3E1',
  },
  errorBanner: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4DD',
  },
  errorText: {
    flex: 1,
    color: '#8A4B00',
    fontSize: 12,
    fontWeight: '800',
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
