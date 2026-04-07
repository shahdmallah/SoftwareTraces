import { useEffect, useState } from "react";
import * as Location from "expo-location";

export function useLocation() {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      const permission = await Location.requestForegroundPermissionsAsync();
      setHasPermission(permission.granted);

      if (permission.granted) {
        const initial = await Location.getCurrentPositionAsync({});
        setCurrentLocation(initial);
      }
    }

    void bootstrap();
  }, []);

  return { currentLocation, hasPermission };
}
