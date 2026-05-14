import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { AnimatedScreen } from '../components/AnimatedUI';
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
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-PS' : 'en-US';

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadOfflineMaps = async () => {
        const maps = await getOfflineMapPacks();

        if (active) {
          setOfflineMaps(maps);
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
        ) : (
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
