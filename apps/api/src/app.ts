import cors from "cors";
import express from "express";
import helmet from "helmet";
import cron from "node-cron";
import achievementsRoutes from "./features/achievements/achievements.routes";
import activitiesRoutes from "./features/activities/activities.routes";
import { sosAlert } from "./features/activities/activities.controller";
import authRoutes from "./features/auth/auth.routes";
import debugRoutes from "./features/debug/debug.routes";
import healthRoutes from "./features/health/health.routes";
import mediaRoutes from "./features/media/media.routes";
import navigationRoutes from "./features/navigation/navigation.routes";
import offlineRoutes from "./features/offline/offline.routes";
import profilesRoutes from "./features/profiles/profiles.routes";
import socialRoutes from "./features/social/social.routes";
import trailsRoutes from "./features/trails/trails.routes";
import { errorHandler } from "./middleware/errorHandler";
import { asyncHandler } from "./lib/asyncHandler";
import { authenticate } from "./middleware/auth";
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
  app.use("/api/debug", debugRoutes);
  app.use("/api/trails", trailsRoutes);
  app.use("/api/activities", activitiesRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/navigation", navigationRoutes);
  app.post("/api/sos", authenticate, asyncHandler(sosAlert));
  app.use("/api/health", healthRoutes);
  app.use("/api/social", socialRoutes);
  app.use("/api/profiles", profilesRoutes);
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
