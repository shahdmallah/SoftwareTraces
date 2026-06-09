import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";

const SERVICE_DIR = resolve(dirname(__dirname));
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";
const TAXONOMY_KEYS = ["kingdom", "phylum", "class", "order", "family", "genus", "species"] as const;
const SUPPORTED_LANGUAGES = new Set(["ar", "en"]);

type TaxonomyKey = (typeof TAXONOMY_KEYS)[number];

type Taxonomy = Record<TaxonomyKey, string>;

interface IdentificationResult {
  hasOrganism: boolean;
  noOrganismReason?: string;
  commonName: string;
  scientificName: string;
  shortDescription: string;
  confidenceLevel: number;
  taxonomy: Taxonomy;
  notableFeatures: string[];
  ecologicalRole: string;
  funFacts: string[];
}

interface UploadImage {
  imageBytes: Buffer;
  mimeType: string;
  language: string;
}

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function loadLocalEnv(): void {
  const envPath = join(SERVICE_DIR, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#") || !stripped.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValue] = stripped.split("=");
    const key = rawKey.trim();
    const value = rawValue.join("=").trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const IDENTIFICATION_SYSTEM_INSTRUCTION = `You are a highly detailed and rigorous biological expert, entomologist, and botanist.
First decide whether the photo clearly contains a plant, animal, fungus, or other organism.
If no organism is visible, or the organism is too obscured to identify, return hasOrganism false and do not invent a species.
Return STRICTLY a valid JSON object matching this schema:
{
  "hasOrganism": true,
  "noOrganismReason": "",
  "commonName": "Primary common name of organism",
  "scientificName": "Scientific nomenclature (Genus species)",
  "shortDescription": "An engaging, accurate 2-3 sentence overview describing the specimen.",
  "confidenceLevel": 92,
  "taxonomy": {
    "kingdom": "Kingdom classification",
    "phylum": "Phylum details",
    "class": "Class details",
    "order": "Order details",
    "family": "Family details",
    "genus": "Genus details",
    "species": "Species binomial naming"
  },
  "notableFeatures": [
    "At least 3 identifiable features, structures, or coloration patterns shown on this organism"
  ],
  "ecologicalRole": "Brief 1-sentence note of this species' role or habitat in its ecosystem.",
  "funFacts": [
    "At least 2 concise biological facts about this species."
  ]
}
Do not return Markdown or code fences.`;

const IDENTIFICATION_USER_PROMPT =
  "Identify the plant, animal, fungus, or other organism in this picture and provide its full biological taxonomy and descriptive details. If no organism is visible, return hasOrganism false with a short noOrganismReason.";

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ar:
    "Return all human-readable values in natural, grammatically correct Arabic. Keep the JSON property names exactly as specified. Keep scientificName as Latin binomial nomenclature. Use Arabic names for taxonomy values when they are commonly available.",
  en: "Return all human-readable values in English. Keep the JSON property names exactly as specified.",
};

function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
}

function getText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeLanguage(language: unknown): string {
  const normalized = typeof language === "string" ? language.trim().toLowerCase() : "en";
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "en";
}

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  }

  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeIdentification(data: unknown): IdentificationResult {
  const source = isRecord(data) ? data : {};
  const hasOrganism = source.hasOrganism !== false;
  const taxonomySource = isRecord(source.taxonomy) ? source.taxonomy : {};
  const taxonomy = TAXONOMY_KEYS.reduce<Taxonomy>((nextTaxonomy, key) => {
    nextTaxonomy[key] = getText(taxonomySource[key]);
    return nextTaxonomy;
  }, {} as Taxonomy);
  const rawConfidenceLevel = source.confidenceLevel;

  return {
    hasOrganism,
    noOrganismReason: getText(source.noOrganismReason),
    commonName: hasOrganism ? getText(source.commonName, "Unknown organism") : "No organism detected",
    scientificName: getText(source.scientificName),
    shortDescription: hasOrganism
      ? getText(source.shortDescription, "Google AI could not provide a detailed description for this organism.")
      : getText(source.shortDescription, getText(source.noOrganismReason, "No plant, animal, fungus, or other organism was detected in this photo.")),
    confidenceLevel: typeof rawConfidenceLevel === "number" ? Math.trunc(rawConfidenceLevel) : 0,
    taxonomy,
    notableFeatures: getStringList(source.notableFeatures),
    ecologicalRole: getText(source.ecologicalRole),
    funFacts: getStringList(source.funFacts),
  };
}

function parseGeminiIdentification(responseData: unknown): unknown {
  if (!isRecord(responseData)) {
    throw new Error("Gemini returned an unexpected response.");
  }

  const candidates = responseData.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini returned no candidates.");
  }

  const firstCandidate = candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content) || !Array.isArray(firstCandidate.content.parts)) {
    throw new Error("Gemini returned no content parts.");
  }

  const text = firstCandidate.content.parts
    .filter(isRecord)
    .map((part) => getText(part.text))
    .join("");

  if (!text.trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return JSON.parse(cleanJsonText(text));
}

async function identifyWithGemini(imageBytes: Buffer, mimeType: string, language = "en"): Promise<IdentificationResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpError(503, "Gemini API key is not configured. Set GEMINI_API_KEY to enable detailed identification.");
  }

  const responseLanguage = normalizeLanguage(language);
  const requestBody = {
    systemInstruction: {
      parts: [{ text: `${IDENTIFICATION_SYSTEM_INSTRUCTION}\n\n${LANGUAGE_INSTRUCTIONS[responseLanguage]}` }],
    },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBytes.toString("base64"),
            },
          },
          { text: `${IDENTIFICATION_USER_PROMPT}\nResponse language: ${responseLanguage}` },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT.replace("{model}", encodeURIComponent(GEMINI_MODEL)), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new HttpError(502, "Unable to reach Gemini for detailed identification.");
  }

  if (!response.ok) {
    const details = await response.text();
    throw new HttpError(502, `Gemini identification failed: ${details}`);
  }

  try {
    return normalizeIdentification(parseGeminiIdentification(await response.json()));
  } catch (error) {
    throw new HttpError(502, "Gemini returned an invalid identification payload.");
  }
}

function detectImageMimeType(imageBytes: Buffer): string | undefined {
  if (imageBytes.length >= 3 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    imageBytes.length >= 8 &&
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47 &&
    imageBytes[4] === 0x0d &&
    imageBytes[5] === 0x0a &&
    imageBytes[6] === 0x1a &&
    imageBytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (imageBytes.length >= 6 && ["GIF87a", "GIF89a"].includes(imageBytes.subarray(0, 6).toString("ascii"))) {
    return "image/gif";
  }

  if (
    imageBytes.length >= 12 &&
    imageBytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    imageBytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return undefined;
}

async function readUploadImage(req: IncomingMessage): Promise<UploadImage> {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    throw new HttpError(400, "Request must be multipart/form-data.");
  }

  const webRequest = new Request("http://localhost/upload", {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: Readable.toWeb(req),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  const formData = await webRequest.formData();
  const file = formData.get("file");

  if (!file || typeof file !== "object" || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
    throw new HttpError(400, "Missing uploaded image file.");
  }

  const imageBytes = Buffer.from(await (file as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer());
  const detectedMimeType = detectImageMimeType(imageBytes);
  if (!detectedMimeType) {
    throw new HttpError(400, "Uploaded file is not a valid image.");
  }

  return {
    imageBytes,
    mimeType: detectedMimeType,
    language: normalizeLanguage(formData.get("language")),
  };
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendError(res: ServerResponse, error: unknown): void {
  if (
    isRecord(error) &&
    (error.code === "ECONNRESET" || error.message === "aborted" || error.name === "AbortError")
  ) {
    if (!res.headersSent) {
      res.destroy();
    }
    return;
  }

  if (error instanceof HttpError) {
    sendJson(res, error.statusCode, { detail: error.message });
    return;
  }

  console.error("Wildlife inference request failed:", error);
  sendJson(res, 500, { detail: "Internal server error" });
}

async function handlePredict(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { imageBytes, mimeType, language } = await readUploadImage(req);
  const result = await identifyWithGemini(imageBytes, mimeType, language);
  if (!result.hasOrganism) {
    sendJson(res, 200, {
      top5: [],
      hasOrganism: false,
      noOrganismReason: result.noOrganismReason || result.shortDescription,
    });
    return;
  }

  const confidence = typeof result.confidenceLevel === "number" ? result.confidenceLevel / 100 : 0;
  const prediction: Record<string, number | string> = {
    name: getText(result.commonName, getText(result.scientificName, "Unknown organism")),
    confidence,
  };

  if (result.scientificName) {
    prediction.scientificName = result.scientificName;
  }

  if (result.commonName) {
    prediction.commonName = result.commonName;
  }

  sendJson(res, 200, { top5: [prediction] });
}

async function handleIdentify(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { imageBytes, mimeType, language } = await readUploadImage(req);
  const responseLanguage = normalizeLanguage(language);
  const result = await identifyWithGemini(imageBytes, mimeType, responseLanguage);

  sendJson(res, 200, {
    result,
    top5: result.hasOrganism
      ? []
      : [],
    source: "google-ai",
    language: responseLanguage,
    isFallback: false,
    fallbackReason: result.hasOrganism ? "" : result.noOrganismReason || result.shortDescription,
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", provider: "google-ai", model: GEMINI_MODEL });
      return;
    }

    if (req.method === "POST" && url.pathname === "/predict") {
      await handlePredict(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/identify") {
      await handleIdentify(req, res);
      return;
    }

    sendJson(res, 404, { detail: "Not found" });
  } catch (error) {
    sendError(res, error);
  }
}

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Traces wildlife inference running on ${HOST}:${PORT}`);
});
