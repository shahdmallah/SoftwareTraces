import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";

async function bootstrap(): Promise<void> {
  await pool.query("SELECT 1");
  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Traces API running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
