import assert from "node:assert/strict";
import test from "node:test";
import { createBadgeSchema, normalizeBadgeCode } from "./admin.controller";

test("normalizeBadgeCode uppercases and replaces whitespace with underscores", () => {
  assert.equal(normalizeBadgeCode(" first hike : 2026 "), "FIRST_HIKE:2026");
});

test("createBadgeSchema accepts lowercase badge codes and stores them canonically", () => {
  const badge = createBadgeSchema.parse({
    code: "first hike",
    name: "First Hike",
    description: "Awarded after the first hike.",
  });

  assert.equal(badge.code, "FIRST_HIKE");
});

test("createBadgeSchema still rejects unsupported badge code characters", () => {
  assert.throws(
    () =>
      createBadgeSchema.parse({
        code: "first/hike",
        name: "First Hike",
        description: "Awarded after the first hike.",
      }),
    /Code may only contain letters, numbers, underscores, hyphens, and colons/
  );
});
