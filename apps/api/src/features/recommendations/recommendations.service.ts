import Groq from "groq-sdk";
import { env } from "../../config/env";
import { pool } from "../../db/pool";

type TrailDifficulty = "easy" | "moderate" | "hard" | "expert";

interface PreferenceRow {
  id: string;
  user_id: string;
  preferred_regions: string[] | null;
  preferred_difficulties: string[] | null;
  preferred_features: string[] | null;
  preferred_tags: string[] | null;
  min_distance_km: string | number | null;
  max_distance_km: string | number | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface UserSignals {
  profileId: string;
  completedTrailIds: Set<string>;
  savedTrailIds: Set<string>;
  reviewedTrailIds: Set<string>;
  preferredRegionsFromHistory: Set<string>;
  preferredDifficultiesFromHistory: Set<string>;
  preferredFeaturesFromHistory: Set<string>;
  preferredTagsFromHistory: Set<string>;
}

interface CandidateTrailRow {
  id: string;
  name: string;
  name_ar: string | null;
  region: string | null;
  difficulty: string | null;
  length_meters: string | number | null;
  length_km: string | number;
  rating: string | number | null;
  average_rating: string | number | null;
  features: string[] | null;
  tags: string[] | null;
  description: string | null;
  image: string | null;
  safety_score: string | number | null;
  risk_level: string | null;
}

interface ScoredCandidate extends CandidateTrailRow {
  score: number;
  backendReason: string;
  matchTags: string[];
}

interface GroqRecommendation {
  trail_id: string;
  reason: string;
  match_tags: string[];
}

export interface RecommendationPreferenceInput {
  preferred_regions?: string[];
  preferred_difficulties?: string[];
  preferred_features?: string[];
  preferred_tags?: string[];
  min_distance_km?: number | null;
  max_distance_km?: number | null;
}

export interface RecommendationPreference {
  id: string | null;
  user_id: string;
  preferred_regions: string[];
  preferred_difficulties: string[];
  preferred_features: string[];
  preferred_tags: string[];
  min_distance_km: number | null;
  max_distance_km: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TrailRecommendation {
  trail_id: string;
  name: string;
  name_ar: string | null;
  region: string | null;
  difficulty: string | null;
  length_km: number;
  rating: number;
  safety_score: number | null;
  risk_level: string | null;
  image: string | null;
  score: number;
  reason: string;
  match_tags: string[];
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeList(values: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function normalizeSet(values: readonly string[] | null | undefined): Set<string> {
  return new Set(normalizeList(values).map(normalize));
}

function intersectNormalized(left: readonly string[] | null | undefined, right: Set<string>): string[] {
  return normalizeList(left).filter((value) => right.has(normalize(value)));
}

function formatPreference(row: PreferenceRow | undefined, profileId: string): RecommendationPreference {
  return {
    id: row?.id ?? null,
    user_id: profileId,
    preferred_regions: normalizeList(row?.preferred_regions),
    preferred_difficulties: normalizeList(row?.preferred_difficulties),
    preferred_features: normalizeList(row?.preferred_features),
    preferred_tags: normalizeList(row?.preferred_tags),
    min_distance_km: toNullableNumber(row?.min_distance_km),
    max_distance_km: toNullableNumber(row?.max_distance_km),
    created_at: row?.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function getProfileId(userId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM profiles
     WHERE id = $1::uuid OR user_id = $1::uuid
     LIMIT 1`,
    [userId]
  );

  const profileId = result.rows[0]?.id;
  if (!profileId) {
    throw new Error("Profile not found");
  }

  return profileId;
}

async function getPreferenceRow(profileId: string): Promise<PreferenceRow | undefined> {
  const result = await pool.query<PreferenceRow>(
    `SELECT id, user_id, preferred_regions, preferred_difficulties, preferred_features,
            preferred_tags, min_distance_km, max_distance_km, created_at, updated_at
     FROM user_trail_preferences
     WHERE user_id = $1::uuid
     LIMIT 1`,
    [profileId]
  );

  return result.rows[0];
}

export async function getRecommendationPreferences(userId: string): Promise<RecommendationPreference> {
  const profileId = await getProfileId(userId);
  const preferences = await getPreferenceRow(profileId);
  return formatPreference(preferences, profileId);
}

export async function updateRecommendationPreferences(
  userId: string,
  input: RecommendationPreferenceInput
): Promise<RecommendationPreference> {
  const profileId = await getProfileId(userId);
  const result = await pool.query<PreferenceRow>(
    `INSERT INTO user_trail_preferences (
       user_id,
       preferred_regions,
       preferred_difficulties,
       preferred_features,
       preferred_tags,
       min_distance_km,
       max_distance_km,
       updated_at
     )
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       preferred_regions = EXCLUDED.preferred_regions,
       preferred_difficulties = EXCLUDED.preferred_difficulties,
       preferred_features = EXCLUDED.preferred_features,
       preferred_tags = EXCLUDED.preferred_tags,
       min_distance_km = EXCLUDED.min_distance_km,
       max_distance_km = EXCLUDED.max_distance_km,
       updated_at = NOW()
     RETURNING id, user_id, preferred_regions, preferred_difficulties, preferred_features,
               preferred_tags, min_distance_km, max_distance_km, created_at, updated_at`,
    [
      profileId,
      normalizeList(input.preferred_regions),
      normalizeList(input.preferred_difficulties),
      normalizeList(input.preferred_features),
      normalizeList(input.preferred_tags),
      input.min_distance_km ?? null,
      input.max_distance_km ?? null,
    ]
  );

  return formatPreference(result.rows[0], profileId);
}

async function getUserSignals(userId: string, profileId: string): Promise<UserSignals> {
  const [completedResult, savedResult, reviewedResult, historyResult] = await Promise.all([
    pool.query<{ trail_id: string }>(
      `SELECT DISTINCT trail_id
       FROM activities
       WHERE (user_id = $1::uuid OR user_id = $2::uuid)
         AND status = 'completed'
         AND trail_id IS NOT NULL`,
      [userId, profileId]
    ),
    pool.query<{ trail_id: string }>(
      `SELECT DISTINCT trail_id
       FROM saved_trails
       WHERE user_id = $1::uuid OR user_id = $2::uuid`,
      [userId, profileId]
    ),
    pool.query<{ trail_id: string }>(
      `SELECT DISTINCT trail_id
       FROM trail_reviews
       WHERE user_id = $1::uuid OR user_id = $2::uuid`,
      [userId, profileId]
    ),
    pool.query<{
      region: string | null;
      difficulty: string | null;
      features: string[] | null;
      tags: string[] | null;
    }>(
      `WITH history AS (
         SELECT trail_id FROM activities
         WHERE (user_id = $1::uuid OR user_id = $2::uuid)
           AND status = 'completed'
           AND trail_id IS NOT NULL
         UNION
         SELECT trail_id FROM saved_trails
         WHERE user_id = $1::uuid OR user_id = $2::uuid
         UNION
         SELECT trail_id FROM trail_reviews
         WHERE user_id = $1::uuid OR user_id = $2::uuid
       )
       SELECT t.region, t.difficulty, t.features, t.tags
       FROM trails t
       JOIN history h ON h.trail_id = t.id`,
      [userId, profileId]
    ),
  ]);

  const signals: UserSignals = {
    profileId,
    completedTrailIds: new Set(completedResult.rows.map((row) => row.trail_id)),
    savedTrailIds: new Set(savedResult.rows.map((row) => row.trail_id)),
    reviewedTrailIds: new Set(reviewedResult.rows.map((row) => row.trail_id)),
    preferredRegionsFromHistory: new Set(),
    preferredDifficultiesFromHistory: new Set(),
    preferredFeaturesFromHistory: new Set(),
    preferredTagsFromHistory: new Set(),
  };

  for (const row of historyResult.rows) {
    if (row.region) signals.preferredRegionsFromHistory.add(normalize(row.region));
    if (row.difficulty) signals.preferredDifficultiesFromHistory.add(normalize(row.difficulty));
    for (const feature of row.features ?? []) signals.preferredFeaturesFromHistory.add(normalize(feature));
    for (const tag of row.tags ?? []) signals.preferredTagsFromHistory.add(normalize(tag));
  }

  return signals;
}

async function getCandidateTrails(signals: UserSignals): Promise<CandidateTrailRow[]> {
  const excludedTrailIds = Array.from(signals.completedTrailIds);
  const result = await pool.query<CandidateTrailRow>(
    `SELECT
       t.id,
       t.name,
       t.name_ar,
       t.region,
       t.difficulty,
       t.length_meters,
       COALESCE(t.length_meters, 0) / 1000.0 AS length_km,
       COALESCE(t.average_rating, t.rating, 0) AS rating,
       t.average_rating,
       t.features,
       t.tags,
       t.description,
       t.image,
       tss.safety_score,
       tss.risk_level
     FROM trails t
     LEFT JOIN trail_safety_scores tss ON tss.trail_id = t.id
     WHERE COALESCE(t.is_active, true) = true
       AND COALESCE(t.status, 'published') = 'published'
       AND t.deleted_at IS NULL
       AND (cardinality($1::uuid[]) = 0 OR t.id <> ALL($1::uuid[]))
     ORDER BY COALESCE(t.average_rating, t.rating, 0) DESC, t.created_at DESC
     LIMIT 80`,
    [excludedTrailIds]
  );

  return result.rows;
}

function getLengthKm(candidate: CandidateTrailRow): number {
  return Number(toNumber(candidate.length_km).toFixed(1));
}

function scoreCandidate(
  candidate: CandidateTrailRow,
  preferences: RecommendationPreference,
  signals: UserSignals
): ScoredCandidate {
  let score = 20;
  const reasons: string[] = [];
  const matchTags: string[] = [];

  const preferredRegions = normalizeSet(preferences.preferred_regions);
  const preferredDifficulties = normalizeSet(preferences.preferred_difficulties);
  const preferredFeatures = normalizeSet(preferences.preferred_features);
  const preferredTags = normalizeSet(preferences.preferred_tags);
  const candidateRegion = normalize(candidate.region);
  const candidateDifficulty = normalize(candidate.difficulty);
  const candidateFeatures = normalizeList(candidate.features);
  const candidateTags = normalizeList(candidate.tags);
  const lengthKm = getLengthKm(candidate);
  const rating = toNumber(candidate.rating);
  const safetyScore = toNullableNumber(candidate.safety_score);

  if (candidateRegion && preferredRegions.has(candidateRegion)) {
    score += 20;
    reasons.push(`matches your preferred region ${candidate.region}`);
    matchTags.push(candidate.region ?? "preferred region");
  } else if (candidateRegion && signals.preferredRegionsFromHistory.has(candidateRegion)) {
    score += 10;
    reasons.push(`is in a region you have explored before`);
    matchTags.push(candidate.region ?? "familiar region");
  }

  if (candidateDifficulty && preferredDifficulties.has(candidateDifficulty)) {
    score += 16;
    reasons.push(`matches your preferred difficulty`);
    matchTags.push(candidate.difficulty ?? "preferred difficulty");
  } else if (candidateDifficulty && signals.preferredDifficultiesFromHistory.has(candidateDifficulty)) {
    score += 8;
    reasons.push(`has a difficulty similar to trails you saved or completed`);
    matchTags.push(candidate.difficulty ?? "similar difficulty");
  }

  const matchingFeatures = intersectNormalized(candidateFeatures, preferredFeatures);
  const matchingTags = intersectNormalized(candidateTags, preferredTags);
  const historyFeatureMatches = intersectNormalized(candidateFeatures, signals.preferredFeaturesFromHistory);
  const historyTagMatches = intersectNormalized(candidateTags, signals.preferredTagsFromHistory);

  if (matchingFeatures.length > 0) {
    score += Math.min(18, matchingFeatures.length * 6);
    reasons.push(`has features you prefer`);
    matchTags.push(...matchingFeatures.slice(0, 3));
  }

  if (matchingTags.length > 0) {
    score += Math.min(14, matchingTags.length * 5);
    reasons.push(`matches your preferred tags`);
    matchTags.push(...matchingTags.slice(0, 3));
  }

  if (matchingFeatures.length === 0 && historyFeatureMatches.length > 0) {
    score += Math.min(8, historyFeatureMatches.length * 3);
    matchTags.push(...historyFeatureMatches.slice(0, 2));
  }

  if (matchingTags.length === 0 && historyTagMatches.length > 0) {
    score += Math.min(6, historyTagMatches.length * 2);
    matchTags.push(...historyTagMatches.slice(0, 2));
  }

  if (preferences.min_distance_km !== null && lengthKm >= preferences.min_distance_km) {
    score += 4;
  }

  if (preferences.max_distance_km !== null && lengthKm <= preferences.max_distance_km) {
    score += 8;
    reasons.push(`fits your distance range`);
    matchTags.push(`${lengthKm} km`);
  }

  if (rating >= 4.5) {
    score += 12;
    reasons.push(`has a strong rating`);
    matchTags.push("high rating");
  } else if (rating >= 4) {
    score += 8;
  }

  if (safetyScore !== null) {
    if (safetyScore >= 80) {
      score += 10;
      reasons.push("has a strong safety score");
      matchTags.push("safer route");
    } else if (safetyScore >= 60) {
      score += 4;
    } else if (safetyScore < 40) {
      score -= 10;
    }
  }

  if (signals.savedTrailIds.has(candidate.id)) {
    score -= 5;
  }

  if (signals.reviewedTrailIds.has(candidate.id)) {
    score -= 5;
  }

  return {
    ...candidate,
    score: Math.max(0, Math.min(100, Math.round(score))),
    backendReason: reasons.length > 0
      ? `Recommended because it ${reasons.slice(0, 3).join(", ")}.`
      : "Recommended because it is an active, well-rated trail that fits your hiking profile.",
    matchTags: Array.from(new Set(matchTags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 5),
  };
}

function buildFallbackRecommendations(candidates: ScoredCandidate[]): TrailRecommendation[] {
  return candidates.map((candidate) => ({
    trail_id: candidate.id,
    name: candidate.name,
    name_ar: candidate.name_ar,
    region: candidate.region,
    difficulty: candidate.difficulty,
    length_km: getLengthKm(candidate),
    rating: toNumber(candidate.rating),
    safety_score: toNullableNumber(candidate.safety_score),
    risk_level: candidate.risk_level,
    image: candidate.image,
    score: candidate.score,
    reason: candidate.backendReason,
    match_tags: candidate.matchTags,
  }));
}

function cleanJsonResponse(responseText: string): string {
  const withoutMarkdown = responseText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const jsonStart = withoutMarkdown.indexOf("{");
  const jsonEnd = withoutMarkdown.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("Groq response did not contain JSON");
  }

  return withoutMarkdown.slice(jsonStart, jsonEnd + 1);
}

async function rankWithGroq(
  candidates: ScoredCandidate[],
  preferences: RecommendationPreference
): Promise<Map<string, GroqRecommendation> | null> {
  if (!env.GROQ_API_KEY) {
    return null;
  }

  try {
    const groq = new Groq({ apiKey: env.GROQ_API_KEY });
    const candidateTrails = candidates.map((candidate) => ({
      trail_id: candidate.id,
      name: candidate.name,
      region: candidate.region,
      difficulty: candidate.difficulty,
      length_km: getLengthKm(candidate),
      rating: toNumber(candidate.rating),
      safety_score: toNullableNumber(candidate.safety_score),
      risk_level: candidate.risk_level,
      features: candidate.features ?? [],
      tags: candidate.tags ?? [],
      backend_score: candidate.score,
      backend_reason: candidate.backendReason,
    }));
    const prompt = `You rank hiking trail recommendations for a Palestinian hiking app.
Return ONLY valid JSON. Recommend only trail_id values from candidateTrails. Do not invent trails.
Keep reasons short, friendly, and concrete.

User preferences:
${JSON.stringify(preferences)}

candidateTrails:
${JSON.stringify(candidateTrails)}

Output JSON shape:
{
  "recommendations": [
    {
      "trail_id": "existing candidate trail id",
      "reason": "short reason",
      "match_tags": ["short tag", "short tag"]
    }
  ]
}`;

    const completion = await groq.chat.completions.create({
      model: env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });
    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    const parsed = JSON.parse(cleanJsonResponse(content)) as { recommendations?: unknown };
    if (!Array.isArray(parsed.recommendations)) {
      return null;
    }

    const allowedTrailIds = new Set(candidates.map((candidate) => candidate.id));
    const ranked = new Map<string, GroqRecommendation>();

    for (const rawRecommendation of parsed.recommendations) {
      if (!rawRecommendation || typeof rawRecommendation !== "object") {
        continue;
      }

      const recommendation = rawRecommendation as Record<string, unknown>;
      const trailId = typeof recommendation.trail_id === "string" ? recommendation.trail_id : "";

      if (!allowedTrailIds.has(trailId) || ranked.has(trailId)) {
        continue;
      }

      ranked.set(trailId, {
        trail_id: trailId,
        reason: typeof recommendation.reason === "string" && recommendation.reason.trim() !== ""
          ? recommendation.reason.trim()
          : candidates.find((candidate) => candidate.id === trailId)?.backendReason ?? "Recommended for your hiking profile.",
        match_tags: Array.isArray(recommendation.match_tags)
          ? recommendation.match_tags.filter((tag): tag is string => typeof tag === "string").slice(0, 5)
          : [],
      });
    }

    return ranked;
  } catch (error) {
    console.error("[recommendations.rankWithGroq] Groq ranking failed:", error);
    return null;
  }
}

async function logRecommendations(
  profileId: string,
  recommendations: TrailRecommendation[],
  context: Record<string, unknown>
): Promise<void> {
  try {
    for (const recommendation of recommendations) {
      await pool.query(
        `INSERT INTO trail_recommendation_logs (
           user_id,
           recommended_trail_id,
           score,
           reason,
           source,
           model,
           context
         )
         VALUES ($1::uuid, $2::uuid, $3, $4, 'hybrid_ai', $5, $6::jsonb)`,
        [
          profileId,
          recommendation.trail_id,
          recommendation.score,
          recommendation.reason,
          env.GROQ_API_KEY ? env.GROQ_MODEL ?? "llama-3.3-70b-versatile" : null,
          JSON.stringify(context),
        ]
      );
    }
  } catch (error) {
    console.error("[recommendations.logRecommendations] Failed to log recommendations:", error);
  }
}

export async function getTrailRecommendations(userId: string): Promise<TrailRecommendation[]> {
  const profileId = await getProfileId(userId);
  const [preferenceRow, signals] = await Promise.all([
    getPreferenceRow(profileId),
    getUserSignals(userId, profileId),
  ]);
  const preferences = formatPreference(preferenceRow, profileId);
  const candidates = await getCandidateTrails(signals);
  const scoredCandidates = candidates
    .map((candidate) => scoreCandidate(candidate, preferences, signals))
    .sort((left, right) => right.score - left.score)
    .slice(0, 20);

  const fallbackRecommendations = buildFallbackRecommendations(scoredCandidates);
  const groqRanking = await rankWithGroq(scoredCandidates, preferences);

  if (!groqRanking || groqRanking.size === 0) {
    const fallback = fallbackRecommendations.slice(0, 10);
    await logRecommendations(profileId, fallback, {
      candidate_count: candidates.length,
      ranked_by: "backend_fallback",
      preferences,
    });
    return fallback;
  }

  const fallbackById = new Map(fallbackRecommendations.map((recommendation) => [recommendation.trail_id, recommendation]));
  const rankedRecommendations: TrailRecommendation[] = [];

  for (const groqRecommendation of groqRanking.values()) {
    const fallback = fallbackById.get(groqRecommendation.trail_id);
    if (!fallback) {
      continue;
    }

    rankedRecommendations.push({
      ...fallback,
      reason: groqRecommendation.reason,
      match_tags: groqRecommendation.match_tags.length > 0 ? groqRecommendation.match_tags : fallback.match_tags,
    });
  }

  for (const fallback of fallbackRecommendations) {
    if (rankedRecommendations.length >= 10) {
      break;
    }

    if (!rankedRecommendations.some((recommendation) => recommendation.trail_id === fallback.trail_id)) {
      rankedRecommendations.push(fallback);
    }
  }

  await logRecommendations(profileId, rankedRecommendations, {
    candidate_count: candidates.length,
    ranked_by: "groq",
    preferences,
  });
  return rankedRecommendations;
}
