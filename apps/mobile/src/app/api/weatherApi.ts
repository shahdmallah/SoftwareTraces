import { apiRequest } from './client';

type Envelope<T> = {
  data: T;
};

export type WeatherForecast = {
  date: string;
  condition: string;
  high_c: number;
  low_c: number;
  precipitation_probability: number;
  wind_kph: number;
  is_daytime: boolean;
};

export async function getWeatherForecast(params: { lat: number; lng: number; date: string }) {
  const response = await apiRequest<Envelope<WeatherForecast>>('/api/weather/forecast', {}, params);
  return response.data;
}
