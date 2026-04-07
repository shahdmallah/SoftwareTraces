import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { useNavigation } from "@react-navigation/native";
import { useLocation } from "../../shared/hooks/useLocation";
import { useTrailStore } from "../store/trailStore";
import { getNearbyTrails } from "../../shared/services/api/client";
import { cacheTrails } from "../../shared/services/offline/storage";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

export default function MapScreen(): JSX.Element {
  const navigation = useNavigation();
  const { currentLocation } = useLocation();
  const trails = useTrailStore((state) => state.trails);
  const setTrails = useTrailStore((state) => state.setTrails);

  useEffect(() => {
    async function bootstrapTrails(): Promise<void> {
      if (!currentLocation) {
        return;
      }

      try {
        const nextTrails = await getNearbyTrails(currentLocation.coords.latitude, currentLocation.coords.longitude);
        setTrails(nextTrails);
        await cacheTrails(nextTrails);
      } catch (error) {
        console.warn("Failed to load nearby trails", error);
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
        {trails.map((trail) => (
          <Mapbox.PointAnnotation
            key={trail.id}
            id={trail.id}
            coordinate={[trail.startPoint.lng, trail.startPoint.lat]}
            onSelected={() => navigation.navigate("TrailDetail" as never, { trailId: trail.id } as never)}
          >
            <View style={styles.marker} />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Trails of Palestine</Text>
        <Text style={styles.bannerBody}>Offline-ready routes, Arabic-friendly labels, and live hike recording.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  marker: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1E5D44", borderWidth: 2, borderColor: "#D4A63C" },
  banner: { position: "absolute", top: 16, left: 16, right: 16, backgroundColor: "rgba(243,231,201,0.92)", borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 20, fontWeight: "700" },
  bannerBody: { marginTop: 4 }
});
