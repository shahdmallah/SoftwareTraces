import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

type SupabaseEnvValidation = {
  hasSupabaseUrl: boolean;
  hasSupabaseServiceRoleKey: boolean;
  hasSupabaseAnonKey: boolean;
  missing: string[];
};

export function validateSupabaseEnv(): SupabaseEnvValidation {
  const result: SupabaseEnvValidation = {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    missing: []
  };

  if (!result.hasSupabaseUrl) {
    result.missing.push("SUPABASE_URL");
  }

  if (!result.hasSupabaseServiceRoleKey) {
    result.missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!result.hasSupabaseAnonKey) {
    result.missing.push("SUPABASE_ANON_KEY");
  }

  console.log("[env] Supabase env validation:", {
    SUPABASE_URL: result.hasSupabaseUrl ? "present" : "missing",
    SUPABASE_SERVICE_ROLE_KEY: result.hasSupabaseServiceRoleKey ? "present" : "missing",
    SUPABASE_ANON_KEY: result.hasSupabaseAnonKey ? "present" : "missing"
  });

  if (result.missing.length > 0) {
    console.warn("[env] Missing Supabase environment variables:", result.missing.join(", "));
  }

  return result;
}

validateSupabaseEnv();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "postgresql:" || parsed.protocol === "postgres:";
      } catch {
        return false;
      }
    }, "DATABASE_URL must be a valid postgres connection string."),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  OCHA_FETCH_INTERVAL_HOURS: z.coerce.number().int().min(1).max(24).default(6),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_SMS_ENABLED: z
    .union([z.boolean(), z.string().transform((value) => ["true", "1", "yes", "on"].includes(value.trim().toLowerCase()))])
    .default(false),
});

function getDatabaseHostname(databaseUrl: string): string | null {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return null;
  }
}

function isDirectSupabaseHost(hostname: string): boolean {
  return hostname.startsWith("db.") && hostname.endsWith(".supabase.co");
}

function isPoolerHost(hostname: string): boolean {
  return hostname.endsWith(".pooler.supabase.com");
}

function hasPoolerProjectRef(username: string): boolean {
  return /^postgres\.[a-z0-9]+$/i.test(username);
}

const parsedEnv = envSchema.parse(process.env);
const parsedDatabaseUrl = new URL(parsedEnv.DATABASE_URL);
const databaseHostname = parsedDatabaseUrl.hostname;
const databaseUsername = decodeURIComponent(parsedDatabaseUrl.username);

if (databaseHostname && isDirectSupabaseHost(databaseHostname)) {
  console.warn(
    `[env] DATABASE_URL is using the Supabase direct host "${databaseHostname}". ` +
      "If you see ENOTFOUND or IPv6/DNS issues, switch to the Session Pooler host " +
      '(for example, "aws-0-eu-central-1.pooler.supabase.com:6543").'
  );
}

if (databaseHostname && isPoolerHost(databaseHostname) && !hasPoolerProjectRef(databaseUsername)) {
  console.warn(
    `[env] DATABASE_URL is using a Supabase pooler host "${databaseHostname}" but the username "${databaseUsername}" ` +
      'does not include the project ref. Use a username in the form "postgres.<project-ref>" when connecting through the pooler.'
  );
}

export const env = parsedEnv;