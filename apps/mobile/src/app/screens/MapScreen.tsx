// Updated to request device location, load nearby trails from the backend, and render full trail previews with a neon green route line.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { AppTabParamList, RootStackParamList } from '../navigation/types';
import { getNearbyTrails, getTrailById, type Trail } from '../api/trailsApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';
import { AnimatedBlock, AnimatedScreen } from '../components/AnimatedUI';
import { getTrailRouteCoordinates } from '../state/trailRoutes';
import { ltrRow, ltrText, rtlRow, rtlText } from '../utils/direction';

type MapScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TrailDetail'>;
type MapScreenRouteProp = RouteProp<AppTabParamList, 'Map'>;
type MapboxModule = typeof import('@rnmapbox/maps');

const { width, height } = Dimensions.get('window');
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
const MAPBOX_STYLE_URL =
  process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/shahdmallah/cmnqgt687000h01s66inve68a';

let Mapbox: MapboxModule | null = null;
let mapboxLoadError: string | null = null;

try {
  // Load Mapbox lazily so Expo Go or stale native builds don't hard-crash the whole screen.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Mapbox = require('@rnmapbox/maps') as MapboxModule;
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} catch (error) {
  mapboxLoadError = error instanceof Error ? error.message : 'Mapbox native code not available.';
}

const difficultyColor: Record<string, string> = {
  Easy: '#7A9A3A',
  Moderate: '#D4A843',
  Hard: '#BB2823',
  Expert: '#630E13',
};

const fallbackCenter: [number, number] = [35.24, 31.78];

function toMapboxCoordinate(trail: Trail): [number, number] {
  return [trail.coordinates[1], trail.coordinates[0]];
}

function toLineFeature(coordinates: [number, number][] | null): FeatureCollection {
  const features: Feature<LineString>[] =
    coordinates && coordinates.length >= 2
      ? [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        ]
      : [];

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function MapScreen() {
  const navigation = useNavigation<MapScreenNavigationProp>();
  const route = useRoute<MapScreenRouteProp>();
  const cameraRef = useRef<any>(null);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [nearbyTrails, setNearbyTrails] = useState<Trail[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(7.6);
  const [isThreeD, setIsThreeD] = useState(true);
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const canRenderMapbox = Boolean(Mapbox && !mapboxLoadError);
  const trailCountLabel = useMemo(() => `${nearbyTrails.length} trails`, [nearbyTrails.length]);
  const selectedTrailRoute = useMemo(() => {
    if (!selectedTrail) {
      return null;
    }

    return selectedTrail.routeCoordinates ?? getTrailRouteCoordinates(selectedTrail.id);
  }, [selectedTrail]);
  const selectedTrailLine = useMemo(() => toLineFeature(selectedTrailRoute), [selectedTrailRoute]);

  useEffect(() => {
    let cancelled = false;

    const loadNearby = async () => {
      setIsLoading(true);
      setFetchError(null);
      setLocationMessage(null);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          throw new Error('Location permission is required to load nearby trails.');
        }

        const position = await Location.getCurrentPositionAsync({});
        const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
        const trails = await getNearbyTrails({
          lat: coords[0],
          lng: coords[1],
          radius: 20000,
        });

        if (!cancelled) {
          setUserLocation(coords);
          setNearbyTrails(trails);
          setSelectedTrail(trails[0] ?? null);
          
        }
      } catch (error) {
        if (!cancelled) {
          setNearbyTrails([]);
          setSelectedTrail(null);
          setFetchError(error instanceof Error ? error.message : 'Unable to load nearby trails.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadNearby();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    const nextCenter = selectedTrail
      ? toMapboxCoordinate(selectedTrail)
      : userLocation
        ? [userLocation[1], userLocation[0]]
        : fallbackCenter;

    cameraRef.current?.setCamera({
      centerCoordinate: nextCenter,
      zoomLevel: selectedTrail ? 8.8 : 7.6,
      pitch: isThreeD ? 48 : 0,
      animationDuration: 900,
    });

    setZoomLevel(selectedTrail ? 8.8 : 7.6);

    if (selectedTrailRoute && selectedTrailRoute.length >= 2) {
      const longitudes = selectedTrailRoute.map((point) => point[0]);
      const latitudes = selectedTrailRoute.map((point) => point[1]);

      cameraRef.current?.fitBounds(
        [Math.max(...longitudes), Math.max(...latitudes)],
        [Math.min(...longitudes), Math.min(...latitudes)],
        80,
        900,
      );
    }
  }, [canRenderMapbox, isThreeD, selectedTrail, selectedTrailRoute, userLocation]);

  useEffect(() => {
    if (!canRenderMapbox) {
      return;
    }

    cameraRef.current?.setCamera({
      zoomLevel,
      pitch: isThreeD ? 48 : 0,
      animationDuration: 250,
    });
  }, [canRenderMapbox, isThreeD, zoomLevel]);

  useEffect(() => {
    const selectedTrailId = route.params?.selectedTrailId;

    if (!selectedTrailId) {
      return;
    }

    const existingTrail = nearbyTrails.find((trail) => trail.id === selectedTrailId);

    if (existingTrail) {
      setSelectedTrail(existingTrail);
      return;
    }

    let cancelled = false;

    const loadRequestedTrail = async () => {
      try {
        const trail = await getTrailById(selectedTrailId);

        if (!cancelled) {
          setSelectedTrail(trail);
          setNearbyTrails((current) => (current.some((item) => item.id === trail.id) ? current : [trail, ...current]));
        }
      } catch {
        // Keep the current map state if the linked trail cannot be fetched.
      }
    };

    void loadRequestedTrail();

    return () => {
      cancelled = true;
    };
  }, [nearbyTrails, route.params?.selectedTrailId]);

  const handleTrailPress = (trail: Trail) => {
    setSelectedTrail(trail);
  };

  const handleTrailDetail = () => {
    if (selectedTrail) {
      navigation.navigate('TrailDetail', { trailId: selectedTrail.id });
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AppTabs', { screen: 'Explore' });
  };

  const handleZoomIn = () => {
    setZoomLevel((current) => Math.min(current + 0.7, 18));
  };

  const handleZoomOut = () => {
    setZoomLevel((current) => Math.max(current - 0.7, 3));
  };

  return (
    <AnimatedScreen style={styles.container}>
      {canRenderMapbox && Mapbox ? (
        <Mapbox.MapView
          style={styles.map}
          styleURL={MAPBOX_STYLE_URL || Mapbox.StyleURL.Outdoors}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
          rotateEnabled
          pitchEnabled
        >
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: fallbackCenter,
              zoomLevel: 7.2,
              pitch: 20,
            }}
          />
          <Mapbox.LocationPuck visible={Boolean(userLocation)} puckBearingEnabled puckBearing="heading" />

          {selectedTrailRoute && selectedTrailRoute.length >= 2 ? (
            <Mapbox.ShapeSource id="selected-trail-route-source" shape={selectedTrailLine}>
              <Mapbox.LineLayer
                id="selected-trail-route-line"
                style={{
                  lineColor: '#39FF14',
                  lineWidth: 5,
                  lineOpacity: 0.9,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </Mapbox.ShapeSource>
          ) : null}

          {nearbyTrails.map((trail) => {
            const active = selectedTrail?.id === trail.id;

            return (
              <Mapbox.PointAnnotation
                key={trail.id}
                id={trail.id}
                coordinate={toMapboxCoordinate(trail)}
                onSelected={() => handleTrailPress(trail)}
              >
                <View
                  style={[
                    styles.markerOuter,
                    active && styles.markerOuterActive,
                    { borderColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                  ]}
                >
                  <View
                    style={[
                      styles.markerInner,
                      { backgroundColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                    ]}
                  />
                </View>
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>
      ) : (
        <View style={styles.fallbackMap}>
          <View style={styles.fallbackGlow} />
          <View style={styles.fallbackCard}>
            <Ionicons name="warning-outline" size={30} color="#D4A843" />
            <Text style={styles.fallbackTitle}>Mapbox native build required</Text>
            <Text style={styles.fallbackText}>
              This screen is loading the JS code, but the installed app binary does not include the
              native Mapbox module yet.
            </Text>
            <Text style={styles.fallbackCode}>
              {mapboxLoadError ?? 'Mapbox native code not available.'}
            </Text>
          </View>
        </View>
      )}

      <AnimatedBlock delay={60} style={[styles.topOverlay, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <View style={[styles.headerControls, isArabic ? rtlRow : ltrRow]}>
          <Pressable style={styles.floatingControlButton} onPress={handleBack}>
            <Ionicons name={isArabic ? 'arrow-forward' : 'arrow-back'} size={22} color="#2C2418" />
          </Pressable>

          <View style={[styles.headerStatusPill, isArabic ? rtlRow : ltrRow]}>
            <Ionicons name="map-outline" size={14} color="#EAE2CC" />
            <Text style={styles.heroBadgeText}>{trailCountLabel}</Text>
          </View>

          <Pressable
            style={[styles.floatingControlButton, isThreeD && styles.floatingControlButtonActive]}
            onPress={() => setIsThreeD((current) => !current)}
          >
            <Text style={[styles.floatingControlLabel, isThreeD && styles.floatingControlLabelActive]}>3D</Text>
          </Pressable>
        </View>

        {!MAPBOX_ACCESS_TOKEN ? (
          <View style={styles.tokenWarning}>
            <Ionicons name="alert-circle-outline" size={16} color="#D4A843" />
            <Text style={[styles.tokenWarningText, isArabic ? rtlText : ltrText]}>
              Add `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to load your Mapbox tiles.
            </Text>
          </View>
        ) : null}

        {locationMessage ? (
          <View style={styles.infoBanner}>
            <Text style={[styles.infoBannerText, isArabic ? rtlText : ltrText]}>{locationMessage}</Text>
          </View>
        ) : null}
      </AnimatedBlock>

      <AnimatedBlock
        delay={100}
        style={[styles.zoomControls, { top: Math.max(insets.top + 96, 118) }]}
      >
        <Pressable style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={22} color="#2C2418" />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={22} color="#2C2418" />
        </Pressable>
      </AnimatedBlock>

      <AnimatedBlock delay={140} style={[styles.bottomOverlay, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        {isLoading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Finding trails near you...</Text>
          </View>
        ) : fetchError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>{fetchError}</Text>
            <Text style={styles.stateText}>Reopen this tab after granting location permission.</Text>
          </View>
        ) : nearbyTrails.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>No nearby trails found.</Text>
            <Text style={styles.stateText}>Try moving to a different area and loading the map again.</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trailStrip}
            >
              {nearbyTrails.map((trail) => {
                const active = selectedTrail?.id === trail.id;
                return (
                  <Pressable
                    key={trail.id}
                    style={[styles.trailChip, active && styles.trailChipActive]}
                    onPress={() => handleTrailPress(trail)}
                  >
                    <View
                      style={[
                        styles.trailChipDot,
                        { backgroundColor: difficultyColor[trail.difficulty] || '#7A9A3A' },
                      ]}
                    />
                    <View>
                      <Text style={[styles.trailChipName, isArabic ? rtlText : ltrText, active && styles.trailChipNameActive]}>
                        {isArabic ? trail.nameAr : trail.name}
                      </Text>
                      <Text style={[styles.trailChipMeta, active && styles.trailChipMetaActive]}>
                        {trail.distance.toFixed(1)} km
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedTrail ? (
              <View style={styles.trailCard}>
                <View style={[styles.trailCardHeader, isArabic ? rtlRow : ltrRow]}>
                  <View>
                    <Text style={[styles.trailName, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.nameAr : selectedTrail.name}</Text>
                    <Text style={[styles.trailRegion, isArabic ? rtlText : ltrText]}>{isArabic ? selectedTrail.regionAr : selectedTrail.region}</Text>
                  </View>
                  <View
                    style={[
                      styles.difficultyPill,
                      { backgroundColor: `${difficultyColor[selectedTrail.difficulty] || '#7A9A3A'}22` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.difficultyPillText,
                        { color: difficultyColor[selectedTrail.difficulty] || '#7A9A3A' },
                      ]}
                    >
                      {selectedTrail.difficulty}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Ionicons name="resize-outline" size={14} color="#D4A843" />
                    <Text style={styles.statPillText}>{selectedTrail.distance.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="time-outline" size={14} color="#7DB3CC" />
                    <Text style={styles.statPillText}>{selectedTrail.duration}</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="trending-up-outline" size={14} color="#BB2823" />
                    <Text style={styles.statPillText}>{selectedTrail.elevationGain} m</Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={[styles.trailDescription, isArabic ? rtlText : ltrText]}>
                  {isArabic ? selectedTrail.descriptionAr : selectedTrail.description}
                </Text>

                <View style={[styles.cardActions, isArabic ? rtlRow : ltrRow]}>
                  <Pressable style={styles.secondaryButton} onPress={() => handleTrailPress(selectedTrail)}>
                    <Ionicons name="locate-outline" size={16} color="#2C2418" />
                    <Text style={styles.secondaryButtonText}>Center</Text>
                  </Pressable>
                  <Pressable style={styles.detailButton} onPress={handleTrailDetail}>
                    <Ionicons name="information-circle-outline" size={16} color="#fff" />
                    <Text style={styles.detailButtonText}>{t('viewDetails')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        )}
      </AnimatedBlock>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#120408',
  },
  map: {
    width,
    height,
  },
  fallbackMap: {
    width,
    height,
    backgroundColor: '#120408',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  fallbackGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99,14,19,0.35)',
  },
  fallbackCard: {
    width: '100%',
    borderRadius: 28,
    padding: 20,
    backgroundColor: 'rgba(18,4,8,0.88)',
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingControlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(234,226,204,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  floatingControlButtonActive: {
    backgroundColor: '#630E13',
  },
  floatingControlLabel: {
    color: '#2C2418',
    fontSize: 15,
    fontWeight: '800',
  },
  floatingControlLabelActive: {
    color: '#FFFFFF',
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(18,4,8,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroBadgeText: {
    color: '#EAE2CC',
    fontSize: 12,
    fontWeight: '700',
  },
  tokenWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18,4,8,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.24)',
  },
  tokenWarningText: {
    flex: 1,
    color: '#F4E6B0',
    fontSize: 12,
    lineHeight: 18,
  },
  infoBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(234,226,204,0.9)',
  },
  infoBannerText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '700',
  },
  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    backgroundColor: 'rgba(18,4,8,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerOuterActive: {
    transform: [{ scale: 1.15 }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(234,226,204,0.95)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  zoomButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: 'rgba(44,36,24,0.12)',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: 12,
  },
  stateCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: 'rgba(234,226,204,0.96)',
  },
  stateTitle: {
    color: '#2C2418',
    fontSize: 18,
    fontWeight: '800',
  },
  stateText: {
    color: '#6B5D4E',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  trailStrip: {
    paddingRight: 16,
    gap: 10,
  },
  trailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(18,4,8,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trailChipActive: {
    backgroundColor: '#EAE2CC',
  },
  trailChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trailChipName: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: 140,
  },
  trailChipNameActive: {
    color: '#2C2418',
  },
  trailChipMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  trailChipMetaActive: {
    color: '#6B5D4E',
  },
  trailCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(234,226,204,0.97)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 8,
  },
  trailCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  trailName: {
    color: '#2C2418',
    fontSize: 20,
    fontWeight: '800',
    maxWidth: width - 150,
  },
  trailRegion: {
    color: '#6B5D4E',
    fontSize: 13,
    marginTop: 4,
  },
  difficultyPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  difficultyPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  statPillText: {
    color: '#2C2418',
    fontSize: 12,
    fontWeight: '700',
  },
  trailDescription: {
    marginTop: 12,
    color: '#4A4131',
    fontSize: 13,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(44,36,24,0.08)',
  },
  secondaryButtonText: {
    color: '#2C2418',
    fontWeight: '700',
  },
  detailButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: '#630E13',
  },
  detailButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
