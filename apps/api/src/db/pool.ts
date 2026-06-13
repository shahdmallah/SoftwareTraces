import { Pool, type PoolConfig } from "pg";
import { env } from "../config/env";

function buildPoolConfig(): PoolConfig {
  const databaseUrl = new URL(env.DATABASE_URL);
  const isSupabaseHost =
    databaseUrl.hostname.endsWith(".supabase.co") ||
    databaseUrl.hostname.endsWith(".supabase.com");
  const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase();
  const shouldUseSsl = isSupabaseHost && sslMode !== "disable";

  return {
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    max: 10,
    maxUses: 7_500,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  };
}

export const pool = new Pool(buildPoolConfig());

pool.on("error", (error) => {
  console.error("[database.pool] Unexpected idle client error", {
    message: error.message,
    code: "code" in error ? error.code : undefined,
    stack: error.stack,
  });
});
