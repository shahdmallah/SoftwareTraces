import { env } from "../config/env";

const GOOGLE_WEATHER_URL = "https://weather.googleapis.com/v1/forecast/hours:lookup";
const HOURS_TO_FETCH = 168;
const PAGE_SIZE = 24;

type WeatherApiTemperature = {
  degrees?: number;
};

type WeatherApiPrecipitation = {
  probability?: {
    percent?: number;
  };
};

type WeatherApiWind = {
  speed?: {
    value?: number;
    unit?: string;
  };
};

type WeatherApiCondition = {
  type?: string;
  description?: {
    text?: string;
  };
};

type WeatherApiDisplayDateTime = {
  year?: number;
  month?: number;
  day?: number;
  hours?: number;
  minutes?: number;
};

type WeatherApiHour = {
  interval?: {
    startTime?: string;
  };
  displayDateTime?: WeatherApiDisplayDateTime;
  temperature?: WeatherApiTemperature;
  feelsLikeTemperature?: WeatherApiTemperature;
  precipitation?: WeatherApiPrecipitation;
  wind?: WeatherApiWind;
  weatherCondition?: WeatherApiCondition;
  isDaytime?: boolean;
};

type WeatherApiResponse = {
  forecastHours?: WeatherApiHour[];
  nextPageToken?: string;
};

export interface TrailWeatherHour {
  timestamp: string;
  localDate: string;
  localTime: string;
  temperatureC: number | null;
  feelsLikeC: number | null;
  precipitationProbability: number | null;
  windSpeedKph: number | null;
  condition: string;
  isDaytime: boolean;
}

export interface TrailWeatherForecast {
  source: "google-weather" | "fallback";
  fetchedAt: string;
  hourly: TrailWeatherHour[];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeKey(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createFallbackHour(date: Date, lat: number, lng: number): TrailWeatherHour {
  const hour = date.getHours();
  const dayIndex = Math.floor((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const isDaytime = hour >= 6 && hour < 18;
  const baseTemp = 18 + Math.sin((lat / 90) * Math.PI) * 5 + Math.cos((lng / 180) * Math.PI) * 2;
  const diurnalOffset = isDaytime ? 6 - Math.abs(hour - 13) * 0.45 : -2 - Math.abs(hour - 23) * 0.08;
  const temperatureC = Number((baseTemp + diurnalOffset - dayIndex * 0.15).toFixed(1));
  const windSpeedKph = Number((8 + Math.abs(Math.sin(hour / 2)) * 10 + (dayIndex % 3) * 1.5).toFixed(1));
  const precipitationProbability = Math.max(0, Math.min(75, Math.round(((hour + dayIndex * 3) % 10) * 6)));

  let condition = "Partly cloudy";
  if (precipitationProbability >= 55) {
    condition = "Light rain";
  } else if (!isDaytime) {
    condition = "Clear";
  } else if (hour >= 11 && hour <= 16) {
    condition = "Sunny";
  }

  return {
    timestamp: date.toISOString(),
    localDate: toDateKey(date),
    localTime: toTimeKey(date),
    temperatureC,
    feelsLikeC: Number((temperatureC + (windSpeedKph > 14 ? -1.2 : 0.8)).toFixed(1)),
    precipitationProbability,
    windSpeedKph,
    condition,
    isDaytime,
  };
}

function buildFallbackForecast(lat: number, lng: number): TrailWeatherForecast {
  const start = new Date();
  start.setMinutes(0, 0, 0);

  const hourly = Array.from({ length: HOURS_TO_FETCH }, (_, index) => {
    const hourDate = new Date(start.getTime() + index * 60 * 60 * 1000);
    return createFallbackHour(hourDate, lat, lng);
  });

  return {
    source: "fallback",
    fetchedAt: new Date().toISOString(),
    hourly,
  };
}

function buildUrl(lat: number, lng: number, pageToken?: string): URL {
  const url = new URL(GOOGLE_WEATHER_URL);

  url.searchParams.set("key", env.GOOGLE_API_KEY ?? "");
  url.searchParams.set("location.latitude", String(lat));
  url.searchParams.set("location.longitude", String(lng));
  url.searchParams.set("hours", String(HOURS_TO_FETCH));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("unitsSystem", "METRIC");
  url.searchParams.set("languageCode", "en");

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return url;
}

function formatDate(parts?: WeatherApiDisplayDateTime): string {
  const year = String(parts?.year ?? 0).padStart(4, "0");
  const month = String(parts?.month ?? 1).padStart(2, "0");
  const day = String(parts?.day ?? 1).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(parts?: WeatherApiDisplayDateTime): string {
  const hours = String(parts?.hours ?? 0).padStart(2, "0");
  const minutes = String(parts?.minutes ?? 0).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function normalizeWindSpeedKph(wind?: WeatherApiWind): number | null {
  const speed = wind?.speed?.value;
  const unit = wind?.speed?.unit;

  if (typeof speed !== "number" || Number.isNaN(speed)) {
    return null;
  }

  if (unit === "MILES_PER_HOUR") {
    return Number((speed * 1.60934).toFixed(1));
  }

  return Number(speed.toFixed(1));
}

function normalizeHour(hour: WeatherApiHour): TrailWeatherHour {
  return {
    timestamp: hour.interval?.startTime ?? "",
    localDate: formatDate(hour.displayDateTime),
    localTime: formatTime(hour.displayDateTime),
    temperatureC:
      typeof hour.temperature?.degrees === "number" ? Number(hour.temperature.degrees.toFixed(1)) : null,
    feelsLikeC:
      typeof hour.feelsLikeTemperature?.degrees === "number"
        ? Number(hour.feelsLikeTemperature.degrees.toFixed(1))
        : null,
    precipitationProbability:
      typeof hour.precipitation?.probability?.percent === "number" ? hour.precipitation.probability.percent : null,
    windSpeedKph: normalizeWindSpeedKph(hour.wind),
    condition: hour.weatherCondition?.description?.text ?? hour.weatherCondition?.type ?? "Unknown",
    isDaytime: Boolean(hour.isDaytime),
  };
}

async function fetchForecastPage(lat: number, lng: number, pageToken?: string): Promise<WeatherApiResponse> {
  const response = await fetch(buildUrl(lat, lng, pageToken));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Weather API request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as WeatherApiResponse;
}

export async function getTrailWeather(lat: number, lng: number): Promise<TrailWeatherForecast | null> {
  if (!env.GOOGLE_API_KEY) {
    return buildFallbackForecast(lat, lng);
  }

  try {
    const forecastHours: TrailWeatherHour[] = [];
    let pageToken: string | undefined;

    do {
      const payload = await fetchForecastPage(lat, lng, pageToken);
      const normalizedHours = (payload.forecastHours ?? []).map(normalizeHour);
      forecastHours.push(...normalizedHours);
      pageToken = payload.nextPageToken;
    } while (pageToken && forecastHours.length < HOURS_TO_FETCH);

    if (forecastHours.length === 0) {
      return buildFallbackForecast(lat, lng);
    }

    return {
      source: "google-weather",
      fetchedAt: new Date().toISOString(),
      hourly: forecastHours.slice(0, HOURS_TO_FETCH),
    };
  } catch {
    return buildFallbackForecast(lat, lng);
  }
}
