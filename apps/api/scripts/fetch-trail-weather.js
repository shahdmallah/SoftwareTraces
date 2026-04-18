const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const GOOGLE_WEATHER_URL = "https://weather.googleapis.com/v1/forecast/hours:lookup";
const HOURS_TO_FETCH = 168;
const PAGE_SIZE = 24;

function parseCoordinate(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a valid number.`);
  }

  return parsed;
}

function getArgs() {
  const [, , latArg, lonArg] = process.argv;

  if (!latArg || !lonArg) {
    throw new Error("Usage: node scripts/fetch-trail-weather.js <latitude> <longitude>");
  }

  return {
    latitude: parseCoordinate(latArg, "Latitude"),
    longitude: parseCoordinate(lonArg, "Longitude"),
  };
}

function getApiKey() {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set.");
  }

  return apiKey;
}

function buildUrl({ apiKey, latitude, longitude, pageToken }) {
  const url = new URL(GOOGLE_WEATHER_URL);

  url.searchParams.set("key", apiKey);
  url.searchParams.set("location.latitude", String(latitude));
  url.searchParams.set("location.longitude", String(longitude));
  url.searchParams.set("hours", String(HOURS_TO_FETCH));
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("unitsSystem", "METRIC");
  url.searchParams.set("languageCode", "en");

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return url;
}

function formatTemperature(temperature) {
  if (typeof temperature?.degrees !== "number") {
    return "N/A";
  }

  return `${temperature.degrees.toFixed(1)}°`;
}

function formatPrecipitationProbability(precipitation) {
  const probability = precipitation?.probability?.percent;

  if (typeof probability !== "number") {
    return "N/A";
  }

  return `${probability}%`;
}

function formatWindSpeed(wind) {
  const speed = wind?.speed?.value;
  const unit = wind?.speed?.unit;

  if (typeof speed !== "number") {
    return "N/A";
  }

  const normalizedUnit = unit === "KILOMETERS_PER_HOUR" ? "km/h" : unit === "MILES_PER_HOUR" ? "mph" : unit ?? "";

  return `${speed.toFixed(1)} ${normalizedUnit}`.trim();
}

function getCondition(hour) {
  return hour.weatherCondition?.description?.text ?? hour.weatherCondition?.type ?? "Unknown";
}

function getDisplayKey(hour) {
  const parts = hour.displayDateTime;

  if (!parts) {
    return "Unknown date";
  }

  const year = String(parts.year ?? "0000");
  const month = String(parts.month ?? 1).padStart(2, "0");
  const day = String(parts.day ?? 1).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDisplayLabel(hour) {
  const parts = hour.displayDateTime;

  if (!parts) {
    return "Unknown";
  }

  const date = new Date(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hours ?? 0,
    parts.minutes ?? 0,
    parts.seconds ?? 0,
  );

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getHourLabel(hour) {
  const parts = hour.displayDateTime;

  if (!parts) {
    return "??:??";
  }

  const hours = String(parts.hours ?? 0).padStart(2, "0");
  const minutes = String(parts.minutes ?? 0).padStart(2, "0");

  return `${hours}:${minutes}`;
}

async function fetchAllForecastHours({ apiKey, latitude, longitude }) {
  const forecastHours = [];
  let pageToken;

  do {
    const response = await fetch(buildUrl({ apiKey, latitude, longitude, pageToken }));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Weather API request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    forecastHours.push(...(payload.forecastHours ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken && forecastHours.length < HOURS_TO_FETCH);

  return forecastHours.slice(0, HOURS_TO_FETCH);
}

function printForecast(latitude, longitude, forecastHours) {
  console.log(`7-day hourly forecast for trail at ${latitude}, ${longitude}`);
  console.log("");

  let currentDayKey = null;

  for (const hour of forecastHours) {
    const dayKey = getDisplayKey(hour);

    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      console.log(getDisplayLabel(hour));
      console.log("-".repeat(getDisplayLabel(hour).length));
    }

    console.log(
      [
        `${getHourLabel(hour)}`,
        `Temp ${formatTemperature(hour.temperature)}`,
        `Feels ${formatTemperature(hour.feelsLikeTemperature)}`,
        `Precip ${formatPrecipitationProbability(hour.precipitation)}`,
        `Wind ${formatWindSpeed(hour.wind)}`,
        `Condition ${getCondition(hour)}`,
      ].join(" | "),
    );
  }
}

async function main() {
  try {
    const apiKey = getApiKey();
    const { latitude, longitude } = getArgs();
    const forecastHours = await fetchAllForecastHours({ apiKey, latitude, longitude });

    if (forecastHours.length === 0) {
      console.log("No forecast data returned.");
      return;
    }

    printForecast(latitude, longitude, forecastHours);
  } catch (error) {
    console.error(`[trail-weather] ${error.message}`);
    process.exitCode = 1;
  }
}

main();
