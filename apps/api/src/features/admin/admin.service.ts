import { pool } from "../../db/pool";
import { fetchOchaIncidents } from "../safety/ocha.fetcher";

type CountRow = { count: string | number };

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function count(query: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query<CountRow>(query, params);
  return toNumber(result.rows[0]?.count);
}

async function optionalCount(query: string, params: unknown[] = []): Promise<number | null> {
  try {
    return await count(query, params);
  } catch {
    return null;
  }
}

const tableColumnCache = new Map<string, Set<string>>();

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = tableColumnCache.get(tableName);
  if (cached) return cached;

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName]
  );
  const columns = new Set(result.rows.map((row) => row.column_name));
  tableColumnCache.set(tableName, columns);
  return columns;
}

function whereSql(parts: string[]): string {
  return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
}

async function monthlySeries(table: string, dateColumn = "created_at"): Promise<Array<{ month: string; count: number }>> {
  try {
    const result = await pool.query<{ month: string; count: string }>(
      `SELECT to_char(date_trunc('month', ${dateColumn}), 'YYYY-MM') AS month,
              COUNT(*)::text AS count
       FROM ${table}
       WHERE ${dateColumn} >= NOW() - INTERVAL '12 months'
       GROUP BY 1
       ORDER BY 1`
    );
    return result.rows.map((row) => ({ month: row.month, count: toNumber(row.count) }));
  } catch {
    return [];
  }
}

export async function getDashboardStats() {
  const [
    trailColumns,
    activityColumns,
    safetyIncidentColumns,
    sosEventColumns,
    dangerousLocationColumns,
    pushTokenColumns,
    challengeColumns,
    challengeParticipantColumns,
    achievementColumns,
  ] = await Promise.all([
    getTableColumns("trails"),
    getTableColumns("activities"),
    getTableColumns("safety_incidents"),
    getTableColumns("sos_events"),
    getTableColumns("dangerous_locations"),
    getTableColumns("push_tokens"),
    getTableColumns("challenges"),
    getTableColumns("challenge_participants"),
    getTableColumns("achievements"),
  ]);

  const trailWhere = whereSql(trailColumns.has("deleted_at") ? ["deleted_at IS NULL"] : []);
  const publishedTrailWhere = whereSql([
    ...(trailColumns.has("deleted_at") ? ["deleted_at IS NULL"] : []),
    "COALESCE(status, 'published') = 'published'",
  ]);
  const draftTrailWhere = whereSql([
    ...(trailColumns.has("deleted_at") ? ["deleted_at IS NULL"] : []),
    "COALESCE(status, '') = 'draft'",
  ]);
  const privateTrailWhere = whereSql([
    ...(trailColumns.has("deleted_at") ? ["deleted_at IS NULL"] : []),
    "COALESCE(visibility, '') = 'private'",
  ]);
  const newTrailWhere = whereSql([
    ...(trailColumns.has("deleted_at") ? ["deleted_at IS NULL"] : []),
    "created_at >= NOW() - INTERVAL '30 days'",
  ]);

  const pendingIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') = 'pending'"
    : null;
  const activeIncidentsQuery = safetyIncidentColumns.has("moderation_status") && safetyIncidentColumns.has("is_resolved")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') IN ('approved', 'active') AND COALESCE(is_resolved, false) = false"
    : safetyIncidentColumns.has("is_resolved")
      ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(is_resolved, false) = false"
      : null;
  const resolvedIncidentsQuery = safetyIncidentColumns.has("moderation_status") && safetyIncidentColumns.has("is_resolved")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(is_resolved, false) = true OR COALESCE(moderation_status, 'pending') IN ('rejected', 'hidden', 'resolved', 'expired')"
    : safetyIncidentColumns.has("is_resolved")
      ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(is_resolved, false) = true"
      : null;

  const recentSosQuery = sosEventColumns.has("status")
    ? "SELECT COUNT(*)::text AS count FROM sos_events WHERE status IN ('created', 'notifying', 'notified', 'acknowledged') AND created_at >= NOW() - INTERVAL '7 days'"
    : "SELECT COUNT(*)::text AS count FROM sos_events WHERE created_at >= NOW() - INTERVAL '7 days'";
  const dangerousLocationsQuery = dangerousLocationColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM dangerous_locations WHERE is_active = true"
    : "SELECT COUNT(*)::text AS count FROM dangerous_locations";
  const activeFcmTokensQuery = pushTokenColumns.has("provider") && pushTokenColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM push_tokens WHERE provider = 'fcm' AND is_active = true"
    : pushTokenColumns.has("provider")
      ? "SELECT COUNT(*)::text AS count FROM push_tokens WHERE provider = 'fcm'"
      : null;
  const activeChallengesQuery = challengeColumns.has("status") && challengeColumns.has("start_at") && challengeColumns.has("end_at")
    ? "SELECT COUNT(*)::text AS count FROM challenges WHERE status = 'published' AND start_at <= NOW() AND end_at >= NOW()"
    : null;
  const totalBadgesQuery = achievementColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM achievements WHERE is_active = true"
    : "SELECT COUNT(*)::text AS count FROM achievements";

  const [
    totalUsers,
    newUsersWeek,
    newUsersMonth,
    totalTrails,
    publishedTrails,
    draftTrails,
    privateTrails,
    newTrailsMonth,
    totalActivities,
    completedActivities,
    totalDistanceResult,
    activitiesWeek,
    activitiesMonth,
    safetyIncidentsTotal,
    pendingIncidents,
    activeIncidents,
    resolvedIncidents,
    sosTotal,
    recentSos,
    dangerousLocations,
    checkpointReports,
    notificationsTotal,
    notificationsWeek,
    pushTokens,
    activeFcmTokens,
    totalChallenges,
    activeChallenges,
    completedChallengeParticipations,
    totalBadges,
    mostEarnedBadgesResult,
    lastOchaImportResult,
  ] = await Promise.all([
    count("SELECT COUNT(*)::text AS count FROM profiles"),
    count("SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= date_trunc('week', NOW())"),
    count("SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= date_trunc('month', NOW())"),
    optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${trailWhere}`),
    trailColumns.has("status") ? optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${publishedTrailWhere}`) : optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${trailWhere}`),
    trailColumns.has("status") ? optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${draftTrailWhere}`) : Promise.resolve(null),
    trailColumns.has("visibility") ? optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${privateTrailWhere}`) : Promise.resolve(null),
    trailColumns.has("created_at") ? optionalCount(`SELECT COUNT(*)::text AS count FROM trails ${newTrailWhere}`) : Promise.resolve(null),
    count("SELECT COUNT(*)::text AS count FROM activities"),
    activityColumns.has("status") ? optionalCount("SELECT COUNT(*)::text AS count FROM activities WHERE status = 'completed'") : Promise.resolve(null),
    pool.query<{ total: string | number | null }>(
      "SELECT COALESCE(SUM(distance_km), 0) AS total FROM activities"
    ).catch(() => ({ rows: [{ total: null }] })),
    activityColumns.has("created_at") ? optionalCount("SELECT COUNT(*)::text AS count FROM activities WHERE created_at >= NOW() - INTERVAL '7 days'") : Promise.resolve(null),
    activityColumns.has("created_at") ? optionalCount("SELECT COUNT(*)::text AS count FROM activities WHERE created_at >= NOW() - INTERVAL '30 days'") : Promise.resolve(null),
    count("SELECT COUNT(*)::text AS count FROM safety_incidents"),
    pendingIncidentsQuery ? optionalCount(pendingIncidentsQuery) : Promise.resolve(null),
    activeIncidentsQuery ? optionalCount(activeIncidentsQuery) : Promise.resolve(null),
    resolvedIncidentsQuery ? optionalCount(resolvedIncidentsQuery) : Promise.resolve(null),
    count("SELECT COUNT(*)::text AS count FROM sos_events"),
    optionalCount(recentSosQuery),
    optionalCount(dangerousLocationsQuery),
    count("SELECT COUNT(*)::text AS count FROM checkpoint_reports"),
    count("SELECT COUNT(*)::text AS count FROM notifications"),
    count("SELECT COUNT(*)::text AS count FROM notifications WHERE created_at >= NOW() - INTERVAL '7 days'"),
    count("SELECT COUNT(*)::text AS count FROM push_tokens"),
    activeFcmTokensQuery ? optionalCount(activeFcmTokensQuery) : Promise.resolve(null),
    optionalCount("SELECT COUNT(*)::text AS count FROM challenges"),
    activeChallengesQuery ? optionalCount(activeChallengesQuery) : Promise.resolve(null),
    challengeParticipantColumns.has("status") ? optionalCount("SELECT COUNT(*)::text AS count FROM challenge_participants WHERE status = 'completed'") : Promise.resolve(null),
    optionalCount(totalBadgesQuery),
    pool.query(
      `SELECT a.id, a.name, COUNT(ua.user_id)::int AS earned_count
       FROM achievements a
       LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.earned_at IS NOT NULL
       GROUP BY a.id, a.name
       ORDER BY earned_count DESC, a.name ASC
       LIMIT 5`
    ).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT source, articles_processed, incidents_created, error, created_at
       FROM news_fetch_log
       WHERE source = 'ocha'
       ORDER BY created_at DESC
       LIMIT 1`
    ).catch(() => ({ rows: [] })),
  ]);

  const [usersByMonth, trailsByMonth, incidentsByMonth, activitiesByMonth, challengesByMonth] = await Promise.all([
    monthlySeries("profiles"),
    monthlySeries("trails"),
    monthlySeries("safety_incidents", "reported_at"),
    monthlySeries("activities"),
    monthlySeries("challenge_participants", "joined_at"),
  ]);

  return {
    users: {
      total: totalUsers,
      new_this_week: newUsersWeek,
      new_this_month: newUsersMonth,
      active_this_week: null,
      active_this_month: null,
      unavailable_metrics: ["active users require login/session tracking, which is not currently stored"],
    },
    trails: {
      total: totalTrails,
      published: publishedTrails,
      draft: draftTrails,
      private: privateTrails,
      new_this_month: newTrailsMonth,
      most_viewed: null,
      unavailable_metrics: ["trail views are not currently tracked"],
    },
    activities: {
      total: totalActivities,
      completed: completedActivities,
      total_distance_km: totalDistanceResult.rows[0]?.total === null ? null : Number(Number(totalDistanceResult.rows[0]?.total).toFixed(2)),
      this_week: activitiesWeek,
      this_month: activitiesMonth,
    },
    safety: {
      incidents_total: safetyIncidentsTotal,
      pending_incidents: pendingIncidents,
      active_incidents: activeIncidents,
      resolved_incidents: resolvedIncidents,
      sos_events_total: sosTotal,
      recent_open_sos_events: recentSos,
      dangerous_locations: dangerousLocations,
      checkpoint_reports: checkpointReports,
      last_ocha_import: lastOchaImportResult.rows[0] ?? null,
    },
    notifications: {
      total: notificationsTotal,
      push_tokens: pushTokens,
      active_fcm_tokens: activeFcmTokens,
      sent_this_week: notificationsWeek,
    },
    challenges: {
      total: totalChallenges,
      active: activeChallenges,
      completed_participations: completedChallengeParticipations,
    },
    badges: {
      total: totalBadges,
      most_earned: mostEarnedBadgesResult.rows,
    },
    time_series: {
      users_by_month: usersByMonth,
      trails_by_month: trailsByMonth,
      incidents_by_month: incidentsByMonth,
      activities_by_month: activitiesByMonth,
      challenges_joined_by_month: challengesByMonth,
    },
  };
}

export async function listAdminBadges() {
  const result = await pool.query(
    `SELECT id, code, name, name_ar, description, description_ar, category,
            badge_icon_url, badge_icon_url AS icon, criteria_type, criteria_value, points, is_active, created_at
     FROM achievements
     ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getAdminBadge(id: string) {
  const result = await pool.query(
    `SELECT id, code, name, name_ar, description, description_ar, category,
            badge_icon_url, badge_icon_url AS icon, criteria_type, criteria_value, points, is_active, created_at
     FROM achievements
     WHERE id = $1::uuid
     LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createAdminBadge(input: Record<string, unknown>) {
  const result = await pool.query(
    `INSERT INTO achievements (
       code, name, name_ar, description, description_ar, category,
       badge_icon_url, criteria_type, criteria_value, points, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     RETURNING *,
               badge_icon_url AS icon`,
    [
      input.code,
      input.name,
      input.name_ar ?? null,
      input.description,
      input.description_ar ?? null,
      input.category ?? "general",
      input.badge_icon_url ?? input.icon ?? null,
      input.criteria_type ?? "manual",
      JSON.stringify(input.criteria ?? input.criteria_value ?? {}),
      input.points ?? 0,
      input.is_active ?? true,
    ]
  );
  return result.rows[0];
}

export async function updateAdminBadge(id: string, input: Record<string, unknown>) {
  const current = await getAdminBadge(id);
  if (!current) return null;

  const next = { ...current, ...input };
  const nextBadgeIconUrl = Object.prototype.hasOwnProperty.call(input, "badge_icon_url")
    ? input.badge_icon_url
    : Object.prototype.hasOwnProperty.call(input, "icon")
      ? input.icon
      : current.badge_icon_url;
  const result = await pool.query(
    `UPDATE achievements
     SET code = $2,
         name = $3,
         name_ar = $4,
         description = $5,
         description_ar = $6,
         category = $7,
         badge_icon_url = $8,
         criteria_type = $9,
         criteria_value = $10::jsonb,
         points = $11,
         is_active = $12
     WHERE id = $1::uuid
     RETURNING *,
               badge_icon_url AS icon`,
    [
      id,
      next.code,
      next.name,
      next.name_ar ?? null,
      next.description,
      next.description_ar ?? null,
      next.category ?? "general",
      nextBadgeIconUrl ?? null,
      next.criteria_type ?? "manual",
      JSON.stringify(next.criteria ?? next.criteria_value ?? {}),
      next.points ?? 0,
      next.is_active ?? true,
    ]
  );
  return result.rows[0] ?? null;
}

export async function disableAdminBadge(id: string) {
  const result = await pool.query(
    "UPDATE achievements SET is_active = false WHERE id = $1::uuid RETURNING *, badge_icon_url AS icon",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listIncidents(status?: string) {
  const values: unknown[] = [];
  const where = status ? "WHERE COALESCE(moderation_status, 'pending') = $1" : "";
  if (status) values.push(status);
  const result = await pool.query(
    `SELECT *,
            COALESCE(moderation_status, 'pending') AS moderation_status
     FROM safety_incidents
     ${where}
     ORDER BY reported_at DESC, created_at DESC
     LIMIT 200`,
    values
  );
  return result.rows;
}

export async function moderateIncident(id: string, status: string, note: string | null, adminUserId: string) {
  const result = await pool.query(
    `UPDATE safety_incidents
     SET moderation_status = $2,
         moderation_note = $3,
         moderated_by = $4::uuid,
         moderated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [id, status, note, adminUserId]
  );
  return result.rows[0] ?? null;
}

export async function listDangerousLocations() {
  const result = await pool.query("SELECT * FROM dangerous_locations ORDER BY is_active DESC, name ASC");
  return result.rows;
}

export async function createDangerousLocation(input: Record<string, unknown>) {
  const name = String(input.name);
  const description = typeof input.description === "string" ? input.description : null;
  const nameAr = typeof input.name_ar === "string" && input.name_ar.trim() ? input.name_ar : name;
  const descriptionAr = typeof input.description_ar === "string" && input.description_ar.trim()
    ? input.description_ar
    : description ?? "";

  try {
    const result = await pool.query(
      `INSERT INTO dangerous_locations (
         name, name_ar, location_type, latitude, longitude, danger_radius_meters,
         risk_level, operating_hours, description, description_ar, is_active, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        name,
        nameAr,
        input.location_type,
        input.latitude,
        input.longitude,
        input.danger_radius_meters ?? 300,
        input.risk_level ?? "medium",
        input.operating_hours ?? null,
        description,
        descriptionAr,
        input.is_active ?? true,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("[admin.service.createDangerousLocation]", { input, error });
    throw error;
  }
}

export async function updateDangerousLocation(id: string, input: Record<string, unknown>) {
  const currentResult = await pool.query("SELECT * FROM dangerous_locations WHERE id = $1::uuid LIMIT 1", [id]);
  const current = currentResult.rows[0];
  if (!current) return null;
  const next = { ...current, ...input };
  const result = await pool.query(
    `UPDATE dangerous_locations
     SET name = $2,
         name_ar = $3,
         location_type = $4,
         latitude = $5,
         longitude = $6,
         danger_radius_meters = $7,
         risk_level = $8,
         operating_hours = $9,
         description = $10,
         description_ar = $11,
         is_active = $12,
         updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING *`,
    [
      id,
      next.name,
      next.name_ar ?? null,
      next.location_type,
      next.latitude,
      next.longitude,
      next.danger_radius_meters,
      next.risk_level,
      next.operating_hours ?? null,
      next.description ?? null,
      next.description_ar ?? null,
      next.is_active,
    ]
  );
  return result.rows[0] ?? null;
}

export async function disableDangerousLocation(id: string) {
  const result = await pool.query(
    "UPDATE dangerous_locations SET is_active = false, updated_at = NOW() WHERE id = $1::uuid RETURNING *",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listCheckpointReports() {
  const result = await pool.query(
    `SELECT cr.*, dl.name AS checkpoint_name, dl.location_type
     FROM checkpoint_reports cr
     LEFT JOIN dangerous_locations dl ON dl.id = cr.checkpoint_id
     ORDER BY cr.created_at DESC
     LIMIT 200`
  );
  return result.rows;
}

export async function listSosEvents() {
  const result = await pool.query(
    `SELECT s.*, p.full_name, p.avatar_url, p.role
     FROM sos_events s
     LEFT JOIN profiles p ON p.user_id = s.user_id OR p.id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT 200`
  );
  return result.rows;
}

export async function listOchaLogs() {
  const result = await pool.query(
    "SELECT * FROM news_fetch_log WHERE source = 'ocha' ORDER BY created_at DESC LIMIT 100"
  );
  return result.rows;
}

export async function runOchaImport() {
  return fetchOchaIncidents();
}
