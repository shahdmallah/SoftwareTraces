import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useTrailStore } from "../store/trailStore";
import { useOfflineMaps } from "../../../shared/hooks/useOfflineMaps";
import type { OfflineMapBundle, OfflineMapRecord, OfflineSafetySnapshot } from "../../../shared/services/offline/storage";

type TrailDetailRoute = RouteProp<{ TrailDetail: { trailId: string; offline?: boolean } }, "TrailDetail">;

type TrailLike = Record<string, any>;

function getLengthKm(trail: TrailLike): number {
  return Number(trail.lengthKm ?? trail.distance ?? 0);
}

function getElevationGain(trail: TrailLike): number {
  return Number(trail.elevationGainM ?? trail.elevationGain ?? 0);
}

function getDuration(trail: TrailLike): string {
  const duration = trail.estimatedDurationMin ?? trail.duration;
  return typeof duration === "number" ? `${duration} min` : String(duration ?? "Unknown duration");
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "No recent reports";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown update time";
  }

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) {
    return `Updated ${minutes} minutes ago`;
  }

  const hours = Math.round(minutes / 60);
  return hours < 48 ? `Updated ${hours} hours ago` : `Updated ${Math.round(hours / 24)} days ago`;
}

function getConfidenceTitle(snapshot: OfflineSafetySnapshot | undefined): string {
  if (!snapshot) {
    return "Low Confidence";
  }

  return `${snapshot.confidence.charAt(0).toUpperCase()}${snapshot.confidence.slice(1)} Confidence`;
}

function getTrailhead(bundle: OfflineMapBundle | undefined): Record<string, any> | undefined {
  const accessRoute = bundle?.access_route;
  if (!accessRoute || typeof accessRoute !== "object") {
    return undefined;
  }

  const trailhead = (accessRoute as Record<string, any>).trailhead;
  return trailhead && typeof trailhead === "object" ? trailhead as Record<string, any> : undefined;
}

function getPackageSummary(bundle: OfflineMapBundle | undefined) {
  const safetyMarkers = bundle?.safety_markers ?? [];
  const checkpointCount = safetyMarkers.filter((marker) =>
    marker.location_type === "military_checkpoint" || marker.location_type === "flying_checkpoint"
  ).length;
  const dangerZoneCount = Math.max(0, safetyMarkers.length - checkpointCount);

  return [
    { label: "Trail geometry", included: Boolean(bundle?.trail) },
    { label: "Elevation profile", included: Boolean(bundle?.elevation_profile) },
    { label: `${checkpointCount} safety checkpoints`, included: checkpointCount > 0 },
    { label: `${dangerZoneCount} danger zones`, included: dangerZoneCount > 0 },
    { label: "Access route snapshot", included: Boolean(bundle?.access_route) },
    { label: "Offline safety snapshot", included: Boolean(bundle?.safety_snapshot) },
  ];
}

export default function TrailDetailScreen(): JSX.Element {
  const route = useRoute<TrailDetailRoute>();
  const liveTrail = useTrailStore((state) => state.trails.find((item) => item.id === route.params.trailId));
  const { download, getOne, remove } = useOfflineMaps();
  const [offlineRecord, setOfflineRecord] = useState<OfflineMapRecord | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const trail = useMemo<TrailLike | undefined>(
    () => (liveTrail as TrailLike | undefined) ?? offlineRecord?.payload.trail,
    [liveTrail, offlineRecord]
  );
  const safetyMarkers = offlineRecord?.payload.safety_markers ?? [];
  const safetySnapshot = offlineRecord?.payload.safety_snapshot;
  const trailhead = getTrailhead(offlineRecord?.payload);
  const lastCheckpoint = safetyMarkers.find((marker) => marker.latest_report);
  const packageSummary = getPackageSummary(offlineRecord?.payload);

  useEffect(() => {
    async function loadOfflineRecord(): Promise<void> {
      setOfflineRecord(await getOne(route.params.trailId));
    }

    void loadOfflineRecord();
  }, [getOne, route.params.trailId]);

  async function handleDownload(): Promise<void> {
    if (!trail) {
      return;
    }

    setIsBusy(true);
    try {
      const bundle = await download(route.params.trailId, String(trail.name ?? "Offline trail"));
      setOfflineRecord(await getOne(route.params.trailId));
      Alert.alert(
        "Saved Offline",
        `Trail and safety context are now available without internet. Package includes ${bundle.safety_markers.length} safety markers and ${bundle.safety_snapshot?.report_count ?? 0} recent reports.`
      );
    } catch (error) {
      Alert.alert("Download failed", error instanceof Error ? error.message : "Could not save this trail offline.");
      setOfflineRecord(await getOne(route.params.trailId));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    setIsBusy(true);
    try {
      await remove(route.params.trailId);
      setOfflineRecord(null);
    } finally {
      setIsBusy(false);
    }
  }

  if (!trail) {
    return (
      <View style={styles.center}>
        <Text>Trail not found.</Text>
        {route.params.offline ? <Text style={styles.muted}>No saved offline copy was found on this device.</Text> : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {route.params.offline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.bannerTitle}>Offline Mode Active</Text>
          <Text style={styles.bannerBody}>Showing last saved trail and safety data.</Text>
        </View>
      ) : null}
      <View style={styles.tileBanner}>
        <Text style={styles.bannerBody}>Base map may require internet. Trail and safety data are saved offline.</Text>
      </View>
      <Text style={styles.title}>{trail.name}</Text>
      {trail.nameAr ? <Text style={styles.subtitle}>{trail.nameAr}</Text> : null}
      <Text style={styles.body}>{trail.description}</Text>
      <View style={styles.stats}>
        <Text>{getLengthKm(trail).toFixed(1)} km</Text>
        <Text>{getElevationGain(trail)} m gain</Text>
        <Text>{getDuration(trail)}</Text>
      </View>
      <View style={styles.offlinePanel}>
        <View>
          <Text style={styles.section}>Offline Map</Text>
          <Text style={styles.muted}>
            {offlineRecord
              ? `Available offline - updated ${formatDate(offlineRecord.updated_at)}`
              : "Save this trail for low-signal hiking."}
          </Text>
          {offlineRecord?.payload.safety_snapshot_generated_at ? (
            <Text style={styles.muted}>Safety snapshot last updated {formatDate(offlineRecord.payload.safety_snapshot_generated_at)}</Text>
          ) : null}
        </View>
        <Pressable style={styles.primaryButton} disabled={isBusy} onPress={() => void handleDownload()}>
          {isBusy ? <ActivityIndicator color="white" /> : <Text style={styles.primaryButtonText}>{offlineRecord ? "Update Offline Map" : "Download Offline Map"}</Text>}
        </Pressable>
        {offlineRecord ? (
          <Pressable style={styles.secondaryButton} disabled={isBusy} onPress={() => void handleDelete()}>
            <Text style={styles.secondaryButtonText}>Delete Offline Map</Text>
          </Pressable>
        ) : null}
        {offlineRecord?.last_error ? <Text style={styles.error}>{offlineRecord.last_error}</Text> : null}
      </View>
      {offlineRecord ? (
        <View style={styles.summaryCard}>
          <Text style={styles.section}>Offline Package Includes</Text>
          {packageSummary.map((item) => (
            <Text key={item.label} style={item.included ? styles.summaryIncluded : styles.summaryMissing}>
              {item.included ? "Saved" : "Missing"} - {item.label}
            </Text>
          ))}
          <Text style={styles.successText}>Trail and safety context are available without internet.</Text>
        </View>
      ) : null}
      <View style={styles.confidenceCard}>
        <Text style={styles.section}>Safety Confidence</Text>
        <Text style={[styles.confidenceTitle, safetySnapshot?.confidence === "high" ? styles.highConfidence : safetySnapshot?.confidence === "medium" ? styles.mediumConfidence : styles.lowConfidence]}>
          {getConfidenceTitle(safetySnapshot)}
        </Text>
        <Text style={styles.muted}>{formatRelativeTime(safetySnapshot?.latest_report_at)}</Text>
        <Text style={styles.muted}>
          {safetySnapshot ? `Based on ${safetySnapshot.report_count} recent community reports` : "No recent reports in last 24h"}
        </Text>
        <Text style={styles.body}>{safetySnapshot?.summary ?? "No recent checkpoint reports in the last 24h"}</Text>
      </View>
      <View style={styles.emergencyCard}>
        <Text style={styles.section}>Emergency Information</Text>
        <Text style={styles.emergencyLabel}>Trailhead Coordinates</Text>
        <Text style={styles.muted}>
          {trailhead ? `${Number(trailhead.latitude).toFixed(5)}, ${Number(trailhead.longitude).toFixed(5)}` : "Not saved"}
        </Text>
        <Text style={styles.emergencyLabel}>Nearby Exit Point</Text>
        <Text style={styles.muted}>{trailhead?.name ?? "Use saved trailhead as the nearest known exit point."}</Text>
        <Text style={styles.emergencyLabel}>Last Known Checkpoint Status</Text>
        <Text style={styles.muted}>
          {lastCheckpoint?.latest_report ? `${lastCheckpoint.name}: ${lastCheckpoint.latest_report.status}, ${lastCheckpoint.latest_report.wait_minutes ?? 0} min wait` : "No checkpoint status saved"}
        </Text>
        <Text style={styles.emergencyLabel}>Offline Safety Data Saved</Text>
        <Text style={styles.muted}>Data saved locally. Verify conditions when a connection is available.</Text>
      </View>
      <View style={styles.chart}>
        <Text style={styles.chartLabel}>Elevation Profile</Text>
        <Text>{offlineRecord?.payload.elevation_profile ? "Elevation samples are saved offline." : "SVG elevation chart placeholder driven by trail geometry."}</Text>
      </View>
      <Text style={styles.section}>Offline Safety Snapshot</Text>
      {safetyMarkers.length > 0 ? (
        safetyMarkers.slice(0, 5).map((marker) => (
          <View key={marker.id} style={styles.safetyItem}>
            <Text style={styles.safetyTitle}>{marker.name}</Text>
            <Text style={styles.muted}>{marker.location_type} - {marker.risk_level ?? "risk unknown"}</Text>
            {marker.latest_report ? (
              <Text style={styles.muted}>Latest report: {marker.latest_report.status} - {marker.latest_report.wait_minutes ?? 0} min wait</Text>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No nearby safety markers were saved for this trail.</Text>
      )}
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
  offlineBanner: { backgroundColor: "#DDEBDD", borderRadius: 12, padding: 12 },
  tileBanner: { backgroundColor: "#F2E3C1", borderRadius: 12, padding: 12 },
  bannerTitle: { fontWeight: "800", color: "#1E5D44" },
  bannerBody: { color: "#4D5F52", lineHeight: 20 },
  offlinePanel: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 10 },
  summaryCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 8 },
  confidenceCard: { backgroundColor: "white", borderRadius: 16, padding: 16, gap: 6 },
  emergencyCard: { backgroundColor: "#FFF9EB", borderRadius: 16, padding: 16, gap: 6, borderWidth: 1, borderColor: "#E7D3A1" },
  primaryButton: { minHeight: 44, borderRadius: 10, backgroundColor: "#1E5D44", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryButtonText: { color: "white", fontWeight: "800" },
  secondaryButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: "#9C2F2F", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: "#9C2F2F", fontWeight: "800" },
  chart: { backgroundColor: "#F7F7F2", borderRadius: 16, padding: 16, minHeight: 160 },
  chartLabel: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  section: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  confidenceTitle: { fontSize: 18, fontWeight: "800" },
  highConfidence: { color: "#1E5D44" },
  mediumConfidence: { color: "#7A551B" },
  lowConfidence: { color: "#9C2F2F" },
  summaryIncluded: { color: "#1E5D44", fontWeight: "700" },
  summaryMissing: { color: "#7A551B" },
  successText: { color: "#1E5D44", marginTop: 4 },
  emergencyLabel: { fontWeight: "800", color: "#1E3328", marginTop: 4 },
  muted: { color: "#4D5F52" },
  error: { color: "#9C2F2F" },
  safetyItem: { backgroundColor: "white", borderRadius: 12, padding: 12, gap: 4 },
  safetyTitle: { fontWeight: "800", color: "#1E3328" },
});
