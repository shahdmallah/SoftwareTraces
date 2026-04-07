import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useRecordingStore } from "../../../features/recording/store/recordingStore";

const TRACKING_TASK = "traces-background-tracking";

TaskManager.defineTask(TRACKING_TASK, ({ data, error }) => {
  if (error) {
    return;
  }

  const locations = data?.locations as Location.LocationObject[] | undefined;
  if (!locations) {
    return;
  }

  locations.forEach((location) => {
    useRecordingStore.getState().pushPoint({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      elevation: location.coords.altitude ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
      speedMps: location.coords.speed ?? undefined,
      recordedAt: new Date(location.timestamp).toISOString()
    });
  });
});

/**
 * Starts background GPS tracking for a hike.
 */
export async function startBackgroundTracking(): Promise<void> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();

  if (!foreground.granted || !background.granted) {
    throw new Error("Location permissions are required to record hikes.");
  }

  await Location.startLocationUpdatesAsync(TRACKING_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    timeInterval: 5000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Traces is recording your hike",
      notificationBody: "GPS tracking remains active while the app is in the background."
    }
  });
}

/**
 * Stops background GPS tracking.
 */
export async function stopBackgroundTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  }
}
