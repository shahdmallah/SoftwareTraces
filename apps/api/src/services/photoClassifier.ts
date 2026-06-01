import Groq from "groq-sdk";

export interface PhotoClassification {
  category: "scenic_landscape" | "trail_condition" | "selfie" | "group_photo" | "unrelated";
  quality: "excellent" | "good" | "average" | "blurry" | "dark";
  quality_score: number;
  has_trail: boolean;
  has_people: boolean;
  has_landmark: boolean;
  recommended_for_trail_page: boolean;
  confidence: number;
  tags: string[];
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const visionModels = ["meta-llama/llama-4-scout-17b-16e-instruct"] as const;
const CLASSIFICATION_PROMPT = `Analyze this hiking trail photo. Return ONLY valid JSON, no other text.

Rules:
- If category is "scenic_landscape" or "trail_condition", recommended_for_trail_page MUST be true.
- If category is "selfie", "group_photo", or "unrelated", recommended_for_trail_page MUST be false.
- quality_score should be: 90-100 for excellent, 70-89 for good, 50-69 for average, below 50 for blurry/dark.

{
  "category": "scenic_landscape" or "trail_condition" or "selfie" or "group_photo" or "unrelated",
  "quality": "excellent" or "good" or "average" or "blurry" or "dark",
  "quality_score": number 0-100,
  "has_trail": true/false,
  "has_people": true/false,
  "has_landmark": true/false,
  "recommended_for_trail_page": true/false,
  "confidence": 0.0-1.0,
  "tags": ["tag1", "tag2"]
}`;
const categories = new Set<PhotoClassification["category"]>([
  "scenic_landscape",
  "trail_condition",
  "selfie",
  "group_photo",
  "unrelated",
]);
const qualities = new Set<PhotoClassification["quality"]>(["excellent", "good", "average", "blurry", "dark"]);

export function fallbackClassification(): PhotoClassification {
  console.log("[photoClassifier.fallbackClassification] Returning fallback classification");
  return {
    category: "unrelated",
    quality: "average",
    quality_score: 50,
    has_trail: false,
    has_people: false,
    has_landmark: false,
    recommended_for_trail_page: false,
    confidence: 0,
    tags: ["fallback"],
  };
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
    throw new Error("AI response did not contain JSON");
  }

  return withoutMarkdown.slice(jsonStart, jsonEnd + 1);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeClassification(value: unknown): PhotoClassification {
  if (!value || typeof value !== "object") {
    throw new Error("AI response JSON was not an object");
  }

  const parsed = value as Record<string, unknown>;
  const category = typeof parsed.category === "string" ? parsed.category : "";
  const quality = typeof parsed.quality === "string" ? parsed.quality : "";

  return {
    category: categories.has(category as PhotoClassification["category"])
      ? (category as PhotoClassification["category"])
      : "unrelated",
    quality: qualities.has(quality as PhotoClassification["quality"])
      ? (quality as PhotoClassification["quality"])
      : "average",
    quality_score: Math.round(clampNumber(parsed.quality_score, 0, 100, 50)),
    has_trail: parsed.has_trail === true,
    has_people: parsed.has_people === true,
    has_landmark: parsed.has_landmark === true,
    recommended_for_trail_page: parsed.recommended_for_trail_page === true,
    confidence: clampNumber(parsed.confidence, 0, 1, 0),
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "").slice(0, 12)
      : [],
  };
}

function getImageMimeType(imageBuffer: Buffer): string {
  if (imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (imageBuffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }

  if (imageBuffer.subarray(0, 4).toString("ascii") === "GIF8") {
    return "image/gif";
  }

  if (imageBuffer.subarray(0, 4).toString("ascii") === "RIFF" && imageBuffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  return "image/jpeg";
}

export async function classifyPhoto(imageBuffer: Buffer): Promise<PhotoClassification> {
  console.log("[photoClassifier.classifyPhoto] ========== START ==========");
  console.log("[photoClassifier.classifyPhoto] Image buffer size:", imageBuffer.length);

  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const base64Image = imageBuffer.toString("base64");
    if (base64Image.length > 4 * 1024 * 1024) {
      console.warn("[photoClassifier] Image too large (max 4MB base64), using fallback");
      return fallbackClassification();
    }

    const mimeType = getImageMimeType(imageBuffer);
    const imageUrl = `data:${mimeType};base64,${base64Image}`;
    let lastError: unknown = null;

    for (const model of visionModels) {
      try {
        console.log("[photoClassifier.classifyPhoto] Calling Groq vision model:", model);

        const completion = await groq.chat.completions.create({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: CLASSIFICATION_PROMPT },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
        } as any);

        const content = completion.choices[0]?.message?.content;
        console.log("[photoClassifier.classifyPhoto] Groq response received:", { model, hasContent: Boolean(content) });

        if (!content) {
          throw new Error(`Groq response was empty for model ${model}`);
        }

        const parsed = JSON.parse(cleanJsonResponse(content));
        const classification = normalizeClassification(parsed);
        console.log("[photoClassifier.classifyPhoto] Classification:", JSON.stringify(classification, null, 2));

        return classification;
      } catch (modelError) {
        lastError = modelError;
        console.error("[photoClassifier.classifyPhoto] Groq model failed:", {
          model,
          error: modelError instanceof Error ? modelError.message : String(modelError),
        });
      }
    }

    throw lastError ?? new Error("All Groq vision models failed");
  } catch (error) {
    console.error("[photoClassifier.classifyPhoto] AI classification failed for all configured vision models:", error);
    console.error("[photoClassifier.classifyPhoto] Error message:", error instanceof Error ? error.message : String(error));
    console.log("[photoClassifier.classifyPhoto] Falling back to default classification");
    return fallbackClassification();
  }
}
