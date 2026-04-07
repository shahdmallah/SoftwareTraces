import assert from "node:assert/strict";
import test from "node:test";
import { matchRecordedRouteToTrail } from "../../services/geospatialService";

test("matchRecordedRouteToTrail picks the closest candidate", () => {
  const result = matchRecordedRouteToTrail(
    [
      { lat: 31.9, lng: 35.2, recordedAt: new Date().toISOString() },
      { lat: 31.8, lng: 35.3, recordedAt: new Date().toISOString() }
    ],
    [
      {
        id: "trail-a",
        slug: "a",
        name: "A",
        description: "",
        region: "",
        difficulty: "easy",
        lengthKm: 1,
        estimatedDurationMin: 60,
        elevationGainM: 0,
        elevationLossM: 0,
        startPoint: { lat: 0, lng: 0 },
        endPoint: { lat: 0, lng: 0 },
        geometry: [],
        tags: [],
        isFeatured: false,
        createdAt: "",
        updatedAt: "",
        averageDistanceMeters: 50
      },
      {
        id: "trail-b",
        slug: "b",
        name: "B",
        description: "",
        region: "",
        difficulty: "easy",
        lengthKm: 1,
        estimatedDurationMin: 60,
        elevationGainM: 0,
        elevationLossM: 0,
        startPoint: { lat: 0, lng: 0 },
        endPoint: { lat: 0, lng: 0 },
        geometry: [],
        tags: [],
        isFeatured: false,
        createdAt: "",
        updatedAt: "",
        averageDistanceMeters: 350
      }
    ]
  );

  assert.equal(result.trailId, "trail-a");
  assert.ok(result.confidence > 0.9);
});
