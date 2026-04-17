import cors from "cors";
import express from "express";
import helmet from "helmet";
import cron from "node-cron";
import achievementsRoutes from "./features/achievements/achievements.routes";
import activitiesRoutes from "./features/activities/activities.routes";
import authRoutes from "./features/auth/auth.routes";
import healthRoutes from "./features/health/health.routes";
import offlineRoutes from "./features/offline/offline.routes";
import socialRoutes from "./features/social/social.routes";
import trailsRoutes from "./features/trails/trails.routes";
import { errorHandler } from "./middleware/errorHandler";
import { apiRateLimit } from "./middleware/rateLimit";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use(apiRateLimit);

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/trails", trailsRoutes);
  app.use("/api/activities", activitiesRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api", socialRoutes);
  app.use("/api/offline", offlineRoutes);
  app.use("/api/achievements", achievementsRoutes);

  if (process.env.NODE_ENV !== "test") {
    cron.schedule("0 * * * *", () => {
      // Placeholder hourly maintenance task.
    });
  }

  app.use(errorHandler);

  return app;
}
