import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional()
});

export const env = envSchema.parse(process.env);
