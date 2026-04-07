import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useTrailStore } from "../store/trailStore";

type TrailDetailRoute = RouteProp<{ TrailDetail: { trailId: string } }, "TrailDetail">;

export default function TrailDetailScreen(): JSX.Element {
  const route = useRoute<TrailDetailRoute>();
  const trail = useTrailStore((state) => state.trails.find((item) => item.id === route.params.trailId));

  if (!trail) {
    return <View style={styles.center}><Text>Trail not found.</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{trail.name}</Text>
      {trail.nameAr ? <Text style={styles.subtitle}>{trail.nameAr}</Text> : null}
      <Text style={styles.body}>{trail.description}</Text>
      <View style={styles.stats}>
        <Text>{trail.lengthKm.toFixed(1)} km</Text>
        <Text>{trail.elevationGainM} m gain</Text>
        <Text>{trail.estimatedDurationMin} min</Text>
      </View>
      <View style={styles.chart}>
        <Text style={styles.chartLabel}>Elevation Profile</Text>
        <Text>SVG elevation chart placeholder driven by trail geometry.</Text>
      </View>
      <Text style={styles.section}>Recent Reviews</Text>
      <Text>Community reviews and condition updates load from the trail endpoints.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 30, fontWeight: "800" },
  subtitle: { fontSize: 24, color: "#607744" },
  body: { fontSize: 16, lineHeight: 24 },
  stats: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 8 },
  chart: { backgroundColor: "#F7F7F2", borderRadius: 16, padding: 16, minHeight: 160 },
  chartLabel: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  section: { fontSize: 20, fontWeight: "700", marginTop: 8 }
});
