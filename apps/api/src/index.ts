import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initMessagesSocket } from "./features/messages/messages.socket";
import { startSafetyCron } from "./features/safety/safety.cron";
import { testDatabaseConnection } from "./lib/db";

async function bootstrap(): Promise<void> {
  const app = createApp();
  const server = createServer(app);
  initMessagesSocket(server);

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off("error", handleError);
      reject(error);
    };

    server.once("error", handleError);
    server.listen(env.PORT, () => {
      server.off("error", handleError);
      console.log(`Traces API running on port ${env.PORT}`);
      resolve();
    });
  });

  startSafetyCron();

  const dbStatus = await testDatabaseConnection();
  if (dbStatus.success) {
    console.log(`[database] ${dbStatus.message}`);
  } else {
    console.error(`[database] ${dbStatus.message}`);
    console.log("Starting server without database connection. Health check will return 503.");
  }
}

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
