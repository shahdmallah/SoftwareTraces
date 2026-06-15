import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getCheckpointSuggestedRoutes,
  getRiskColor,
  getTrailAlternativeRoute,
  getTrailAccess,
  setTrailAccess,
  reportCheckpointStatus,
  suggestCheckpointRoute,
  type CheckpointRouteSuggestion,
  type CheckpointStatus,
  type RouteLineGeometry,
  type TrailAccess,
  type TrailAccessDangerZone,
} from '../api/safetyApi';

type MapboxModule = typeof import('@rnmapbox/maps');
type Coordinate = [number, number];

type Props = {
  trailId: string;
  isArabic: boolean;
  autoLoad?: boolean;
  fullScreen?: boolean;
  trailName?: string;
  topInset?: number;
  bottomInset?: number;
  onBack?: () => void;
  onRequireAuth?: () => void;
  canEditTrailhead?: boolean;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

type ReportDraft = {
  status: CheckpointStatus;
  wait_minutes: number;
  notes: string;
};

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';

let Mapbox: MapboxModule | null = null;
let mapboxLoadError: string | null = null;

try {
  // Load Mapbox lazily so stale native builds can still render the access cards.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = require('@rnmapbox/maps') as MapboxModule;
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} catch (error) {
  mapboxLoadError = error instanceof Error ? error.message : 'Mapbox native code is not available.';
}

function formatDistance(value?: number | null) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} km` : 'Unknown distance';
}

function formatDuration(value?: number | null) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} min` : 'Unknown time';
}

function formatSignedDistance(value?: number | null) {
  if (!Number.isFinite(Number(value))) return 'Unknown distance';
  const distance = Number(value);
  return `${distance >= 0 ? '+' : ''}${distance.toFixed(1)} km`;
}

function formatSignedDuration(value?: number | null) {
  if (!Number.isFinite(Number(value))) return 'Unknown time';
  const minutes = Math.round(Number(value));
  return `${minutes >= 0 ? '+' : ''}${minutes} min`;
}

function statusTone(status?: CheckpointStatus | null) {
  switch (status) {
    case 'open':
      return '#1E7A46';
    case 'slow':
      return '#D58612';
    case 'closed':
      return '#A5161B';
    default:
      return '#7B6D5A';
  }
}

function statusLabel(status?: CheckpointStatus | null, isArabic = false) {
  switch (status) {
    case 'open':
      return isArabic ? 'مفتوح' : 'Open';
    case 'slow':
      return isArabic ? 'بطيء' : 'Slow';
    case 'closed':
      return isArabic ? 'مغلق' : 'Closed';
    default:
      return isArabic ? 'غير معروف' : 'Unknown';
  }
}

function riskLabel(level?: string | null) {
  return (level ?? 'unknown').replace(/_/g, ' ');
}

function isCheckpoint(zone: TrailAccessDangerZone) {
  return zone.location_type === 'military_checkpoint' || zone.location_type === 'flying_checkpoint';
}

function hasRouteGeometry(value: unknown): value is RouteLineGeometry {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'LineString' &&
    Array.isArray((value as { coordinates?: unknown }).coordinates)
  );
}

function coordinatesFromGeometry(geometry?: RouteLineGeometry | unknown): Coordinate[] {
  if (!hasRouteGeometry(geometry)) {
    return [];
  }

  return geometry.coordinates.filter(
    (point): point is Coordinate =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(Number(point[0])) &&
      Number.isFinite(Number(point[1])),
  );
}

function comparisonSummary(suggestion: CheckpointRouteSuggestion) {
  const comparison = suggestion.comparison;
  return {
    original: `${formatDistance(comparison.original_distance_km)} / ${formatDuration(comparison.original_duration_minutes)}`,
    suggested: `${formatDistance(comparison.suggested_distance_km)} / ${formatDuration(comparison.suggested_duration_minutes)}`,
    extra: `${formatSignedDistance(comparison.extra_distance_km)} / ${formatSignedDuration(comparison.extra_time_minutes)}`,
  };
}

function formatReportAge(value?: string | null, isArabic = false) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return isArabic ? 'الآن' : 'just now';
  if (minutes < 60) return isArabic ? `قبل ${minutes} دقيقة` : `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  return isArabic ? `قبل ${hours} ساعة` : `${hours}h ago`;
}

export function GettingThereSection({
  trailId,
  isArabic,
  autoLoad = false,
  fullScreen = false,
  trailName,
  topInset = 0,
  bottomInset = 0,
  onBack,
  onRequireAuth,
  canEditTrailhead = false,
}: Props) {
  const hasAutoLoadedRef = useRef(false);
  const [access, setAccess] = useState<TrailAccess | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [submittingReportId, setSubmittingReportId] = useState<string | null>(null);
  const [suggestionsByCheckpoint, setSuggestionsByCheckpoint] = useState<Record<string, CheckpointRouteSuggestion[]>>({});
  const [activeWaypointCheckpointId, setActiveWaypointCheckpointId] = useState<string | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<{ checkpointId: string; latitude: number; longitude: number } | null>(null);
  const [submittingSuggestionId, setSubmittingSuggestionId] = useState<string | null>(null);
  const [latestSuggestion, setLatestSuggestion] = useState<CheckpointRouteSuggestion | null>(null);
  const [previewingAlternativeId, setPreviewingAlternativeId] = useState<string | null>(null);
  const [expandedReportIds, setExpandedReportIds] = useState<Record<string, boolean>>({});
  const [isSavingTrailhead, setIsSavingTrailhead] = useState(false);

  const routeCoordinates = useMemo(
    () => coordinatesFromGeometry(access?.driving_route.geometry),
    [access?.driving_route.geometry],
  );
  const suggestedRouteCoordinates = useMemo(
    () => coordinatesFromGeometry(latestSuggestion?.route_geometry),
    [latestSuggestion?.route_geometry],
  );
  const mapCenter = useMemo<Coordinate>(() => {
    if (routeCoordinates.length) {
      return routeCoordinates[Math.floor(routeCoordinates.length / 2)];
    }

    if (access?.trailhead) {
      return [access.trailhead.longitude, access.trailhead.latitude];
    }

    return [35.24, 31.78];
  }, [access?.trailhead, routeCoordinates]);

  const routeFeature = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: routeCoordinates.length >= 2
        ? [{
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: routeCoordinates },
          }]
        : [],
    }),
    [routeCoordinates],
  );

  const suggestedRouteFeature = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: suggestedRouteCoordinates.length >= 2
        ? [{
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: suggestedRouteCoordinates },
          }]
        : [],
    }),
    [suggestedRouteCoordinates],
  );

  const checkpointZones = useMemo(
    () => access?.danger_zones.filter(isCheckpoint) ?? [],
    [access?.danger_zones],
  );
  const hasFallbackTrailhead = Boolean(access?.trailhead.access_notes?.includes('no access route has been configured'));

  const toggleReportExpanded = (checkpointId: string) => {
    setExpandedReportIds((current) => ({
      ...current,
      [checkpointId]: !current[checkpointId],
    }));
  };

  const loadSuggestedRoutes = async (zones: TrailAccessDangerZone[]) => {
    const checkpoints = zones.filter(isCheckpoint);
    if (!checkpoints.length) {
      setSuggestionsByCheckpoint({});
      return;
    }

    const entries = await Promise.all(
      checkpoints.map(async (zone) => {
        try {
          const suggestions = await getCheckpointSuggestedRoutes(zone.id);
          return [zone.id, suggestions] as const;
        } catch {
          return [zone.id, zone.suggested_routes ?? []] as const;
        }
      }),
    );
    setSuggestionsByCheckpoint(Object.fromEntries(entries));
  };

  const loadAccess = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setLatestSuggestion(null);
    setActiveWaypointCheckpointId(null);
    setSelectedWaypoint(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setErrorMessage(
          isArabic
            ? 'نحتاج إذن الموقع لعرض الطريق الآمن إلى بداية المسار. سنضيف إدخال المدينة أو الإحداثيات يدوياً لاحقاً.'
            : 'Location permission is needed to show safety-aware access to the trailhead. Manual city or coordinate entry will be added later.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setUserLocation(currentLocation);

      const nextAccess = await getTrailAccess(trailId, {
        from_lat: currentLocation.latitude,
        from_lng: currentLocation.longitude,
      });
      setAccess(nextAccess);
      await loadSuggestedRoutes(nextAccess.danger_zones);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : isArabic ? 'تعذر تحميل معلومات الوصول.' : 'Unable to load access details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoLoad || hasAutoLoadedRef.current) {
      return;
    }

    hasAutoLoadedRef.current = true;
    void loadAccess();
  }, [autoLoad]);

  const saveTrailheadFromLocation = async () => {
    if (!canEditTrailhead) {
      return;
    }

    setIsSavingTrailhead(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          isArabic ? 'إذن الموقع مطلوب' : 'Location permission required',
          isArabic ? 'اسمح بالوصول إلى الموقع لتحديد نقطة البداية.' : 'Allow location access to set the trailhead.',
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextAccess = await setTrailAccess(trailId, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: trailName || access?.trailhead.name || 'Main trailhead',
        access_notes: 'Trailhead updated by trail owner.',
      });
      setAccess(nextAccess);
      Alert.alert(
        isArabic ? 'تم حفظ نقطة البداية' : 'Trailhead saved',
        isArabic ? 'تم تحديث نقطة الوصول لهذا المسار.' : 'The access point for this trail was updated.',
      );
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر حفظ نقطة البداية' : 'Unable to save trailhead',
        error instanceof Error ? error.message : isArabic ? 'حاول مرة أخرى.' : 'Please try again.',
      );
    } finally {
      setIsSavingTrailhead(false);
    }
  };

  const getDraft = (zone: TrailAccessDangerZone): ReportDraft => (
    reportDrafts[zone.id] ?? {
      status: zone.latest_report?.status ?? zone.checkpoint_status ?? 'slow',
      wait_minutes: zone.latest_report?.wait_minutes ?? (zone.checkpoint_status === 'closed' ? 0 : 20),
      notes: '',
    }
  );

  const updateDraft = (checkpointId: string, patch: Partial<ReportDraft>) => {
    setReportDrafts((current) => ({
      ...current,
      [checkpointId]: {
        ...(current[checkpointId] ?? { status: 'slow', wait_minutes: 20, notes: '' }),
        ...patch,
      },
    }));
  };

  const submitReport = async (zone: TrailAccessDangerZone) => {
    const draft = getDraft(zone);
    setSubmittingReportId(zone.id);

    try {
      const report = await reportCheckpointStatus(zone.id, {
        status: draft.status,
        wait_minutes: draft.status === 'slow' ? draft.wait_minutes : 0,
        notes: draft.notes.trim() || undefined,
      });

      setAccess((current) => current
        ? {
            ...current,
            danger_zones: current.danger_zones.map((item) => item.id === zone.id
              ? {
                  ...item,
                  checkpoint_status: report.status,
                  latest_report: report,
                }
              : item),
          }
        : current);
      Alert.alert(isArabic ? 'تم إرسال التقرير' : 'Report sent', isArabic ? 'شكراً لمساعدة المجتمع.' : 'Thanks for helping the community.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit checkpoint report.';
      if (/auth|unauthorized|sign in/i.test(message)) {
        onRequireAuth?.();
      }
      Alert.alert(isArabic ? 'تعذر إرسال التقرير' : 'Could not send report', message);
    } finally {
      setSubmittingReportId(null);
    }
  };

  const beginSuggestRoute = (zone: TrailAccessDangerZone) => {
    setLatestSuggestion(null);
    setActiveWaypointCheckpointId(zone.id);
    setSelectedWaypoint(null);
  };

  const submitRouteSuggestion = async (zone: TrailAccessDangerZone) => {
    if (!access || !userLocation || !selectedWaypoint || selectedWaypoint.checkpointId !== zone.id) {
      Alert.alert(
        isArabic ? 'اختر نقطة على الخريطة' : 'Pick a waypoint',
        isArabic ? 'اضغط على الخريطة لاختيار نقطة طريق بديلة.' : 'Tap the map to choose one alternative waypoint.',
      );
      return;
    }

    setSubmittingSuggestionId(zone.id);
    try {
      const suggestion = await suggestCheckpointRoute(zone.id, {
        from_lat: userLocation.latitude,
        from_lng: userLocation.longitude,
        trailhead_lat: access.trailhead.latitude,
        trailhead_lng: access.trailhead.longitude,
        waypoint_lat: selectedWaypoint.latitude,
        waypoint_lng: selectedWaypoint.longitude,
        waypoint_name: isArabic ? 'طريق بديل' : 'Alternative route',
        notes: isArabic ? 'طريق مقترح لتجنب الحاجز' : 'Suggested route to avoid the checkpoint',
      });

      setLatestSuggestion(suggestion);
      setSuggestionsByCheckpoint((current) => ({
        ...current,
        [zone.id]: [suggestion, ...(current[zone.id] ?? [])],
      }));
      setActiveWaypointCheckpointId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to suggest route.';
      if (/auth|unauthorized|sign in/i.test(message)) {
        onRequireAuth?.();
      }
      Alert.alert(isArabic ? 'تعذر اقتراح الطريق' : 'Could not suggest route', message);
    } finally {
      setSubmittingSuggestionId(null);
    }
  };

  const previewCommunityAlternative = async (zone: TrailAccessDangerZone, suggestion: CheckpointRouteSuggestion) => {
    if (!userLocation) {
      Alert.alert(
        isArabic ? 'الموقع مطلوب' : 'Location required',
        isArabic ? 'نحتاج موقعك الحالي لمقارنة الطريق البديل من مكانك.' : 'Your current location is needed to compare the alternative from where you are.',
      );
      return;
    }

    setPreviewingAlternativeId(suggestion.id);
    try {
      const alternative = await getTrailAlternativeRoute(trailId, {
        checkpoint_id: zone.id,
        from_lat: userLocation.latitude,
        from_lng: userLocation.longitude,
      });

      if (!alternative.route_available || !alternative.driving_route) {
        Alert.alert(
          isArabic ? 'الطريق غير متاح الآن' : 'Route unavailable',
          alternative.warning ?? (isArabic ? 'يمكنك رؤية نقطة الطريق المقترحة فقط حالياً.' : 'Only the suggested waypoint is available right now.'),
        );
        setLatestSuggestion(suggestion);
        return;
      }

      setLatestSuggestion({
        ...suggestion,
        waypoint: {
          latitude: alternative.waypoint?.latitude ?? suggestion.waypoint.latitude,
          longitude: alternative.waypoint?.longitude ?? suggestion.waypoint.longitude,
          name: alternative.waypoint?.name ?? suggestion.waypoint.name,
        },
        notes: alternative.waypoint?.notes ?? suggestion.notes,
        comparison: {
          original_distance_km: access?.driving_route.distance_km ?? suggestion.comparison.original_distance_km,
          original_duration_minutes: access?.driving_route.duration_minutes ?? suggestion.comparison.original_duration_minutes,
          suggested_distance_km: alternative.driving_route.distance_km,
          suggested_duration_minutes: alternative.driving_route.duration_minutes,
          extra_distance_km: alternative.extra_distance_km ?? null,
          extra_time_minutes: alternative.extra_time_minutes ?? null,
        },
        route_geometry: alternative.driving_route.geometry,
        route_available: true,
      });
    } catch (error) {
      Alert.alert(
        isArabic ? 'تعذر عرض الطريق البديل' : 'Could not preview alternative',
        error instanceof Error ? error.message : 'Unable to preview alternative route.',
      );
    } finally {
      setPreviewingAlternativeId(null);
    }
  };

  const handleMapPress = (event: any) => {
    if (!activeWaypointCheckpointId) {
      return;
    }

    const coordinate = event.geometry?.coordinates as Coordinate | undefined;
    if (!coordinate || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])) {
      return;
    }

    setSelectedWaypoint({
      checkpointId: activeWaypointCheckpointId,
      latitude: coordinate[1],
      longitude: coordinate[0],
    });
  };

  const DetailsContainer = (fullScreen ? ScrollView : View) as React.ComponentType<any>;
  const detailsContainerProps = fullScreen
    ? {
        style: styles.fullscreenSheet,
        contentContainerStyle: [styles.fullscreenSheetContent, { paddingBottom: Math.max(bottomInset + 24, 36) }],
        showsVerticalScrollIndicator: false,
      }
    : { style: styles.detailsStack };

  const renderMap = (expanded = false) => {
    if (!access) {
      return null;
    }

    if (!Mapbox || !MAPBOX_ACCESS_TOKEN) {
      return (
      <View style={[styles.mapFallback, expanded && styles.fullscreenMapFallback]}>
          <Ionicons name="map-outline" size={24} color="#630E13" />
          <Text style={[styles.mapFallbackText, isArabic ? styles.rtlText : null]}>
            {mapboxLoadError ?? (isArabic ? 'الخريطة غير متاحة الآن، لكن تفاصيل الوصول ظاهرة أدناه.' : 'The map is unavailable right now, but access details are shown below.')}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.mapWrap, expanded && styles.fullscreenMapWrap]}>
        <Mapbox.MapView
          style={styles.map}
          styleURL={MAPBOX_STYLE_URL}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          onPress={handleMapPress}
        >
          <Mapbox.Camera centerCoordinate={mapCenter} zoomLevel={10.5} />

          <Mapbox.ShapeSource id="getting-there-route" shape={routeFeature}>
            <Mapbox.LineLayer
              id="getting-there-route-line"
              style={{
                lineColor: '#1E7A46',
                lineWidth: 5,
                lineJoin: 'round',
                lineCap: 'round',
                lineOpacity: 0.9,
              }}
            />
          </Mapbox.ShapeSource>

          <Mapbox.ShapeSource id="getting-there-suggested-route" shape={suggestedRouteFeature}>
            <Mapbox.LineLayer
              id="getting-there-suggested-route-line"
              style={{
                lineColor: '#D58612',
                lineWidth: 4,
                lineJoin: 'round',
                lineCap: 'round',
                lineDasharray: [1.4, 1],
                lineOpacity: 0.9,
              }}
            />
          </Mapbox.ShapeSource>

          {userLocation ? (
            <Mapbox.MarkerView id="getting-there-user" coordinate={[userLocation.longitude, userLocation.latitude]}>
              <View style={[styles.mapPin, styles.userPin]}>
                <Ionicons name="navigate" size={13} color="#fff" />
              </View>
            </Mapbox.MarkerView>
          ) : null}

          <Mapbox.MarkerView id="getting-there-trailhead" coordinate={[access.trailhead.longitude, access.trailhead.latitude]}>
            <View style={[styles.mapPin, styles.trailheadPin]}>
              <Ionicons name="flag" size={13} color="#fff" />
            </View>
          </Mapbox.MarkerView>

          {access.danger_zones
            .filter((zone) => Number.isFinite(Number(zone.latitude)) && Number.isFinite(Number(zone.longitude)))
            .map((zone) => (
              <Mapbox.MarkerView key={zone.id} id={`danger-${zone.id}`} coordinate={[Number(zone.longitude), Number(zone.latitude)]}>
                <View style={[styles.mapPin, { backgroundColor: getRiskColor(zone.risk_level) }]}>
                  <Ionicons name="warning" size={13} color="#fff" />
                </View>
              </Mapbox.MarkerView>
            ))}

          {selectedWaypoint ? (
            <Mapbox.MarkerView id="getting-there-waypoint" coordinate={[selectedWaypoint.longitude, selectedWaypoint.latitude]}>
              <View style={[styles.mapPin, styles.waypointPin]}>
                <Ionicons name="git-branch-outline" size={13} color="#fff" />
              </View>
            </Mapbox.MarkerView>
          ) : null}
        </Mapbox.MapView>

        {activeWaypointCheckpointId ? (
          <View style={styles.mapHint}>
            <Text style={styles.mapHintText}>
              {isArabic ? 'اضغط على نقطة واحدة للطريق البديل' : 'Tap one waypoint for the alternative route'}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.card, fullScreen && styles.fullscreenCard]}>
      <View style={[styles.header, fullScreen && [styles.fullscreenHeader, { paddingTop: Math.max(topInset + 8, 16) }]]}>
        {fullScreen && onBack ? (
          <Pressable style={styles.fullscreenBackButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={21} color="#2C2418" />
          </Pressable>
        ) : null}
        <View style={[styles.headerIcon, fullScreen && styles.fullscreenHeaderIcon]}>
          <Ionicons name="car-outline" size={20} color="#630E13" />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isArabic ? styles.rtlText : null]}>
            {isArabic ? 'الوصول إلى بداية المسار' : 'Getting There'}
          </Text>
          <Text style={[styles.subtitle, isArabic ? styles.rtlText : null]} numberOfLines={fullScreen ? 1 : undefined}>
            {trailName || (isArabic ? 'وصول واعٍ بالسلامة إلى نقطة الانطلاق' : 'Safety-aware access to the trailhead')}
          </Text>
        </View>
      </View>

      {!access ? (
        <Pressable style={[styles.primaryButton, fullScreen && styles.fullscreenPrimaryButton, isLoading && styles.disabledButton]} onPress={loadAccess} disabled={isLoading}>
          {isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="locate-outline" size={18} color="#fff" />}
          <Text style={styles.primaryButtonText}>
            {isLoading ? (isArabic ? 'جارٍ تحديد الموقع...' : 'Finding route...') : isArabic ? 'اعرض طريق الوصول' : 'Show Getting There'}
          </Text>
        </Pressable>
      ) : (
        <Pressable style={[styles.refreshButton, fullScreen && styles.fullscreenRefreshButton]} onPress={loadAccess} disabled={isLoading}>
          {isLoading ? <ActivityIndicator size="small" color="#630E13" /> : <Ionicons name="refresh-outline" size={16} color="#630E13" />}
          <Text style={styles.refreshButtonText}>{isArabic ? 'تحديث الطريق' : 'Refresh access route'}</Text>
        </Pressable>
      )}

      {errorMessage ? (
        <View style={[styles.errorBox, fullScreen && styles.fullscreenErrorBox]}>
          <Ionicons name="alert-circle-outline" size={18} color="#A5161B" />
          <Text style={[styles.errorText, isArabic ? styles.rtlText : null]}>{errorMessage}</Text>
        </View>
      ) : null}

      {access ? (
        <View style={[styles.content, fullScreen && styles.fullscreenContent]}>
          {renderMap(fullScreen)}

          <DetailsContainer {...detailsContainerProps}>

          <View style={styles.trailheadCard}>
            <View style={styles.trailheadTop}>
              <View>
                <Text style={[styles.sectionLabel, isArabic ? styles.rtlText : null]}>{isArabic ? 'نقطة البداية' : 'Trailhead'}</Text>
                <Text style={[styles.trailheadName, isArabic ? styles.rtlText : null]}>
                  {isArabic ? access.trailhead.name_ar || access.trailhead.name || 'بداية المسار' : access.trailhead.name || 'Trailhead'}
                </Text>
                {canEditTrailhead ? (
                  <Pressable
                    style={[styles.ownerTrailheadButton, isSavingTrailhead && styles.disabledButton]}
                    onPress={() => void saveTrailheadFromLocation()}
                    disabled={isSavingTrailhead}
                  >
                    {isSavingTrailhead ? (
                      <ActivityIndicator size="small" color="#630E13" />
                    ) : (
                      <Ionicons name="pin-outline" size={16} color="#630E13" />
                    )}
                    <Text style={styles.ownerTrailheadButtonText}>
                      {isArabic ? 'حفظ موقعي كنقطة بداية' : 'Save my location as trailhead'}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={[styles.coordinates, isArabic ? styles.rtlText : null]}>
                  {access.trailhead.latitude.toFixed(5)}, {access.trailhead.longitude.toFixed(5)}
                </Text>
              </View>
              <View style={[styles.riskPill, { backgroundColor: `${getRiskColor(access.access_risk_level)}18` }]}>
                <Text style={[styles.riskPillText, { color: getRiskColor(access.access_risk_level) }]}>
                  {riskLabel(access.access_risk_level)}
                </Text>
              </View>
            </View>

            {hasFallbackTrailhead ? (
              <View style={styles.fallbackTrailheadBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#8A5A00" />
                <Text style={[styles.fallbackTrailheadText, isArabic ? styles.rtlText : null]}>
                  {isArabic ? 'نقطة الوصول غير مضبوطة لهذا المسار، لذلك نعرض بداية المسار الحالية.' : 'No dedicated access point is configured for this trail, so this uses the trail start point.'}
                </Text>
              </View>
            ) : null}

            <View style={styles.metricRow}>
              <View style={styles.metricPill}>
                <Ionicons name="speedometer-outline" size={15} color="#630E13" />
                <Text style={styles.metricText}>{formatDistance(access.driving_route.distance_km)}</Text>
              </View>
              <View style={styles.metricPill}>
                <Ionicons name="time-outline" size={15} color="#630E13" />
                <Text style={styles.metricText}>{formatDuration(access.driving_route.duration_minutes)}</Text>
              </View>
            </View>

            {access.driving_route.warning ? (
              <Text style={[styles.warningText, isArabic ? styles.rtlText : null]}>{access.driving_route.warning}</Text>
            ) : null}

            {access.trailhead.parking_notes || access.trailhead.parking_notes_ar ? (
              <InfoLine
                icon="car-sport-outline"
                label={isArabic ? 'ملاحظات الوقوف' : 'Parking'}
                value={isArabic ? access.trailhead.parking_notes_ar || access.trailhead.parking_notes : access.trailhead.parking_notes}
                isArabic={isArabic}
              />
            ) : null}

            {access.trailhead.access_notes || access.trailhead.access_notes_ar ? (
              <InfoLine
                icon="trail-sign-outline"
                label={isArabic ? 'ملاحظات الوصول' : 'Access notes'}
                value={isArabic ? access.trailhead.access_notes_ar || access.trailhead.access_notes : access.trailhead.access_notes}
                isArabic={isArabic}
              />
            ) : null}
          </View>

          {access.safety_tips.length ? (
            <View style={styles.tipsBox}>
              {access.safety_tips.slice(0, 3).map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <Ionicons name="shield-checkmark-outline" size={15} color="#7B5D10" />
                  <Text style={[styles.tipText, isArabic ? styles.rtlText : null]}>{tip}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.dangerHeader}>
            <Text style={[styles.sectionTitle, isArabic ? styles.rtlText : null]}>
              {isArabic ? 'نقاط الانتباه على الطريق' : 'Danger zones on the route'}
            </Text>
            <Text style={styles.countPill}>{access.danger_zones.length}</Text>
          </View>

          {access.danger_zones.length ? (
            access.danger_zones.map((zone) => {
              const draft = getDraft(zone);
              const currentStatus = zone.latest_report?.status ?? zone.checkpoint_status;
              const communitySuggestions = suggestionsByCheckpoint[zone.id] ?? zone.suggested_routes ?? [];
              const canSuggest = isCheckpoint(zone) && currentStatus === 'closed';
              const isSuggestingThis = activeWaypointCheckpointId === zone.id;
              return (
                <View key={zone.id} style={[styles.zoneCard, zone.risk_level === 'critical' && styles.criticalZoneCard]}>
                  <View style={styles.zoneHeader}>
                    <View style={[styles.zoneIcon, { backgroundColor: getRiskColor(zone.risk_level) }]}>
                      <Ionicons name={isCheckpoint(zone) ? 'shield-outline' : 'warning-outline'} size={18} color="#fff" />
                    </View>
                    <View style={styles.zoneCopy}>
                      <Text style={[styles.zoneName, isArabic ? styles.rtlText : null]}>
                        {isArabic ? zone.name_ar || zone.name : zone.name}
                      </Text>
                      {zone.name_ar && !isArabic ? <Text style={styles.zoneArabic}>{zone.name_ar}</Text> : null}
                      <Text style={[styles.zoneMeta, isArabic ? styles.rtlText : null]}>
                        {zone.location_type.replace(/_/g, ' ')} · {riskLabel(zone.risk_level)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: `${statusTone(currentStatus)}18` }]}>
                      <Text style={[styles.statusPillText, { color: statusTone(currentStatus) }]}>
                        {statusLabel(currentStatus, isArabic)}
                      </Text>
                    </View>
                  </View>

                  {zone.latest_report ? (
                    <View style={styles.latestReportBox}>
                      <Text style={[styles.latestReportText, isArabic ? styles.rtlText : null]}>
                        {isArabic ? 'آخر تقرير' : 'Latest report'}: {statusLabel(zone.latest_report.status, isArabic)}
                        {zone.latest_report.status !== 'closed' ? ` · ${zone.latest_report.wait_minutes} min` : ''}
                        {formatReportAge(zone.latest_report.created_at, isArabic) ? ` · ${formatReportAge(zone.latest_report.created_at, isArabic)}` : ''}
                      </Text>
                      {zone.latest_report.notes ? (
                        <Text style={[styles.reportNotes, isArabic ? styles.rtlText : null]}>{zone.latest_report.notes}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {isCheckpoint(zone) ? (
                    <View style={styles.reportBox}>
                      {zone.recent_reports?.length ? (
                        <View style={styles.recentReportsBox}>
                          <Text style={[styles.recentReportsTitle, isArabic ? styles.rtlText : null]}>
                            {isArabic ? 'تقارير المجتمع' : 'Community reports'}
                          </Text>
                          {zone.recent_reports.slice(0, 3).map((report, index) => (
                            <View key={report.id ?? `${zone.id}-${index}`} style={styles.recentReportRow}>
                              <View style={[styles.recentReportDot, { backgroundColor: statusTone(report.status) }]} />
                              <Text style={[styles.recentReportText, isArabic ? styles.rtlText : null]}>
                                {statusLabel(report.status, isArabic)}
                                {report.status === 'slow' ? ` · ${report.wait_minutes} min` : ''}
                                {formatReportAge(report.created_at, isArabic) ? ` · ${formatReportAge(report.created_at, isArabic)}` : ''}
                                {report.notes ? ` · ${report.notes}` : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.recentReportsBox}>
                          <Text style={[styles.recentReportText, isArabic ? styles.rtlText : null]}>
                            {isArabic ? 'لا توجد تقارير حديثة بعد.' : 'No recent community reports yet.'}
                          </Text>
                        </View>
                      )}

                      <Pressable style={styles.foldButton} onPress={() => toggleReportExpanded(zone.id)}>
                        <Ionicons name={expandedReportIds[zone.id] ? 'chevron-up' : 'chevron-down'} size={17} color="#630E13" />
                        <Text style={styles.foldButtonText}>
                          {expandedReportIds[zone.id] ? (isArabic ? 'إخفاء نموذج التقرير' : 'Hide report options') : isArabic ? 'أضف تقريراً' : 'Add a report'}
                        </Text>
                      </Pressable>

                      {expandedReportIds[zone.id] ? (
                        <View style={styles.reportForm}>
                      <Text style={[styles.reportTitle, isArabic ? styles.rtlText : null]}>
                        {isArabic ? 'أرسل حالة الحاجز' : 'Report checkpoint status'}
                      </Text>
                      <View style={styles.statusButtonRow}>
                        {(['open', 'slow', 'closed'] as CheckpointStatus[]).map((status) => {
                          const active = draft.status === status;
                          return (
                            <Pressable
                              key={status}
                              style={[
                                styles.statusButton,
                                active && { backgroundColor: statusTone(status), borderColor: statusTone(status) },
                              ]}
                              onPress={() => updateDraft(zone.id, { status, wait_minutes: status === 'slow' ? Math.max(draft.wait_minutes, 20) : 0 })}
                            >
                              <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>
                                {statusLabel(status, isArabic)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {draft.status !== 'closed' ? (
                        <View style={styles.waitStepper}>
                          <Text style={styles.waitLabel}>{isArabic ? 'الانتظار' : 'Wait'}</Text>
                          <Pressable style={styles.stepButton} onPress={() => updateDraft(zone.id, { wait_minutes: Math.max(0, draft.wait_minutes - 5) })}>
                            <Ionicons name="remove" size={16} color="#630E13" />
                          </Pressable>
                          <Text style={styles.waitValue}>{draft.wait_minutes} min</Text>
                          <Pressable style={styles.stepButton} onPress={() => updateDraft(zone.id, { wait_minutes: Math.min(300, draft.wait_minutes + 5) })}>
                            <Ionicons name="add" size={16} color="#630E13" />
                          </Pressable>
                        </View>
                      ) : null}

                      <TextInput
                        value={draft.notes}
                        onChangeText={(notes) => updateDraft(zone.id, { notes })}
                        placeholder={isArabic ? 'ملاحظات اختيارية' : 'Optional notes'}
                        placeholderTextColor="#A39483"
                        style={[styles.notesInput, isArabic ? styles.rtlText : null]}
                        multiline
                      />

                      <Pressable
                        style={[styles.submitReportButton, submittingReportId === zone.id && styles.disabledButton]}
                        onPress={() => void submitReport(zone)}
                        disabled={submittingReportId === zone.id}
                      >
                        {submittingReportId === zone.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send-outline" size={15} color="#fff" />}
                        <Text style={styles.submitReportText}>{isArabic ? 'إرسال التقرير' : 'Submit report'}</Text>
                      </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {canSuggest ? (
                    <View style={styles.alternativeBox}>
                      <Text style={[styles.alternativeHint, isArabic ? styles.rtlText : null]}>
                        {isArabic
                          ? 'الطريق البديل قد يكون أطول، لكنه قد يساعد على تجنب حاجز مغلق.'
                          : 'An alternative may be longer, but it can help avoid a closed checkpoint.'}
                      </Text>
                      <Pressable style={styles.secondaryButton} onPress={() => beginSuggestRoute(zone)}>
                        <Ionicons name="git-branch-outline" size={15} color="#630E13" />
                        <Text style={styles.secondaryButtonText}>
                          {isSuggestingThis ? (isArabic ? 'اختر نقطة على الخريطة' : 'Pick waypoint on map') : isArabic ? 'اقترح طريقاً بديلاً' : 'Suggest alternative route'}
                        </Text>
                      </Pressable>
                      {selectedWaypoint?.checkpointId === zone.id ? (
                        <Pressable
                          style={[styles.submitSuggestionButton, submittingSuggestionId === zone.id && styles.disabledButton]}
                          onPress={() => void submitRouteSuggestion(zone)}
                          disabled={submittingSuggestionId === zone.id}
                        >
                          {submittingSuggestionId === zone.id ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-outline" size={16} color="#fff" />}
                          <Text style={styles.submitSuggestionText}>{isArabic ? 'إرسال الطريق المقترح' : 'Submit suggested route'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {latestSuggestion?.checkpoint_id === zone.id ? (
                    <RouteComparisonCard suggestion={latestSuggestion} isArabic={isArabic} />
                  ) : null}

                  {communitySuggestions.length ? (
                    <View style={styles.communityBox}>
                      <Text style={[styles.communityTitle, isArabic ? styles.rtlText : null]}>
                        {isArabic ? 'اقتراحات المجتمع' : 'Community suggestions'}
                      </Text>
                      {communitySuggestions.slice(0, 3).map((suggestion) => (
                        <RouteComparisonCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          isArabic={isArabic}
                          compact
                          isPreviewing={previewingAlternativeId === suggestion.id}
                          onPreview={() => void previewCommunityAlternative(zone, suggestion)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyZones}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#1E7A46" />
              <Text style={[styles.emptyZonesText, isArabic ? styles.rtlText : null]}>
                {isArabic ? 'لا توجد مناطق خطر معروفة على هذا الطريق حالياً.' : 'No known danger zones on this access route right now.'}
              </Text>
            </View>
          )}
          </DetailsContainer>
        </View>
      ) : null}
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
  isArabic,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  isArabic: boolean;
}) {
  if (!value) return null;

  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color="#630E13" />
      <View style={styles.infoCopy}>
        <Text style={[styles.infoLabel, isArabic ? styles.rtlText : null]}>{label}</Text>
        <Text style={[styles.infoValue, isArabic ? styles.rtlText : null]}>{value}</Text>
      </View>
    </View>
  );
}

function RouteComparisonCard({
  suggestion,
  isArabic,
  compact,
  isPreviewing,
  onPreview,
}: {
  suggestion: CheckpointRouteSuggestion;
  isArabic: boolean;
  compact?: boolean;
  isPreviewing?: boolean;
  onPreview?: () => void;
}) {
  const summary = comparisonSummary(suggestion);

  return (
    <View style={[styles.comparisonCard, compact && styles.comparisonCardCompact]}>
      <Text style={[styles.comparisonTitle, isArabic ? styles.rtlText : null]}>
        {compact
          ? suggestion.waypoint.name || (isArabic ? 'طريق مقترح' : 'Suggested route')
          : isArabic ? 'نتيجة المقارنة' : 'Comparison result'}
      </Text>
      <Text style={[styles.comparisonLine, isArabic ? styles.rtlText : null]}>
        {isArabic ? 'الأصلي' : 'Original'}: {summary.original}
      </Text>
      <Text style={[styles.comparisonLine, isArabic ? styles.rtlText : null]}>
        {isArabic ? 'البديل' : 'Alternative'}: {summary.suggested}
      </Text>
      <Text style={[styles.comparisonExtra, isArabic ? styles.rtlText : null]}>
        {isArabic ? 'الإضافة' : 'Extra'}: {summary.extra}
      </Text>
      {suggestion.notes ? <Text style={[styles.comparisonNotes, isArabic ? styles.rtlText : null]}>{suggestion.notes}</Text> : null}
      {onPreview ? (
        <Pressable style={[styles.previewRouteButton, isPreviewing && styles.disabledButton]} onPress={onPreview} disabled={isPreviewing}>
          {isPreviewing ? <ActivityIndicator size="small" color="#630E13" /> : <Ionicons name="map-outline" size={15} color="#630E13" />}
          <Text style={styles.previewRouteText}>
            {isPreviewing ? (isArabic ? 'جارٍ العرض...' : 'Previewing...') : isArabic ? 'عرض من موقعي' : 'Preview from my location'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE5DA',
    gap: 14,
  },
  fullscreenCard: {
    flex: 1,
    borderRadius: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: '#15130F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullscreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(254,254,253,0.92)',
  },
  fullscreenBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F3E7',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  fullscreenHeaderIcon: {
    display: 'none',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#630E13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullscreenPrimaryButton: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 140,
    zIndex: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  refreshButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F7EBE8',
  },
  fullscreenRefreshButton: {
    position: 'absolute',
    top: 118,
    right: 14,
    zIndex: 21,
    backgroundColor: 'rgba(247,235,232,0.94)',
  },
  refreshButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.68,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFF0EE',
  },
  fullscreenErrorBox: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 140,
    zIndex: 22,
  },
  errorText: {
    flex: 1,
    color: '#A5161B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  content: {
    gap: 14,
  },
  detailsStack: {
    gap: 14,
  },
  fullscreenContent: {
    flex: 1,
    gap: 0,
  },
  fullscreenSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '48%',
    zIndex: 16,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: 'rgba(254,254,253,0.96)',
  },
  fullscreenSheetContent: {
    padding: 16,
    gap: 14,
  },
  mapWrap: {
    height: 260,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#E9EFE8',
  },
  fullscreenMapWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: undefined,
    borderRadius: 0,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    minHeight: 120,
    borderRadius: 18,
    backgroundColor: '#F7F3E7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  fullscreenMapFallback: {
    flex: 1,
    minHeight: undefined,
    borderRadius: 0,
  },
  mapFallbackText: {
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  mapPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A5161B',
  },
  userPin: {
    backgroundColor: '#2358B8',
  },
  trailheadPin: {
    backgroundColor: '#1E7A46',
  },
  waypointPin: {
    backgroundColor: '#D58612',
  },
  mapHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(44, 36, 24, 0.84)',
  },
  mapHintText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
  trailheadCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFF8F1',
    borderWidth: 1,
    borderColor: '#EADCCC',
    gap: 12,
  },
  trailheadTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionLabel: {
    color: '#7B6D5A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  trailheadName: {
    marginTop: 4,
    color: '#2C2418',
    fontSize: 16,
    fontWeight: '900',
  },
  ownerTrailheadButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F7EBE8',
  },
  ownerTrailheadButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '800',
  },
  coordinates: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 11,
    fontWeight: '700',
  },
  riskPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  riskPillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fallbackTrailheadBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#FFF8E6',
  },
  fallbackTrailheadText: {
    flex: 1,
    color: '#6B4D08',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  metricText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  warningText: {
    color: '#8A5A00',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#EADCCC',
    paddingTop: 10,
  },
  infoCopy: {
    flex: 1,
  },
  infoLabel: {
    color: '#7B6D5A',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  infoValue: {
    marginTop: 3,
    color: '#3B3124',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  tipsBox: {
    gap: 8,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFF8E6',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    flex: 1,
    color: '#6B4D08',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    flex: 1,
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '900',
  },
  countPill: {
    minWidth: 30,
    overflow: 'hidden',
    borderRadius: 15,
    paddingHorizontal: 9,
    paddingVertical: 6,
    color: '#630E13',
    backgroundColor: '#F7EBE8',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
  },
  zoneCard: {
    borderRadius: 20,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE3D6',
    gap: 12,
  },
  criticalZoneCard: {
    borderColor: '#A5161B',
    backgroundColor: '#FFF7F6',
  },
  zoneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  zoneIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCopy: {
    flex: 1,
  },
  zoneName: {
    color: '#2C2418',
    fontSize: 14,
    fontWeight: '900',
  },
  zoneArabic: {
    marginTop: 2,
    color: '#6B5D4E',
    fontSize: 12,
    fontWeight: '800',
  },
  zoneMeta: {
    marginTop: 3,
    color: '#7B6D5A',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  latestReportBox: {
    borderRadius: 14,
    padding: 11,
    backgroundColor: '#F7F3E7',
  },
  latestReportText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  reportNotes: {
    marginTop: 4,
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  reportBox: {
    gap: 10,
  },
  recentReportsBox: {
    gap: 8,
    borderRadius: 14,
    padding: 11,
    backgroundColor: '#F7F3E7',
  },
  recentReportsTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  recentReportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recentReportDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  recentReportText: {
    flex: 1,
    color: '#5C5042',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  foldButton: {
    minHeight: 38,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F7EBE8',
  },
  foldButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  reportForm: {
    gap: 10,
  },
  reportTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  statusButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6D9C8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F1',
  },
  statusButtonText: {
    color: '#3B3124',
    fontSize: 12,
    fontWeight: '900',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  waitStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waitLabel: {
    color: '#7B6D5A',
    fontSize: 12,
    fontWeight: '900',
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7EBE8',
  },
  waitValue: {
    minWidth: 58,
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  notesInput: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6D9C8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#2C2418',
    backgroundColor: '#FFFCF7',
    fontSize: 12,
    fontWeight: '700',
    textAlignVertical: 'top',
  },
  submitReportButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: '#630E13',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  submitReportText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  alternativeBox: {
    gap: 9,
    borderRadius: 16,
    padding: 11,
    backgroundColor: '#FFF8E6',
  },
  alternativeHint: {
    color: '#6B4D08',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F7EBE8',
  },
  secondaryButtonText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  submitSuggestionButton: {
    minHeight: 40,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#D58612',
  },
  submitSuggestionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  comparisonCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#F2F8EF',
    borderWidth: 1,
    borderColor: '#CFE4CA',
  },
  comparisonCardCompact: {
    backgroundColor: '#FFFCF7',
    borderColor: '#EFE3D6',
  },
  comparisonTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  comparisonLine: {
    marginTop: 5,
    color: '#3B3124',
    fontSize: 12,
    fontWeight: '800',
  },
  comparisonExtra: {
    marginTop: 5,
    color: '#8A5A00',
    fontSize: 12,
    fontWeight: '900',
  },
  comparisonNotes: {
    marginTop: 6,
    color: '#6B5D4E',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  previewRouteButton: {
    marginTop: 10,
    minHeight: 36,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F7EBE8',
  },
  previewRouteText: {
    color: '#630E13',
    fontSize: 12,
    fontWeight: '900',
  },
  communityBox: {
    gap: 8,
  },
  communityTitle: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyZones: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#F2F8EF',
    alignItems: 'center',
    gap: 8,
  },
  emptyZonesText: {
    color: '#3E5F3C',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
  },
});
