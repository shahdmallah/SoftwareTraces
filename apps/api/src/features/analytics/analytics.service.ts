import { pool } from "../../db/pool";

export type AnalyticsEventType =
  | "login"
  | "app_open"
  | "trail_view"
  | "activity_created"
  | "challenge_joined"
  | "sos_triggered"
  | "incident_reported";

type TrackActivityInput = {
  userId?: string | null;
  eventType: AnalyticsEventType;
  metadata?: Record<string, unknown>;
};

function metadataJson(metadata: Record<string, unknown> | undefined): string {
  return JSON.stringify(metadata ?? {});
}

export async function trackUserActivity(input: TrackActivityInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO user_activity_events (user_id, event_type, metadata)
       VALUES ($1::uuid, $2, $3::jsonb)`,
      [input.userId ?? null, input.eventType, metadataJson(input.metadata)]
    );
  } catch (error) {
    console.warn("[analytics.trackUserActivity] failed:", {
      eventType: input.eventType,
      userId: input.userId ?? null,
      error,
    });
  }
}

export async function trackTrailView(trailId: string, userId?: string | null): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO trail_view_events (trail_id, user_id)
       VALUES ($1::uuid, $2::uuid)`,
      [trailId, userId ?? null]
    );
  } catch (error) {
    console.warn("[analytics.trackTrailView] failed:", { trailId, userId: userId ?? null, error });
  }

  await trackUserActivity({
    userId: userId ?? null,
    eventType: "trail_view",
    metadata: { trail_id: trailId },
  });
}
