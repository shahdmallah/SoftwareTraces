import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTrailStore } from "../store/trailStore";

export default function ExploreScreen(): JSX.Element {
  const navigation = useNavigation();
  const trails = useTrailStore((state) => state.trails);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={trails}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text>No trails cached yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => navigation.navigate("TrailDetail" as never, { trailId: item.id } as never)}>
          <Text style={styles.title}>{item.name}</Text>
          <Text>{item.region}</Text>
          <Text>{item.lengthKm.toFixed(1)} km</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: "white", padding: 16, borderRadius: 16 },
  title: { fontWeight: "700", fontSize: 18, marginBottom: 4 }
});
