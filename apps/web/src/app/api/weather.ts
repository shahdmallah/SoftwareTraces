import { apiRequest } from './client';

type Envelope<T> = { data: T };

export type WeatherForecast = {
  date: string;
  temperature_c: number;
  condition: string;
  precipitation_probability?: number;
  wind_speed_kph?: number;
};

export async function getWeatherForecast(params: { lat: number; lng: number; date: string }) {
  const response = await apiRequest<Envelope<WeatherForecast>>('/api/weather/forecast', {}, params);
  return response.data;
}
