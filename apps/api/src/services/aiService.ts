import Groq from "groq-sdk";

type TrailDifficulty = "easy" | "moderate" | "hard" | "expert";

export interface ParsedTrailDescription {
  length_km: number | null;
  difficulty: TrailDifficulty | null;
  region: string | null;
  duration_minutes: number | null;
  labels: string[];
  name_suggestion: string | null;
  description_suggestion: string | null;
}

export interface TrailMetadataStats {
  length_meters: number;
  elevation_gain_meters: number;
  difficulty: TrailDifficulty;
}

export interface GeneratedTrailMetadata {
  name: string;
  description: string;
  labels: string[];
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const model = "llama-3.3-70b-versatile";
const validDifficulties = new Set<TrailDifficulty>(["easy", "moderate", "hard", "expert"]);
const validLabels = new Set([
  "parking_included",
  "water_available",
  "kids_friendly",
  "family_friendly",
  "age_16_plus",
  "age_18_plus",
  "dogs_allowed",
  "viewpoint",
  "picnic_area",
  "camping_allowed",
  "best_in_spring",
  "best_in_autumn",
  "best_in_winter",
  "avoid_summer",
  "bathroom_available",
  "wheelchair_accessible",
  "wadi_trail",
  "archaeological_site",
  "mountain_trail",
  "steep_sections",
  "loop_trail",
  "olive_groves",
  "wild_zaatar",
  "carob_trees",
  "limestone_terrain",
  "ancient_terraces",
  "roman_ruins",
  "byzantine_churches",
  "ottoman_architecture",
  "spring_wildflowers",
]);

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
    throw new Error("AI response did not contain JSON");
  }

  return withoutMarkdown.slice(jsonStart, jsonEnd + 1);
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeLabels(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((label): label is string => typeof label === "string" && validLabels.has(label))
    : [];
}

function normalizeParsedDescription(value: unknown): ParsedTrailDescription {
  if (!value || typeof value !== "object") {
    throw new Error("AI response JSON was not an object");
  }

  const parsed = value as Record<string, unknown>;
  const difficulty = typeof parsed.difficulty === "string" ? parsed.difficulty.toLowerCase() : null;

  return {
    length_km: toNumberOrNull(parsed.length_km),
    difficulty: difficulty && validDifficulties.has(difficulty as TrailDifficulty) ? (difficulty as TrailDifficulty) : null,
    region: toStringOrNull(parsed.region),
    duration_minutes: toNumberOrNull(parsed.duration_minutes),
    labels: normalizeLabels(parsed.labels),
    name_suggestion: toStringOrNull(parsed.name_suggestion),
    description_suggestion: toStringOrNull(parsed.description_suggestion),
  };
}

function normalizeGeneratedMetadata(value: unknown): GeneratedTrailMetadata {
  if (!value || typeof value !== "object") {
    throw new Error("AI response JSON was not an object");
  }

  const parsed = value as Record<string, unknown>;

  return {
    name: toStringOrNull(parsed.name) ?? "Suggested Trail",
    description: toStringOrNull(parsed.description) ?? "A scenic trail to explore.",
    labels: normalizeLabels(parsed.labels),
  };
}

async function completeJson(prompt: string): Promise<unknown> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Groq response was empty");
  }

  return JSON.parse(cleanJsonResponse(content));
}

export async function parseTrailDescription(description: string): Promise<ParsedTrailDescription> {
  try {
    const prompt = `Extract structured information from this hiking trail description.
Return ONLY valid JSON, no other text, no markdown.

User description: "${description}"

Output format:
{
  "length_km": number or null,
  "difficulty": "easy" | "moderate" | "hard" | "expert" | null,
  "region": string or null,
  "duration_minutes": number or null,
  "labels": string[],
  "name_suggestion": string or null,
  "description_suggestion": string or null
}

Valid labels: parking_included, water_available, kids_friendly, family_friendly, age_16_plus, age_18_plus, dogs_allowed, viewpoint, picnic_area, camping_allowed, best_in_spring, best_in_autumn, best_in_winter, avoid_summer, bathroom_available, wheelchair_accessible, wadi_trail, archaeological_site, mountain_trail, steep_sections, loop_trail`;

    return normalizeParsedDescription(await completeJson(prompt));
  } catch (error) {
    console.error("[aiService.parseTrailDescription] Error:", error);
    throw error;
  }
}

export async function generateTrailMetadata(
  stats: TrailMetadataStats,
  region: string
): Promise<GeneratedTrailMetadata> {
  try {
    const prompt = `Generate a trail name, description, and relevant labels for this trail in Palestine.

Trail Data:
Length: ${(stats.length_meters / 1000).toFixed(1)} km

Elevation gain: ${stats.elevation_gain_meters} m

Difficulty: ${stats.difficulty}

Region: ${region} (e.g., Jericho, Nablus, Ramallah, Bethlehem, Hebron, Jenin)

Requirements:
Trail name should reference Palestinian geography (e.g., Wadi, Jabal, Ein, Khirbet, Tell)

Use Arabic words naturally integrated: Wadi (valley), Jabal (mountain), Ein (spring), Khirbet (ruin), Tell (hill), Bayt (house), Bir (well)

Examples of good Palestinian trail names:

"Wadi Qelt Desert Trail"

"Jabal Al-Nar Lookout"

"Ein Al-Fara Springs Walk"

"Khirbet Al-Yahud Historical Trail"

"Tell Al-Qafrah Hill Route"

"Bayt Jala Monastery Path"

Description should mention local landmarks, native plants, or historical sites

Labels should reflect Palestinian context: olive groves, wild za'atar, carob trees, limestone terrain, ancient terraces, Roman ruins, Byzantine churches, Ottoman architecture, spring wildflowers, etc.

Return ONLY valid JSON:
{
  "name": "Palestinian trail name (mix of Arabic and English)",
  "description": "Description mentioning local features, landmarks, and cultural context",
  "labels": ["palestinian_labels", "like", "olive_groves", "ancient_terraces", "wadi_trail"]
}`;

    return normalizeGeneratedMetadata(await completeJson(prompt));
  } catch (error) {
    console.error("[aiService.generateTrailMetadata] Error:", error);
    throw error;
  }
}
