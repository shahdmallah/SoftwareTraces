import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useActivityStore } from "../store/activityStore";

export default function HistoryScreen(): JSX.Element {
  const navigation = useNavigation();
  const activities = useActivityStore((state) => state.activities);

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ListEmptyComponent={<Text>No hikes recorded yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => navigation.navigate("ActivityDetail" as never, { activityId: item.id } as never)}>
          <Text style={styles.title}>{item.title}</Text>
          <Text>{item.distanceKm.toFixed(2)} km</Text>
          <Text>{item.status}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: "white", padding: 16, borderRadius: 16 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 }
});
