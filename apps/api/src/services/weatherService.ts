interface WeatherSnapshot {
  temperatureC: number;
  condition: string;
  windKph: number;
}

/**
 * Returns a stubbed weather snapshot for a trail area.
 */
export async function getTrailWeather(_lat: number, _lng: number): Promise<WeatherSnapshot> {
  return {
    temperatureC: 23,
    condition: "Sunny",
    windKph: 14
  };
}
