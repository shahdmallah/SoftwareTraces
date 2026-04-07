import React from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRecordingStore } from "../store/recordingStore";
import { startBackgroundTracking, stopBackgroundTracking } from "../../shared/services/gps/tracking";

export default function RecordingScreen(): JSX.Element {
  const isRecording = useRecordingStore((state) => state.isRecording);
  const points = useRecordingStore((state) => state.points);
  const stats = useRecordingStore((state) => state.stats);
  const start = useRecordingStore((state) => state.start);
  const stop = useRecordingStore((state) => state.stop);

  const handleStart = async () => {
    try {
      await startBackgroundTracking();
      start();
    } catch (error) {
      Alert.alert("Tracking error", error instanceof Error ? error.message : "Unable to start tracking.");
    }
  };

  const handleStop = async () => {
    await stopBackgroundTracking();
    stop();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live Recording</Text>
      <View style={styles.panel}>
        <Text style={styles.stat}>{stats.distanceKm.toFixed(2)} km</Text>
        <Text>Distance</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.stat}>{stats.elevationGainM.toFixed(0)} m</Text>
        <Text>Elevation Gain</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.stat}>{stats.durationSec}s</Text>
        <Text>Duration</Text>
      </View>
      <Button title={isRecording ? "Stop recording" : "Start recording"} onPress={isRecording ? () => void handleStop() : () => void handleStart()} />
      <Text style={styles.note}>{points.length} GPS points captured. The tracker keeps working in the background.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  title: { fontSize: 28, fontWeight: "800" },
  panel: { backgroundColor: "white", borderRadius: 18, padding: 20 },
  stat: { fontSize: 26, fontWeight: "700" },
  note: { color: "#607744" }
});
