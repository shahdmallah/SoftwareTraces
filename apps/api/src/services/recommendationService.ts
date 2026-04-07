import type { Trail } from "@traces/shared-types";

/**
 * Produces a lightweight score for ranked trail suggestions.
 */
export function rankTrailsForUser(trails: Trail[], preferredDifficulty?: string): Trail[] {
  return [...trails].sort((left, right) => {
    const leftScore = (left.isFeatured ? 10 : 0) + (left.difficulty === preferredDifficulty ? 5 : 0);
    const rightScore = (right.isFeatured ? 10 : 0) + (right.difficulty === preferredDifficulty ? 5 : 0);

    return rightScore - leftScore;
  });
}
