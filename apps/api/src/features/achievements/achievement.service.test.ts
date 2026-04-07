import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAchievements } from "../../services/achievementService";

test("evaluateAchievements unlocks first_steps and climber when thresholds are met", () => {
  const available = [
    { id: "1", code: "FIRST_STEPS", name: "", description: "", icon: "", points: 50 },
    { id: "2", code: "CLIMBER", name: "", description: "", icon: "", points: 150 },
    { id: "3", code: "EXPLORER", name: "", description: "", icon: "", points: 200 }
  ];

  const result = evaluateAchievements(available, [], {
    totalActivities: 2,
    totalElevationGainM: 1200
  });

  assert.deepEqual(result.map((item) => item.code), ["FIRST_STEPS", "CLIMBER"]);
});
