interface WeatherSnapshot {
  temperatureC: number;
  condition: string;
  windKph: number;
}

export interface WeatherForecast {
  date: string;
  condition: string;
  high_c: number;
  low_c: number;
  precipitation_probability: number;
  wind_kph: number;
  is_daytime: boolean;
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

export async function getWeatherForecast(lat: number, lng: number, date: string): Promise<WeatherForecast> {
  const selectedDate = new Date(`${date}T12:00:00.000Z`);

  if (Number.isNaN(selectedDate.getTime())) {
    throw new Error("Invalid forecast date");
  }

  const dayStart = new Date(selectedDate);
  dayStart.setUTCHours(6, 0, 0, 0);

  const hourly = Array.from({ length: 6 }, (_, index) => {
    const hourDate = new Date(dayStart.getTime() + index * 3 * 60 * 60 * 1000);
    const hour = hourDate.getUTCHours();
    const isDaytime = hour >= 6 && hour < 18;
    const baseTemp = 18 + Math.sin((lat / 90) * Math.PI) * 5 + Math.cos((lng / 180) * Math.PI) * 2;
    const dateOffset = selectedDate.getUTCDate() + index;
    const temperatureC = Number((baseTemp + (isDaytime ? 5 : -1) + Math.sin(dateOffset * 0.6) * 2).toFixed(1));
    const precipitationProbability = Math.max(0, Math.min(75, Math.round((Math.cos(dateOffset * 0.7) + 1) * 22)));
    const windKph = Number((8 + Math.abs(Math.sin(dateOffset * 0.5)) * 10).toFixed(1));
    let condition = "Partly cloudy";

    if (precipitationProbability >= 55) {
      condition = "Light rain";
    } else if (isDaytime && temperatureC >= 28) {
      condition = "Sunny";
    } else if (!isDaytime) {
      condition = "Clear";
    }

    return { temperatureC, precipitationProbability, windKph, condition, isDaytime };
  });

  const temperatures = hourly.map((hour) => hour.temperatureC);
  const peakHour = hourly.reduce((current, hour) => (
    hour.precipitationProbability > current.precipitationProbability ? hour : current
  ), hourly[0]);

  return {
    date,
    condition: peakHour.condition,
    high_c: Math.max(...temperatures),
    low_c: Math.min(...temperatures),
    precipitation_probability: Math.max(...hourly.map((hour) => hour.precipitationProbability)),
    wind_kph: Math.max(...hourly.map((hour) => hour.windKph)),
    is_daytime: peakHour.isDaytime
  };
}
