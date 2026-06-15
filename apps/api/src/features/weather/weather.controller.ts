import type { Request, Response } from "express";
import { getWeatherForecast } from "../../services/weatherService";

export async function getForecast(req: Request, res: Response): Promise<void> {
  const { lat, lng, date } = req.query as { lat: string; lng: string; date: string };
  const forecast = await getWeatherForecast(Number(lat), Number(lng), date);

  res.json({ data: forecast });
}
