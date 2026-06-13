import React, { useMemo } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { AnimatedEntrance } from '../AnimatedUI';
import { completionRadii, completionShadow } from '../../features/trailCompletion/theme';
import { ltrText, rtlText } from '../../utils/direction';

type ProfilePoint = {
  distanceKm: number;
  elevationM: number;
  capturedAt?: number;
  speedKph?: number;
};

type PhotoTag = {
  uri: string;
  capturedAt: number;
  distanceKm?: number;
  elevationM?: number;
};

type ChartPoint = {
  x: number;
  y: number;
  distanceKm: number;
  elevationM: number;
};

type Props = {
  profile: ProfilePoint[];
  photoTags?: PhotoTag[];
  photoUris?: string[];
  isArabic: boolean;
  isOwner?: boolean;
  ownerName?: string;
  delay?: number;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 76;
const CHART_HEIGHT = 112;

function buildChartPoints(profile: ProfilePoint[]) {
  if (profile.length < 2) {
    return [];
  }

  const validProfile = profile
    .filter((point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (validProfile.length < 2) {
    return [];
  }

  const maxDistanceKm = validProfile[validProfile.length - 1]?.distanceKm ?? 0;
  if (maxDistanceKm <= 0) {
    return [];
  }

  const elevations = validProfile.map((point) => point.elevationM);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  const elevationRange = Math.max(28, maxElevation - minElevation);
  const padY = CHART_HEIGHT * 0.14;
  const plotHeight = CHART_HEIGHT - padY * 2;

  return validProfile.map((point) => ({
    x: (point.distanceKm / maxDistanceKm) * CHART_WIDTH,
    y: CHART_HEIGHT - padY - ((point.elevationM - minElevation) / elevationRange) * plotHeight,
    distanceKm: point.distanceKm,
    elevationM: point.elevationM,
  }));
}

function polylinePath(points: Array<Pick<ChartPoint, 'x' | 'y'>>) {
  if (!points.length) {
    return '';
  }

  return points.reduce((path, point, index) => (
    `${path}${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)} `
  ), '');
}

function buildAreaFillPath(points: ChartPoint[]) {
  if (!points.length) {
    return '';
  }

  const stroke = polylinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${stroke}L ${last.x.toFixed(2)} ${CHART_HEIGHT} L ${first.x.toFixed(2)} ${CHART_HEIGHT} Z`;
}

function getPointAtDistance(points: ChartPoint[], distanceKm: number) {
  if (!points.length) {
    return null;
  }

  if (distanceKm <= points[0].distanceKm) {
    return points[0];
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (distanceKm <= end.distanceKm) {
      const span = Math.max(0.0001, end.distanceKm - start.distanceKm);
      const t = (distanceKm - start.distanceKm) / span;

      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        distanceKm,
        elevationM: start.elevationM + (end.elevationM - start.elevationM) * t,
      };
    }
  }

  return points[points.length - 1];
}

function formatDistanceLabel(distanceKm: number | undefined, isArabic: boolean) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return isArabic ? 'المسافة غير متاحة' : 'Distance unavailable';
  }

  return isArabic ? `${distanceKm.toFixed(1)} كم` : `${distanceKm.toFixed(1)} km`;
}

function formatElevationLabel(elevationM: number | undefined, isArabic: boolean) {
  if (elevationM == null || !Number.isFinite(elevationM)) {
    return isArabic ? 'الارتفاع غير متاح' : 'Elevation unavailable';
  }

  return isArabic ? `${Math.round(elevationM)} م` : `${Math.round(elevationM)} m`;
}

export function ElevationPhotoTour({
  profile,
  photoTags,
  photoUris,
  isArabic,
  isOwner = true,
  ownerName,
  delay = 260,
}: Props) {
  const chartPoints = useMemo(() => buildChartPoints(profile), [profile]);
  const fillPath = useMemo(() => buildAreaFillPath(chartPoints), [chartPoints]);
  const strokePath = useMemo(() => polylinePath(chartPoints), [chartPoints]);
  const displayName = ownerName?.trim() || 'Trail friend';

  const tourPhotos = useMemo(() => {
    const allowedUris = new Set((photoUris ?? []).map((uri) => uri.trim()).filter(Boolean));
    const seen = new Set<string>();

    return (photoTags ?? [])
      .filter((photo) => {
        const normalizedUri = photo.uri?.trim();
        if (!normalizedUri || seen.has(normalizedUri)) {
          return false;
        }
        if (allowedUris.size > 0 && !allowedUris.has(normalizedUri)) {
          return false;
        }
        seen.add(normalizedUri);
        return true;
      })
      .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
      .slice(0, 6);
  }, [photoTags, photoUris]);

  const title = isOwner
    ? (isArabic ? 'جولة الارتفاع بالصور' : 'Elevation tour with photos')
    : (isArabic ? `جولة ارتفاع ${displayName}` : `${displayName}'s elevation tour`);
  const subtitle = isOwner
    ? (isArabic ? 'شاهد كيف توزعت صورك على الصعود من البداية حتى النهاية' : 'See how your photos line up with the climb from start to finish')
    : (isArabic ? 'محطات مصورة على امتداد الرحلة المنشورة' : 'Photo waypoints across the published climb');

  if (chartPoints.length < 2 && tourPhotos.length === 0) {
    return null;
  }

  return (
    <AnimatedEntrance
      fromY={14}
      duration={440}
      delay={delay}
      style={[styles.card, completionShadow.card]}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="analytics-outline" size={18} color="#630E13" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isArabic ? rtlText : ltrText]}>{title}</Text>
          <Text style={[styles.subtitle, isArabic ? rtlText : ltrText]}>{subtitle}</Text>
        </View>
      </View>

      {chartPoints.length >= 2 ? (
        <View style={styles.chartShell}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            <Defs>
              <LinearGradient id="completionElevFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#630E13" stopOpacity="0.18" />
                <Stop offset="1" stopColor="#630E13" stopOpacity="0.03" />
              </LinearGradient>
            </Defs>

            <Path d={fillPath} fill="url(#completionElevFill)" />
            <Path
              d={strokePath}
              fill="none"
              stroke="rgba(99,14,19,0.26)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={strokePath}
              fill="none"
              stroke="#630E13"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {tourPhotos.map((photo, index) => {
              if (photo.distanceKm == null || !Number.isFinite(photo.distanceKm)) {
                return null;
              }

              const point = getPointAtDistance(chartPoints, photo.distanceKm);
              if (!point) {
                return null;
              }

              return (
                <Circle
                  key={`${photo.uri}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={5.5}
                  fill="#FFF8F1"
                  stroke="#630E13"
                  strokeWidth={2.5}
                />
              );
            })}
          </Svg>

          <View style={styles.axisRow}>
            <Text style={styles.axisText}>0 km</Text>
            <Text style={styles.axisText}>
              {profile.length ? `${((profile[profile.length - 1]?.distanceKm ?? 0) / 2).toFixed(1)} km` : '—'}
            </Text>
            <Text style={styles.axisText}>
              {profile.length ? `${(profile[profile.length - 1]?.distanceKm ?? 0).toFixed(1)} km` : '—'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="trending-up-outline" size={24} color="#8A7A6A" />
          <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'لا توجد عينات ارتفاع كافية لهذا الملخص.' : 'Not enough elevation samples for this recap.'}
          </Text>
        </View>
      )}

      {tourPhotos.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRail}
        >
          {tourPhotos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              <View style={styles.photoBody}>
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>
                    {isArabic ? `محطة ${index + 1}` : `Stop ${index + 1}`}
                  </Text>
                </View>
                <Text style={[styles.photoMetric, isArabic ? rtlText : ltrText]}>
                  {formatDistanceLabel(photo.distanceKm, isArabic)}
                </Text>
                <Text style={[styles.photoMeta, isArabic ? rtlText : ltrText]}>
                  {formatElevationLabel(photo.elevationM, isArabic)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={24} color="#8A7A6A" />
          <Text style={[styles.emptyText, isArabic ? rtlText : ltrText]}>
            {isArabic ? 'أضف صوراً مرتبطة بالمسار ليظهر التور المصور هنا.' : 'Add route-linked photos to turn the elevation profile into a photo tour.'}
          </Text>
        </View>
      )}
    </AnimatedEntrance>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: completionRadii.card,
    backgroundColor: '#FFFCF8',
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C2418',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B5D4E',
    fontWeight: '600',
    lineHeight: 18,
  },
  chartShell: {
    paddingHorizontal: 18,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisText: {
    color: '#8A7A6A',
    fontSize: 11,
    fontWeight: '700',
  },
  photoRail: {
    paddingHorizontal: 14,
    gap: 12,
    marginTop: 16,
  },
  photoCard: {
    width: 168,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,36,24,0.08)',
  },
  photoImage: {
    width: '100%',
    height: 128,
    backgroundColor: '#E7D8C3',
  },
  photoBody: {
    padding: 12,
  },
  photoBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#F7EBE8',
  },
  photoBadgeText: {
    color: '#630E13',
    fontSize: 10,
    fontWeight: '900',
  },
  photoMetric: {
    marginTop: 10,
    color: '#2C2418',
    fontSize: 13,
    fontWeight: '900',
  },
  photoMeta: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: '#6B5D4E',
    fontWeight: '600',
  },
});
