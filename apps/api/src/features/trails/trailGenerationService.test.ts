import assert from "node:assert/strict";
import test from "node:test";
import { generateTrailFromDescription } from "../../services/trailGenerationService";

test("generateTrailFromDescription derives moderate difficulty when only length is provided", async () => {
  const generatedTrail = await generateTrailFromDescription({
    length_km: 6,
    difficulty: null,
    region: "ramallah",
    duration_minutes: null,
    labels: [],
    name_suggestion: null,
    description_suggestion: null,
  });

  assert.equal(generatedTrail.difficulty, "moderate");
  assert.ok(generatedTrail.elevation_gain_meters >= 250);
});

test("generateTrailFromDescription keeps explicit AI difficulty when it is present", async () => {
  const generatedTrail = await generateTrailFromDescription({
    length_km: 6,
    difficulty: "easy",
    region: "ramallah",
    duration_minutes: null,
    labels: [],
    name_suggestion: null,
    description_suggestion: null,
  });

  assert.equal(generatedTrail.difficulty, "easy");
});
