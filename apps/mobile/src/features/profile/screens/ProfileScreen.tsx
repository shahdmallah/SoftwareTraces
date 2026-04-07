import React from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatCard } from "@traces/ui";
import { useAuthStore } from "../../auth/store/authStore";

export default function ProfileScreen(): JSX.Element {
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{session?.profile.fullName ?? "Explorer"}</Text>
      <Text style={styles.subtitle}>Palestine hiking community profile</Text>
      <View style={styles.grid}>
        <StatCard label="Activities" value={String(session?.profile.totalActivities ?? 0)} />
        <StatCard label="Distance" value={`${session?.profile.totalDistanceKm ?? 0} km`} />
        <StatCard label="Elevation" value={`${session?.profile.totalElevationGainM ?? 0} m`} />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text>Badges unlock from completed hikes, elevation milestones, and exploration streaks.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <Text>Arabic support, offline maps, and sync preferences belong here.</Text>
      </View>
      <Button title="Log out" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  title: { fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#607744" },
  grid: { gap: 12 },
  section: { backgroundColor: "white", padding: 16, borderRadius: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 }
});
