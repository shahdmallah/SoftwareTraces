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

async function getFirstExistingColumn(tableName: string, candidates: string[]): Promise<string | null> {
  const columns = await getTableColumns(tableName);
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

async function getOchaLogOrderBySql(): Promise<string> {
  const timestampColumn = await getFirstExistingColumn("news_fetch_log", [
    "created_at",
    "started_at",
    "finished_at",
    "fetched_at",
    "imported_at",
    "updated_at",
  ]);

  if (timestampColumn) {
    return `${timestampColumn} DESC NULLS LAST`;
  }

  const idColumn = await getFirstExistingColumn("news_fetch_log", ["id"]);
  return idColumn ? "id DESC" : "";
}

async function getLastOchaImportQuery(): Promise<string> {
  const orderBySql = await getOchaLogOrderBySql();
  const orderClause = orderBySql ? ` ORDER BY ${orderBySql}` : "";
  return `SELECT *
          FROM news_fetch_log
          WHERE source = 'ocha'${orderClause}
          LIMIT 1`;
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

type AdminUserRow = {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  locale: string | null;
  email: string | null;
  username: string | null;
  created_at: string;
  updated_at: string;
};

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
    userActivityColumns,
    trailViewColumns,
    emergencyContactColumns,
    sosContactNotificationColumns,
    trailConditionColumns,
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
    getTableColumns("user_activity_events"),
    getTableColumns("trail_view_events"),
    getTableColumns("emergency_contacts"),
    getTableColumns("sos_contact_notifications"),
    getTableColumns("trail_conditions"),
  ]);

  const analyticsAvailable = userActivityColumns.has("user_id") && userActivityColumns.has("event_type") && userActivityColumns.has("created_at");
  const trailViewsAvailable = trailViewColumns.has("trail_id") && trailViewColumns.has("viewed_at");
  const emergencyContactsAvailable = emergencyContactColumns.has("user_id");
  const sosContactNotificationsAvailable = sosContactNotificationColumns.has("sos_event_id");
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
  const approvedIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE moderation_status = 'approved'"
    : null;
  const verifiedIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE moderation_status = 'verified'"
    : null;
  const adminVerifiedReportsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE moderation_status IN ('approved', 'verified')"
    : null;
  const legacyActiveIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE moderation_status = 'active'"
    : null;
  const communityConfirmedIncidentsQuery = safetyIncidentColumns.has("confirmations_count") && safetyIncidentColumns.has("disputes_count")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') NOT IN ('approved', 'verified', 'active', 'hidden', 'rejected') AND COALESCE(confirmations_count, 0) >= 5 AND COALESCE(confirmations_count, 0) > COALESCE(disputes_count, 0)"
    : null;
  const disputedIncidentsQuery = safetyIncidentColumns.has("confirmations_count") && safetyIncidentColumns.has("disputes_count")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') NOT IN ('hidden', 'rejected') AND COALESCE(disputes_count, 0) > COALESCE(confirmations_count, 0)"
    : null;
  const hiddenIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') = 'hidden'"
    : null;
  const rejectedIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') = 'rejected'"
    : null;
  const publicIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(moderation_status, 'pending') IN ('pending', 'approved', 'verified', 'active')"
    : "SELECT COUNT(*)::text AS count FROM safety_incidents";
  const nonPublicIncidentsQuery = safetyIncidentColumns.has("moderation_status")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE moderation_status IN ('hidden', 'rejected')"
    : null;
  const resolvedIncidentsQuery = safetyIncidentColumns.has("moderation_status") && safetyIncidentColumns.has("is_resolved")
    ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(is_resolved, false) = true"
    : safetyIncidentColumns.has("is_resolved")
      ? "SELECT COUNT(*)::text AS count FROM safety_incidents WHERE COALESCE(is_resolved, false) = true"
      : null;

  const recentSosQuery = sosEventColumns.has("status")
    ? "SELECT COUNT(*)::text AS count FROM sos_events WHERE status IN ('created', 'notifying', 'notified', 'acknowledged') AND created_at >= NOW() - INTERVAL '7 days'"
    : "SELECT COUNT(*)::text AS count FROM sos_events WHERE created_at >= NOW() - INTERVAL '7 days'";
  const sosEventsWithContactsQuery = sosContactNotificationsAvailable
    ? "SELECT COUNT(DISTINCT sos_event_id)::text AS count FROM sos_contact_notifications"
    : sosEventColumns.has("notified_contact_count")
      ? "SELECT COUNT(*)::text AS count FROM sos_events WHERE COALESCE(notified_contact_count, 0) > 0"
      : sosEventColumns.has("emergency_contacts_notified")
        ? "SELECT COUNT(*)::text AS count FROM sos_events WHERE COALESCE(emergency_contacts_notified, 0) > 0"
        : null;
  const emergencyContactNotificationsSentQuery = sosContactNotificationsAvailable && sosContactNotificationColumns.has("status")
    ? "SELECT COUNT(*)::text AS count FROM sos_contact_notifications WHERE status = 'sent'"
    : sosContactNotificationsAvailable
      ? "SELECT COUNT(*)::text AS count FROM sos_contact_notifications"
      : null;
  const emergencyContactNotificationAttemptsQuery = sosContactNotificationsAvailable
    ? "SELECT COUNT(*)::text AS count FROM sos_contact_notifications"
    : null;
  const activeEmergencyContactsWhere = emergencyContactColumns.has("is_active")
    ? "WHERE is_active = true"
    : "";
  const dangerousLocationsQuery = dangerousLocationColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM dangerous_locations WHERE is_active = true"
    : "SELECT COUNT(*)::text AS count FROM dangerous_locations";
  const activeFcmTokensQuery = pushTokenColumns.has("provider") && pushTokenColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM push_tokens WHERE provider = 'fcm' AND is_active = true"
    : pushTokenColumns.has("provider")
      ? "SELECT COUNT(*)::text AS count FROM push_tokens WHERE provider = 'fcm'"
      : null;
  const trailConditionsAvailable = trailConditionColumns.has("trail_id") && trailConditionColumns.has("reported_at");
  const trailConditionsUnresolvedQuery = trailConditionColumns.has("is_resolved")
    ? "SELECT COUNT(*)::text AS count FROM trail_conditions WHERE COALESCE(is_resolved, false) = false"
    : null;
  const trailConditionsByTypeQuery = trailConditionColumns.has("condition_type")
    ? "SELECT condition_type, COUNT(*)::int AS count FROM trail_conditions GROUP BY condition_type ORDER BY count DESC, condition_type ASC"
    : null;
  const trailConditionsBySeverityQuery = trailConditionColumns.has("severity")
    ? "SELECT severity, COUNT(*)::int AS count FROM trail_conditions GROUP BY severity ORDER BY count DESC, severity ASC"
    : null;
  const activeChallengesQuery = challengeColumns.has("status") && challengeColumns.has("start_at") && challengeColumns.has("end_at")
    ? "SELECT COUNT(*)::text AS count FROM challenges WHERE status = 'published' AND start_at <= NOW() AND end_at >= NOW()"
    : null;
  const totalBadgesQuery = achievementColumns.has("is_active")
    ? "SELECT COUNT(*)::text AS count FROM achievements WHERE is_active = true"
    : "SELECT COUNT(*)::text AS count FROM achievements";
  const visibleIncidentWhere = safetyIncidentColumns.has("moderation_status")
    ? "COALESCE(si.moderation_status, 'pending') NOT IN ('hidden', 'rejected')"
    : "TRUE";
  const trailDeletedFilter = trailColumns.has("deleted_at") ? "WHERE t.deleted_at IS NULL" : "";
  const trailRegionFilter = trailColumns.has("region")
    ? `${trailDeletedFilter ? `${trailDeletedFilter} AND` : "WHERE"} NULLIF(t.region, '') IS NOT NULL`
    : "";

  const [
    totalUsers,
    newUsersWeek,
    newUsersMonth,
    activeUsersWeek,
    activeUsersMonth,
    recentActiveUsersResult,
    activityByEventTypeResult,
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
    approvedIncidents,
    verifiedIncidents,
    adminVerifiedReports,
    legacyActiveIncidents,
    communityConfirmedIncidents,
    disputedIncidents,
    hiddenIncidents,
    rejectedIncidents,
    publicIncidents,
    nonPublicIncidents,
    resolvedIncidents,
    sosTotal,
    recentSos,
    emergencyContactsTotal,
    sosEventsWithContacts,
    emergencyContactNotificationsSent,
    emergencyContactNotificationAttempts,
    averageContactsPerUserResult,
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
    mostPopularTrailsResult,
    mostViewedTrailsMonthResult,
    mostActiveRegionsResult,
    topChallengeParticipationResult,
    safetyHotspotsResult,
    incidentReportsByRegionResult,
    trailConditionsTotal,
    unresolvedTrailConditions,
    trailConditionsByTypeResult,
    trailConditionsBySeverityResult,
    recentTrailConditionsResult,
    lastOchaImportResult,
  ] = await Promise.all([
    count("SELECT COUNT(*)::text AS count FROM profiles"),
    count("SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= date_trunc('week', NOW())"),
    count("SELECT COUNT(*)::text AS count FROM profiles WHERE created_at >= date_trunc('month', NOW())"),
    analyticsAvailable
      ? optionalCount("SELECT COUNT(DISTINCT user_id)::text AS count FROM user_activity_events WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'")
      : Promise.resolve(null),
    analyticsAvailable
      ? optionalCount("SELECT COUNT(DISTINCT user_id)::text AS count FROM user_activity_events WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'")
      : Promise.resolve(null),
    analyticsAvailable
      ? pool.query(
          `SELECT latest.user_id,
                  latest.last_active_at,
                  latest.event_count,
                  p.full_name,
                  p.username,
                  p.avatar_url
           FROM (
             SELECT user_id,
                    MAX(created_at) AS last_active_at,
                    COUNT(*)::int AS event_count
             FROM user_activity_events
             WHERE user_id IS NOT NULL
               AND created_at >= NOW() - INTERVAL '30 days'
             GROUP BY user_id
           ) latest
           LEFT JOIN profiles p ON p.user_id = latest.user_id OR p.id = latest.user_id
           ORDER BY latest.last_active_at DESC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    analyticsAvailable
      ? pool.query(
          `SELECT event_type, COUNT(*)::int AS event_count
           FROM user_activity_events
           WHERE created_at >= NOW() - INTERVAL '30 days'
           GROUP BY event_type
           ORDER BY event_count DESC, event_type ASC`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
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
    approvedIncidentsQuery ? optionalCount(approvedIncidentsQuery) : Promise.resolve(null),
    verifiedIncidentsQuery ? optionalCount(verifiedIncidentsQuery) : Promise.resolve(null),
    adminVerifiedReportsQuery ? optionalCount(adminVerifiedReportsQuery) : Promise.resolve(null),
    legacyActiveIncidentsQuery ? optionalCount(legacyActiveIncidentsQuery) : Promise.resolve(null),
    communityConfirmedIncidentsQuery ? optionalCount(communityConfirmedIncidentsQuery) : Promise.resolve(null),
    disputedIncidentsQuery ? optionalCount(disputedIncidentsQuery) : Promise.resolve(null),
    hiddenIncidentsQuery ? optionalCount(hiddenIncidentsQuery) : Promise.resolve(null),
    rejectedIncidentsQuery ? optionalCount(rejectedIncidentsQuery) : Promise.resolve(null),
    publicIncidentsQuery ? optionalCount(publicIncidentsQuery) : Promise.resolve(null),
    nonPublicIncidentsQuery ? optionalCount(nonPublicIncidentsQuery) : Promise.resolve(null),
    resolvedIncidentsQuery ? optionalCount(resolvedIncidentsQuery) : Promise.resolve(null),
    count("SELECT COUNT(*)::text AS count FROM sos_events"),
    optionalCount(recentSosQuery),
    emergencyContactsAvailable
      ? optionalCount(`SELECT COUNT(*)::text AS count FROM emergency_contacts ${activeEmergencyContactsWhere}`)
      : Promise.resolve(null),
    sosEventsWithContactsQuery ? optionalCount(sosEventsWithContactsQuery) : Promise.resolve(null),
    emergencyContactNotificationsSentQuery ? optionalCount(emergencyContactNotificationsSentQuery) : Promise.resolve(null),
    emergencyContactNotificationAttemptsQuery ? optionalCount(emergencyContactNotificationAttemptsQuery) : Promise.resolve(null),
    emergencyContactsAvailable
      ? pool.query<{ average: string | number | null }>(
          `SELECT AVG(contact_count)::text AS average
           FROM (
             SELECT user_id, COUNT(*) AS contact_count
             FROM emergency_contacts
             ${activeEmergencyContactsWhere}
             GROUP BY user_id
           ) per_user`
        ).catch(() => ({ rows: [{ average: null }] }))
      : Promise.resolve({ rows: [{ average: null }] }),
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
    trailViewsAvailable
      ? pool.query(
          `SELECT t.id, t.name, t.region, COUNT(tve.id)::int AS views_count
           FROM trail_view_events tve
           JOIN trails t ON t.id = tve.trail_id
           ${trailDeletedFilter}
           GROUP BY t.id, t.name, t.region
           ORDER BY views_count DESC, t.name ASC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    trailViewsAvailable
      ? pool.query(
          `SELECT t.id, t.name, t.region, COUNT(tve.id)::int AS views_count
           FROM trail_view_events tve
           JOIN trails t ON t.id = tve.trail_id
           ${trailDeletedFilter ? `${trailDeletedFilter} AND` : "WHERE"} tve.viewed_at >= date_trunc('month', NOW())
           GROUP BY t.id, t.name, t.region
           ORDER BY views_count DESC, t.name ASC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    trailViewsAvailable && trailColumns.has("region")
      ? pool.query(
          `SELECT t.region, COUNT(tve.id)::int AS views_count, COUNT(DISTINCT t.id)::int AS trail_count
           FROM trail_view_events tve
           JOIN trails t ON t.id = tve.trail_id
           ${trailRegionFilter}
           GROUP BY t.region
           ORDER BY views_count DESC, t.region ASC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    challengeParticipantColumns.has("challenge_id")
      ? pool.query(
          `SELECT c.id, c.title, COUNT(cp.user_id)::int AS participants_count
           FROM challenge_participants cp
           JOIN challenges c ON c.id = cp.challenge_id
           GROUP BY c.id, c.title
           ORDER BY participants_count DESC, c.title ASC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    safetyIncidentColumns.has("location_name")
      ? pool.query(
          `SELECT COALESCE(NULLIF(si.location_name, ''), NULLIF(si.headline, ''), si.incident_type, 'Unknown') AS location,
                  COUNT(*)::int AS incidents_count,
                  MAX(si.reported_at) AS latest_reported_at,
                  AVG(si.latitude)::float AS latitude,
                  AVG(si.longitude)::float AS longitude
           FROM safety_incidents si
           WHERE ${visibleIncidentWhere}
           GROUP BY 1
           ORDER BY incidents_count DESC, latest_reported_at DESC NULLS LAST
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    safetyIncidentColumns.has("trail_id") && trailColumns.has("region")
      ? pool.query(
          `SELECT COALESCE(NULLIF(t.region, ''), NULLIF(si.location_name, ''), 'Unknown') AS region,
                  COUNT(*)::int AS reports_count
           FROM safety_incidents si
           LEFT JOIN trails t ON t.id = si.trail_id
           WHERE ${visibleIncidentWhere}
           GROUP BY 1
           ORDER BY reports_count DESC, region ASC
           LIMIT 10`
          ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    trailConditionsAvailable
      ? count("SELECT COUNT(*)::text AS count FROM trail_conditions")
      : Promise.resolve(0),
    trailConditionsUnresolvedQuery ? optionalCount(trailConditionsUnresolvedQuery) : Promise.resolve(null),
    trailConditionsByTypeQuery
      ? pool.query(trailConditionsByTypeQuery).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    trailConditionsBySeverityQuery
      ? pool.query(trailConditionsBySeverityQuery).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    trailConditionsAvailable
      ? pool.query(
          `SELECT tc.id,
                  tc.trail_id,
                  t.name AS trail_name,
                  tc.user_id,
                  p.full_name,
                  tc.condition_type,
                  tc.severity,
                  tc.description,
                  tc.reported_at,
                  tc.is_resolved,
                  tc.resolved_at
           FROM trail_conditions tc
           LEFT JOIN trails t ON t.id = tc.trail_id
           LEFT JOIN profiles p ON p.user_id = tc.user_id OR p.id = tc.user_id
           ORDER BY tc.reported_at DESC
           LIMIT 10`
        ).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
    getLastOchaImportQuery()
      .then((query) => pool.query(query))
      .catch(() => ({ rows: [] })),
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
      active_this_week: activeUsersWeek,
      active_this_month: activeUsersMonth,
      recent_active_users: recentActiveUsersResult.rows,
      activity_by_event_type: activityByEventTypeResult.rows,
      unavailable_metrics: analyticsAvailable ? [] : ["active users require user_activity_events migration"],
    },
    trails: {
      total: totalTrails,
      published: publishedTrails,
      draft: draftTrails,
      private: privateTrails,
      new_this_month: newTrailsMonth,
      most_viewed: mostPopularTrailsResult.rows,
      unavailable_metrics: trailViewsAvailable ? [] : ["trail views require trail_view_events migration"],
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
      reports_awaiting_review: pendingIncidents,
      community_confirmed_reports: communityConfirmedIncidents,
      disputed_reports: disputedIncidents,
      approved_incidents: approvedIncidents,
      verified_incidents: verifiedIncidents,
      admin_verified_reports: adminVerifiedReports,
      hidden_incidents: hiddenIncidents,
      hidden_reports: hiddenIncidents,
      rejected_incidents: rejectedIncidents,
      public_incidents: publicIncidents,
      visible_public_incidents: publicIncidents,
      non_public_incidents: nonPublicIncidents,
      active_incidents: legacyActiveIncidents,
      legacy_active_incidents: legacyActiveIncidents,
      resolved_incidents: resolvedIncidents,
      sos_events_total: sosTotal,
      recent_open_sos_events: recentSos,
      emergency_contacts_total: emergencyContactsTotal,
      sos_events_with_contacts: sosEventsWithContacts,
      emergency_contact_notifications_sent: emergencyContactNotificationsSent,
      emergency_contact_notification_attempts: emergencyContactNotificationAttempts,
      average_contacts_per_user: averageContactsPerUserResult.rows[0]?.average === null
        ? null
        : Number(Number(averageContactsPerUserResult.rows[0]?.average ?? 0).toFixed(2)),
      dangerous_locations: dangerousLocations,
      checkpoint_reports: checkpointReports,
      last_ocha_import: lastOchaImportResult.rows[0] ?? null,
      unavailable_metrics: [
        ...(emergencyContactsAvailable ? [] : ["emergency contact metrics require emergency_contacts table"]),
        ...(sosEventsWithContactsQuery ? [] : ["sos_events_with_contacts requires SOS delivery counters or sos_contact_notifications"]),
        ...(emergencyContactNotificationsSentQuery ? [] : ["emergency_contact_notifications_sent requires sos_contact_notifications"]),
      ],
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
    business: {
      most_popular_trails: mostPopularTrailsResult.rows,
      most_viewed_trails_this_month: mostViewedTrailsMonthResult.rows,
      most_active_regions: trailColumns.has("region") ? mostActiveRegionsResult.rows : null,
      top_challenge_participation: topChallengeParticipationResult.rows,
      most_earned_badges: mostEarnedBadgesResult.rows,
      safety_hotspots: safetyHotspotsResult.rows,
      incident_reports_by_region: safetyIncidentColumns.has("trail_id") && trailColumns.has("region")
        ? incidentReportsByRegionResult.rows
        : null,
      unavailable_metrics: [
        ...(analyticsAvailable ? [] : ["active user analytics require user_activity_events migration"]),
        ...(trailViewsAvailable ? [] : ["trail popularity requires trail_view_events migration"]),
        ...(trailColumns.has("region") ? [] : ["region analytics require trails.region metadata"]),
        ...(safetyIncidentColumns.has("trail_id") && trailColumns.has("region") ? [] : ["incident_reports_by_region requires safety_incidents.trail_id and trails.region"]),
      ],
    },
    trail_conditions: {
      total: trailConditionsTotal,
      unresolved: unresolvedTrailConditions,
      by_type: trailConditionsByTypeResult.rows,
      by_severity: trailConditionsBySeverityResult.rows,
      recent: recentTrailConditionsResult.rows,
      unavailable_metrics: trailConditionsAvailable ? [] : ["trail condition reporting table is missing"],
    },
    time_series: {
      users_by_month: usersByMonth,
      trails_by_month: trailsByMonth,
      incidents_by_month: incidentsByMonth,
      activities_by_month: activitiesByMonth,
      challenges_joined_by_month: challengesByMonth,
      trail_conditions_by_month: trailConditionsAvailable ? await monthlySeries("trail_conditions") : [],
    },
  };
}

export async function listAdminUsers(input: { q?: string; page?: number; limit?: number } = {}) {
  const page = Math.max(1, Math.trunc(input.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 20) || 20));
  const offset = (page - 1) * limit;
  const search = input.q?.trim() ?? "";
  const searchTerm = search ? `%${search}%` : "";

  const [userColumns, profileColumns] = await Promise.all([
    getTableColumns("users"),
    getTableColumns("profiles"),
  ]);

  const hasUsersTable = userColumns.size > 0;
  const hasProfilesTable = profileColumns.size > 0;
  const hasProfileLocale = profileColumns.has("locale");
  if (!hasProfilesTable) {
    return { users: [], page, limit, total: 0, pages: 0 };
  }

  const joinUsersSql = hasUsersTable ? "LEFT JOIN users u ON u.id = p.user_id" : "";
  const searchParts = [
    "COALESCE(p.full_name, '') ILIKE $1",
    "COALESCE(p.bio, '') ILIKE $1",
    "COALESCE(p.location, '') ILIKE $1",
    hasUsersTable ? "COALESCE(u.email, '') ILIKE $1" : null,
    hasUsersTable ? "COALESCE(u.username, '') ILIKE $1" : null,
  ].filter(Boolean) as string[];
  const whereSql = searchParts.length ? `WHERE ${searchParts.join(" OR ")}` : "";
  const queryParams = searchParts.length ? [searchTerm] : [];

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM profiles p
     ${joinUsersSql}
     ${whereSql}`,
    queryParams
  );

  const result = await pool.query<AdminUserRow>(
    `SELECT
       p.user_id::text AS id,
       p.user_id::text AS user_id,
       p.full_name,
       p.role,
       p.avatar_url,
       p.bio,
       p.location,
       ${hasProfileLocale ? "p.locale" : "NULL::text"} AS locale,
       ${hasUsersTable ? "u.email" : "NULL::text"} AS email,
       ${hasUsersTable ? "u.username" : "NULL::text"} AS username,
       p.created_at,
       p.updated_at
     FROM profiles p
     ${joinUsersSql}
     ${whereSql}
     ORDER BY p.created_at DESC, p.full_name ASC
     LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
    [...queryParams, limit, offset]
  );

  const total = toNumber(countResult.rows[0]?.count);
  return {
    users: result.rows,
    page,
    limit,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
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
            COALESCE(moderation_status, 'pending') AS moderation_status,
            COALESCE(confirmations_count, confirmed_count, 0) AS confirmations_count,
            COALESCE(disputes_count, 0) AS disputes_count,
            COALESCE(community_confidence_score, 0) AS community_confidence_score,
            CASE
              WHEN COALESCE(moderation_status, 'pending') = 'hidden' THEN 'hidden'
              WHEN COALESCE(moderation_status, 'pending') IN ('approved', 'verified', 'active') THEN 'admin_verified'
              WHEN COALESCE(disputes_count, 0) > COALESCE(confirmations_count, confirmed_count, 0) THEN 'disputed'
              WHEN COALESCE(confirmations_count, confirmed_count, 0) >= 5
                AND COALESCE(confirmations_count, confirmed_count, 0) > COALESCE(disputes_count, 0) THEN 'community_confirmed'
              ELSE 'community_report'
            END AS trust_level
     FROM safety_incidents
     ${where}
     ORDER BY reported_at DESC, created_at DESC
     LIMIT 200`,
    values
  );
  return result.rows;
}

export async function moderateIncident(id: string, status: string, note: string | null, adminUserId: string) {
  console.log("[admin.service.moderateIncident] Request:", {
    incidentId: id,
    moderation_status: status,
    moderation_note: note,
    adminUserId,
  });

  try {
    const result = await pool.query(
      `UPDATE safety_incidents
       SET moderation_status = $2,
           moderation_note = $3,
           moderated_by = $4::uuid,
           moderated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, moderation_status, moderation_note, moderated_by, moderated_at`,
      [id, status, note, adminUserId]
    );
    if (result.rows[0]) {
      await pool.query("DELETE FROM trail_safety_scores");
    }
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("[admin.service.moderateIncident] DB ERROR:", {
      incidentId: id,
      moderation_status: status,
      moderation_note: note,
      adminUserId,
      error,
    });
    throw error;
  }
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

export async function listCheckpointReports(input: { q?: string } = {}) {
  const search = input.q?.trim() ?? "";
  const params: unknown[] = [];
  const where = search
    ? `WHERE (
         COALESCE(dl.name, '') ILIKE $1 OR
         COALESCE(dl.location_type, '') ILIKE $1 OR
         COALESCE(cr.status, '') ILIKE $1 OR
         COALESCE(cr.notes, '') ILIKE $1
       )`
    : "";

  if (search) {
    params.push(`%${search}%`);
  }

  const result = await pool.query(
    `SELECT cr.*, dl.name AS checkpoint_name, dl.location_type
     FROM checkpoint_reports cr
     LEFT JOIN dangerous_locations dl ON dl.id = cr.checkpoint_id
     ${where}
     ORDER BY cr.created_at DESC
     LIMIT 200`
    ,
    params
  );
  return result.rows;
}

export async function listSosEvents(input: { q?: string } = {}) {
  const search = input.q?.trim() ?? "";
  const params: unknown[] = [];
  const where = search
    ? `WHERE (
         COALESCE(p.full_name, '') ILIKE $1 OR
         COALESCE(p.role, '') ILIKE $1 OR
         COALESCE(s.user_id::text, '') ILIKE $1 OR
         COALESCE(s.status, '') ILIKE $1 OR
         COALESCE(s.status_note, '') ILIKE $1 OR
         COALESCE(s.message, '') ILIKE $1
       )`
    : "";

  if (search) {
    params.push(`%${search}%`);
  }

  const result = await pool.query(
    `SELECT s.*, p.full_name, p.avatar_url, p.role
     FROM sos_events s
     LEFT JOIN profiles p ON p.user_id = s.user_id OR p.id = s.user_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT 200`
    ,
    params
  );
  return result.rows;
}

export async function listOchaLogs() {
  try {
    const orderBySql = await getOchaLogOrderBySql();
    const orderClause = orderBySql ? ` ORDER BY ${orderBySql}` : "";
    const result = await pool.query(
      `SELECT *
       FROM news_fetch_log
       WHERE source = 'ocha'${orderClause}
       LIMIT 100`
    );
    return result.rows;
  } catch (error) {
    console.error("[admin.service.listOchaLogs] DB ERROR:", error);
    throw error;
  }
}

export async function runOchaImport() {
  return fetchOchaIncidents();
}
