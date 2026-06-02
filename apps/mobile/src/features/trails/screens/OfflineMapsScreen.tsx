import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useOfflineMaps } from "../../../shared/hooks/useOfflineMaps";
import type { OfflineMapRecord } from "../../../shared/services/offline/storage";

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

function getCheckpointCount(record: OfflineMapRecord): number {
  return record.payload.safety_markers.filter((marker) =>
    marker.location_type === "military_checkpoint" || marker.location_type === "flying_checkpoint"
  ).length;
}

function getConfidenceLabel(record: OfflineMapRecord): string {
  const snapshot = record.payload.safety_snapshot;
  if (!snapshot) {
    return "Low confidence - no recent safety snapshot";
  }

  const label = `${snapshot.confidence.charAt(0).toUpperCase()}${snapshot.confidence.slice(1)} confidence`;
  return `${label} - ${snapshot.report_count} recent reports`;
}

export default function OfflineMapsScreen(): JSX.Element {
  const navigation = useNavigation();
  const { maps, isLoading, refresh, remove } = useOfflineMaps();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  if (isLoading && maps.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#1E5D44" />
        <Text style={styles.muted}>Loading offline maps...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Offline Maps</Text>
        <Text style={styles.subtitle}>Saved trail lines, trailheads, and safety snapshots for low-signal hiking.</Text>
      </View>
      {maps.length === 0 ? <Text style={styles.empty}>No offline maps yet. Open a trail and tap Download Offline Map.</Text> : null}
      {maps.map((item) => (
        <Pressable
          key={item.trail_id}
          style={styles.card}
          onPress={() => (navigation as any).navigate("TrailDetail", { trailId: item.trail_id, offline: true })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={[styles.badge, item.status === "downloaded" ? styles.downloaded : styles.pending]}>{item.status}</Text>
          </View>
          <Text style={styles.meta}>{item.payload.trail.region ?? "Unknown region"} - {item.payload.trail.difficulty ?? "trail"}</Text>
          <Text style={styles.meta}>Last updated {formatDate(item.updated_at)}</Text>
          <Text style={styles.meta}>{getCheckpointCount(item)} checkpoints - {item.payload.safety_markers.length} safety markers</Text>
          <Text style={[styles.confidence, item.payload.safety_snapshot?.confidence === "high" ? styles.highConfidence : item.payload.safety_snapshot?.confidence === "medium" ? styles.mediumConfidence : styles.lowConfidence]}>
            {getConfidenceLabel(item)}
          </Text>
          <Text style={styles.meta}>{item.payload.safety_snapshot?.summary ?? "No recent checkpoint reports in the last 24h"}</Text>
          {item.last_error ? <Text style={styles.error}>{item.last_error}</Text> : null}
          <Pressable style={styles.deleteButton} onPress={() => void remove(item.trail_id)}>
            <Text style={styles.deleteText}>Delete offline map</Text>
          </Pressable>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  list: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 16, gap: 12 },
  header: { marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", color: "#1E3328" },
  subtitle: { marginTop: 4, color: "#4D5F52", lineHeight: 20 },
  empty: { padding: 16, backgroundColor: "white", borderRadius: 12, color: "#4D5F52" },
  card: { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "center" },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: "#1E3328" },
  badge: { overflow: "hidden", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: "700" },
  downloaded: { backgroundColor: "#DDEBDD", color: "#1E5D44" },
  pending: { backgroundColor: "#F2E3C1", color: "#7A551B" },
  meta: { color: "#4D5F52" },
  confidence: { fontWeight: "800" },
  highConfidence: { color: "#1E5D44" },
  mediumConfidence: { color: "#7A551B" },
  lowConfidence: { color: "#9C2F2F" },
  muted: { color: "#4D5F52" },
  error: { color: "#9C2F2F" },
  deleteButton: { marginTop: 4, alignSelf: "flex-start" },
  deleteText: { color: "#9C2F2F", fontWeight: "700" },
});
