import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useActivityStore } from "../store/activityStore";

type ActivityDetailRoute = RouteProp<{ ActivityDetail: { activityId: string } }, "ActivityDetail">;

export default function ActivityDetailScreen(): JSX.Element {
  const route = useRoute<ActivityDetailRoute>();
  const activity = useActivityStore((state) => state.activities.find((item) => item.id === route.params.activityId));

  if (!activity) {
    return <View style={styles.center}><Text>Activity not found.</Text></View>;
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>{activity.title}</Text>
      <Text>{activity.distanceKm.toFixed(2)} km</Text>
      <Text>{activity.elevationGainM.toFixed(0)} m gain</Text>
      <Text>{activity.status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, padding: 20, gap: 12 },
  title: { fontSize: 28, fontWeight: "800" }
});
