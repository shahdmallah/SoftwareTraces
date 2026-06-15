import fetch from "node-fetch";
import Papa from "papaparse";
import { pool } from "../../db/pool";

type IncidentType =
  | "settler_attack"
  | "road_block"
  | "military_checkpoint"
  | "flying_checkpoint"
  | "harassment"
  | "land_confiscation"
  | "tree_uprooting"
  | "settler_presence"
  | "military_raid"
  | "other";

type Severity = "critical" | "high" | "medium" | "low";

interface HdxResource {
  name?: string;
  format?: string;
  download_url?: string;
  url?: string;
}

interface HdxDataset {
  title?: string;
  name?: string;
  resources?: HdxResource[];
}

interface HdxSearchResponse {
  result?: {
    results?: HdxDataset[];
  };
}

interface MappedIncident {
  incident_type: IncidentType;
  severity: Severity;
  latitude: number;
  longitude: number;
  description: string;
  headline: string;
  reported_at: Date;
  expires_at: Date;
  source_url: string;
}

const HDX_SEARCH_URL =
  "https://data.humdata.org/api/3/action/package_search?q=west+bank+incidents+protection&fq=organization:ocha-opt&rows=10";

function getText(row: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = row[fieldName] ?? row[fieldName.toUpperCase()] ?? row[fieldName.toLowerCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function getNumber(row: Record<string, unknown>, fieldNames: string[]): number | null {
  const text = getText(row, fieldNames);
  if (!text) {
    return null;
  }

  const parsed = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getIncidentType(row: Record<string, unknown>): IncidentType {
  const value = getText(row, [
    "category",
    "type",
    "event_type",
    "incident_type",
    "event",
    "classification",
    "sub_category",
  ]).toLowerCase();

  if (value.includes("settler")) return "settler_attack";
  if (value.includes("road") || value.includes("block")) return "road_block";
  if (value.includes("checkpoint")) return "military_checkpoint";
  if (value.includes("raid") || value.includes("incursion")) return "military_raid";
  if (value.includes("land") || value.includes("confiscat")) return "land_confiscation";
  if (value.includes("tree") || value.includes("uproot")) return "tree_uprooting";
  if (value.includes("harass")) return "harassment";

  return "other";
}

function getSeverity(row: Record<string, unknown>): Severity {
  const deaths = getNumber(row, ["deaths", "fatalities", "killed", "death_count", "fatality_count"]) ?? 0;
  const injuries = getNumber(row, ["injuries", "injured", "wounded", "injury_count", "wounded_count"]) ?? 0;

  if (deaths > 0) return "critical";
  if (injuries > 0) return "high";
  return "medium";
}

function getCoordinates(row: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  return {
    latitude: getNumber(row, ["latitude", "lat", "y"]),
    longitude: getNumber(row, ["longitude", "lon", "lng", "x"]),
  };
}

function getReportedAt(row: Record<string, unknown>): Date | null {
  const value = getText(row, ["date", "incident_date", "event_date", "reported_at"]);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getExpiresAt(reportedAt: Date, incidentType: IncidentType): Date {
  const expiresAt = new Date(reportedAt);

  switch (incidentType) {
    case "settler_attack":
      expiresAt.setDate(expiresAt.getDate() + 7);
      break;
    case "military_raid":
      expiresAt.setDate(expiresAt.getDate() + 3);
      break;
    case "flying_checkpoint":
      expiresAt.setHours(expiresAt.getHours() + 12);
      break;
    default:
      expiresAt.setHours(expiresAt.getHours() + 48);
      break;
  }

  return expiresAt;
}

function isValidIncident(incident: MappedIncident): boolean {
  const now = new Date();
  const oldestAllowed = new Date(now);
  oldestAllowed.setDate(oldestAllowed.getDate() - 90);

  return (
    incident.latitude >= 31.2 &&
    incident.latitude <= 32.6 &&
    incident.longitude >= 34.8 &&
    incident.longitude <= 35.8 &&
    incident.latitude !== 0 &&
    incident.longitude !== 0 &&
    incident.reported_at <= now &&
    incident.reported_at >= oldestAllowed
  );
}

function mapRowToIncident(row: Record<string, unknown>, sourceUrl: string): MappedIncident | null {
  const { latitude, longitude } = getCoordinates(row);
  const reportedAt = getReportedAt(row);

  if (latitude === null || longitude === null || !reportedAt) {
    return null;
  }

  const incidentType = getIncidentType(row);
  const description = getText(row, ["description", "details", "notes", "summary", "event_description"]);
  const headline = getText(row, ["headline", "title", "event_title", "location_name"]) || `OCHA ${incidentType.replace(/_/g, " ")}`;

  return {
    incident_type: incidentType,
    severity: getSeverity(row),
    latitude,
    longitude,
    description,
    headline,
    reported_at: reportedAt,
    expires_at: getExpiresAt(reportedAt, incidentType),
    source_url: sourceUrl,
  };
}

function parseCsv(text: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data;
}

function parseGeoJson(text: string): Record<string, unknown>[] {
  const parsed = JSON.parse(text) as {
    features?: Array<{
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: unknown };
    }>;
  };

  return (parsed.features ?? []).map((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const [longitude, latitude] = Array.isArray(coordinates) ? coordinates : [];

    return {
      ...(feature.properties ?? {}),
      latitude,
      longitude,
    };
  });
}

async function insertIncident(incident: MappedIncident): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO safety_incidents (
       incident_type, severity, latitude, longitude,
       description, headline, reported_at, expires_at,
       source, source_name, source_url, confirmed_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ocha', 'OCHA oPt', $9, 1)
     ON CONFLICT DO NOTHING`,
    [
      incident.incident_type,
      incident.severity,
      incident.latitude,
      incident.longitude,
      incident.description,
      incident.headline,
      incident.reported_at,
      incident.expires_at,
      incident.source_url,
    ]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function fetchOchaIncidents(): Promise<{ processed: number; inserted: number }> {
  console.log("[fetchOchaIncidents] Starting OCHA HDX fetch");
  let processed = 0;
  let inserted = 0;

  try {
    const searchResponse = await fetch(HDX_SEARCH_URL);
    if (!searchResponse.ok) {
      throw new Error(`HDX package search failed with status ${searchResponse.status}`);
    }

    const searchBody = (await searchResponse.json()) as HdxSearchResponse;
    const datasets = searchBody.result?.results ?? [];
    console.log(`[fetchOchaIncidents] Datasets found: ${datasets.length}`);

    for (const dataset of datasets) {
      console.log(`[fetchOchaIncidents] Dataset found: ${dataset.title ?? dataset.name ?? "Untitled dataset"}`);

      for (const resource of dataset.resources ?? []) {
        const format = (resource.format ?? "").toLowerCase();
        const resourceUrl = resource.download_url ?? resource.url;

        if (!resourceUrl || (format !== "csv" && format !== "geojson")) {
          continue;
        }

        console.log(`[fetchOchaIncidents] Fetching resource: ${resourceUrl}`);
        const resourceResponse = await fetch(resourceUrl);
        if (!resourceResponse.ok) {
          console.warn(`[fetchOchaIncidents] Resource failed with status ${resourceResponse.status}: ${resourceUrl}`);
          continue;
        }

        const resourceText = await resourceResponse.text();
        const rows = format === "csv" ? parseCsv(resourceText) : parseGeoJson(resourceText);
        let skipped = 0;
        console.log(`[fetchOchaIncidents] Rows parsed: ${rows.length}`);

        for (const row of rows) {
          processed += 1;
          const incident = mapRowToIncident(row, resourceUrl);

          if (!incident || !isValidIncident(incident)) {
            skipped += 1;
            continue;
          }

          if (await insertIncident(incident)) {
            inserted += 1;
          }
        }

        console.log(`[fetchOchaIncidents] Rows skipped: ${skipped}`);
      }
    }

    await pool.query(
      `INSERT INTO news_fetch_log (source, articles_processed, incidents_created)
       VALUES ('ocha', $1, $2)`,
      [processed, inserted]
    );

    console.log(`[fetchOchaIncidents] Complete. Processed: ${processed}, inserted: ${inserted}`);
    return { processed, inserted };
  } catch (error) {
    console.error("[fetchOchaIncidents] Error:", error);
    await pool.query(
      `INSERT INTO news_fetch_log (source, articles_processed, incidents_created, error)
       VALUES ('ocha', $1, $2, $3)`,
      [processed, inserted, error instanceof Error ? error.message : String(error)]
    );
    throw error;
  }
}
