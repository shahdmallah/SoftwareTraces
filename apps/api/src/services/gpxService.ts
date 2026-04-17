import { create } from "xmlbuilder2";
import type { ActivityPoint } from "@traces/shared-types";

/**
 * Generates a GPX document for a collection of activity points.
 */
export function generateGpx(points: ActivityPoint[], name: string): string {
  const root = create({ version: "1.0", encoding: "UTF-8" })
    .ele("gpx", { version: "1.1", creator: "Traces" })
    .ele("trk")
    .ele("name")
    .txt(name)
    .up()
    .ele("trkseg");

  points.forEach((point) => {
    const trkpt = root.ele("trkpt", { lat: point.lat, lon: point.lng });
    if (point.elevation !== undefined) {
      trkpt.ele("ele").txt(String(point.elevation));
    }
    trkpt.ele("time").txt(point.recordedAt);
  });

  return root.end({ prettyPrint: true });
}
