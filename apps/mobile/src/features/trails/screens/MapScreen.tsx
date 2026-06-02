import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { useNavigation } from "@react-navigation/native";
import { useLocation } from "../../../shared/hooks/useLocation";
import { useTrailStore } from "../store/trailStore";
import { getNearbyTrails } from "../../../shared/services/api/client";
import { cacheTrails, getCachedTrails, getOfflineMaps, type OfflineMapRecord, type OfflineSafetyMarker } from "../../../shared/services/offline/storage";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

type TrailLike = Record<string, any>;

function getTrailStart(trail: TrailLike): [number, number] {
  const startPoint = trail.startPoint ?? {};
  const coordinates = trail.coordinates ?? {};
  const lng = Number(startPoint.lng ?? coordinates.lng ?? coordinates[1] ?? trail.startLng ?? 35.2137);
  const lat = Number(startPoint.lat ?? coordinates.lat ?? coordinates[0] ?? trail.startLat ?? 31.7683);
  return [lng, lat];
}

function getTrailLine(trail: TrailLike): [number, number][] {
  const points = Array.isArray(trail.geometry) && trail.geometry.length > 0 ? trail.geometry : trail.routeCoordinates;
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point: any) => {
      if (Array.isArray(point)) {
        return [Number(point[1]), Number(point[0])] as [number, number];
      }
      return [Number(point.lng), Number(point.lat)] as [number, number];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
}

export default function MapScreen(): JSX.Element {
  const navigation = useNavigation();
  const { currentLocation } = useLocation();
  const trails = useTrailStore((state) => state.trails);
  const setTrails = useTrailStore((state) => state.setTrails);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [safetyMarkers, setSafetyMarkers] = useState<OfflineSafetyMarker[]>([]);

  const trailLineFeatures = useMemo(
    () => trails
      .map((trail) => ({ trail, coordinates: getTrailLine(trail as TrailLike) }))
      .filter((item) => item.coordinates.length >= 2)
      .map((item) => ({
        type: "Feature" as const,
        properties: { id: item.trail.id },
        geometry: { type: "LineString" as const, coordinates: item.coordinates },
      })),
    [trails]
  );

  useEffect(() => {
    async function bootstrapTrails(): Promise<void> {
      if (!currentLocation) {
        const offlineMaps = await getOfflineMaps();
        if (offlineMaps.length > 0) {
          setTrails(offlineMaps.map((map: OfflineMapRecord) => map.payload.trail));
          setSafetyMarkers(offlineMaps.flatMap((map: OfflineMapRecord) => map.payload.safety_markers));
          setIsOfflineMode(true);
        }
        return;
      }

      try {
        const nextTrails = await getNearbyTrails(currentLocation.coords.latitude, currentLocation.coords.longitude);
        setTrails(nextTrails);
        await cacheTrails(nextTrails);
        setIsOfflineMode(false);
      } catch (error) {
        console.warn("Failed to load nearby trails", error);
        const cachedTrails = await getCachedTrails();
        const offlineMaps = await getOfflineMaps();
        if (cachedTrails.length > 0) {
          setTrails(cachedTrails);
        } else if (offlineMaps.length > 0) {
          setTrails(offlineMaps.map((map: OfflineMapRecord) => map.payload.trail));
        }
        setSafetyMarkers(offlineMaps.flatMap((map: OfflineMapRecord) => map.payload.safety_markers));
        setIsOfflineMode(true);
      }
    }

    void bootstrapTrails();
  }, [currentLocation, setTrails]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={StyleSheet.absoluteFillObject} styleURL={Mapbox.StyleURL.Outdoors}>
        <Mapbox.Camera
          zoomLevel={10}
          centerCoordinate={currentLocation ? [currentLocation.coords.longitude, currentLocation.coords.latitude] : [35.2137, 31.7683]}
        />
        {currentLocation ? <Mapbox.UserLocation visible /> : null}
        {trailLineFeatures.length > 0 ? (
          <Mapbox.ShapeSource id="offline-trail-lines" shape={{ type: "FeatureCollection", features: trailLineFeatures }}>
            <Mapbox.LineLayer id="offline-trail-line-layer" style={{ lineColor: "#1E5D44", lineWidth: 4, lineOpacity: 0.85 }} />
          </Mapbox.ShapeSource>
        ) : null}
        {trails.map((trail) => (
          <Mapbox.PointAnnotation
            key={trail.id}
            id={trail.id}
            coordinate={getTrailStart(trail as TrailLike)}
            onSelected={() => (navigation as any).navigate("TrailDetail", { trailId: trail.id })}
          >
            <View style={styles.marker} />
          </Mapbox.PointAnnotation>
        ))}
        {safetyMarkers.map((marker) => (
          <Mapbox.PointAnnotation
            key={`safety-${marker.id}`}
            id={`safety-${marker.id}`}
            coordinate={[marker.longitude, marker.latitude]}
          >
            <View style={[styles.safetyMarker, marker.risk_level === "high" || marker.risk_level === "critical" ? styles.highRiskMarker : null]} />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
      {isOfflineMode ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>Offline Mode Active</Text>
          <Text style={styles.offlineBody}>Showing last saved trail and safety data.</Text>
        </View>
      ) : null}
      <View style={[styles.banner, isOfflineMode ? styles.bannerWithOffline : null]}>
        <Text style={styles.bannerTitle}>Trails of Palestine</Text>
        <Text style={styles.bannerBody}>Offline-ready routes, Arabic-friendly labels, and live hike recording.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  marker: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1E5D44", borderWidth: 2, borderColor: "#D4A63C" },
  safetyMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#D4A63C", borderWidth: 2, borderColor: "white" },
  highRiskMarker: { backgroundColor: "#9C2F2F" },
  offlineBanner: { position: "absolute", top: 16, left: 16, right: 16, backgroundColor: "rgba(221,235,221,0.96)", borderRadius: 12, padding: 12 },
  offlineTitle: { fontWeight: "800", color: "#1E5D44" },
  offlineBody: { color: "#4D5F52", marginTop: 2 },
  banner: { position: "absolute", top: 16, left: 16, right: 16, backgroundColor: "rgba(243,231,201,0.92)", borderRadius: 16, padding: 16 },
  bannerWithOffline: { top: 96 },
  bannerTitle: { fontSize: 20, fontWeight: "700" },
  bannerBody: { marginTop: 4 }
});
