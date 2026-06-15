import { HourlyWeatherHour, ForecastDay } from '../api/trailsApi';

export function getWeatherVisual(summary: string, isDaytime = true) {
  if (/rain|shower|storm|drizzle/i.test(summary)) {
    return { emoji: '🌧️', accent: '#8C5A2B', tint: 'rgba(140,90,43,0.14)' };
  }
  if (/cloud|overcast|fog|mist|haze/i.test(summary)) {
    return { emoji: isDaytime ? '⛅' : '☁️', accent: '#7B6A58', tint: 'rgba(123,106,88,0.14)' };
  }
  if (/snow|sleet|hail/i.test(summary)) {
    return { emoji: '❄️', accent: '#A67C52', tint: 'rgba(166,124,82,0.14)' };
  }
  if (/clear|sun|fair|hot/i.test(summary)) {
    return isDaytime
      ? { emoji: '☀️', accent: '#D9892B', tint: 'rgba(217,137,43,0.14)' }
      : { emoji: '☀️', accent: '#A66C2D', tint: 'rgba(166,108,45,0.14)' };
  }
  return isDaytime
    ? { emoji: '🌤️', accent: '#D4A843', tint: 'rgba(212,168,67,0.14)' }
    : { emoji: '🌌', accent: '#8C6A3B', tint: 'rgba(140,106,59,0.14)' };
}

export function formatDayLabel(date: string, language: 'ar' | 'en') {
  const dayDate = new Date(`${date}T12:00:00`);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    weekday: 'long',
  }).format(dayDate);
}

export function formatTemperature(value: number | null) {
  return value == null ? '--' : `${Math.round(value)}°`;
}

export function formatPercent(value: number | null) {
  return value == null ? '--' : `${Math.round(value)}%`;
}

export function formatWind(value: number | null) {
  return value == null ? '--' : `${Math.round(value)} km/h`;
}

export function formatDisplayTime(timestamp: string, language: 'ar' | 'en') {
  const date = new Date(timestamp);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDayDate(dateValue: string, language: 'ar' | 'en') {
  const date = new Date(`${dateValue}T12:00:00`);

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-PS' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
  }).format(date);
}

export function getDayTemperatureRange(hours: HourlyWeatherHour[]) {
  const temperatures = hours
    .map((hour) => hour.temperatureC)
    .filter((value): value is number => value != null);

  if (!temperatures.length) {
    return { high: null, low: null };
  }

  return {
    high: Math.max(...temperatures),
    low: Math.min(...temperatures),
  };
}

export function buildForecast(trail: any, language: 'ar' | 'en'): ForecastDay[] {
  if (!trail) {
    return [];
  }

  const [lat, lng] = trail.coordinates;
  const start = new Date();
  start.setMinutes(0, 0, 0);

  const hourly = Array.from({ length: 5 * 8 }, (_, index): HourlyWeatherHour => {
    const date = new Date(start.getTime() + index * 3 * 60 * 60 * 1000);
    const hour = date.getHours();
    const isDaytime = hour >= 6 && hour < 18;
    const baseTemp = 18 + Math.sin((lat / 90) * Math.PI) * 5 + Math.cos((lng / 180) * Math.PI) * 2;
    const temperatureC = Number((baseTemp + (isDaytime ? 5 : -1) + Math.sin(index * 0.6) * 2).toFixed(1));
    const precipitationProbability = Math.max(0, Math.min(75, Math.round((Math.cos(index * 0.7) + 1) * 22)));
    const windSpeedKph = Number((8 + Math.abs(Math.sin(index * 0.5)) * 10).toFixed(1));
    let condition = 'Partly cloudy';

    if (precipitationProbability >= 55) {
      condition = 'Light rain';
    } else if (isDaytime && temperatureC >= 28) {
      condition = 'Sunny';
    } else if (!isDaytime) {
      condition = 'Clear';
    }

    return {
      timestamp: date.toISOString(),
      localDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      localTime: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      temperatureC,
      feelsLikeC: Number((temperatureC + (windSpeedKph > 14 ? -1 : 1)).toFixed(1)),
      precipitationProbability,
      windSpeedKph,
      condition,
      isDaytime,
    };
  });

  const grouped = new Map<string, HourlyWeatherHour[]>();

  hourly.forEach((hour) => {
    const dayHours = grouped.get(hour.localDate) ?? [];
    dayHours.push(hour);
    grouped.set(hour.localDate, dayHours);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayHours]) => {
      const sortedHours = [...dayHours].sort((left, right) => left.localTime.localeCompare(right.localTime));
      return {
        date,
        dayLabel: formatDayLabel(date, language),
        summary: sortedHours[0]?.condition ?? 'Unknown',
        hours: sortedHours,
      };
    });
}