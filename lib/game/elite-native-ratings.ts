import type { RiderRatingKey, RiderRatings } from "./rider-profile";

/** Extra race value earned by native points, never by equipment or context. */
export function getEliteNativeRatingPremium(nativeRating: number): number {
  const rating = Math.min(100, nativeRating);
  return (
    Math.max(0, rating - 85) * 0.25 +
    Math.max(0, rating - 90) * 0.25 +
    Math.max(0, rating - 95) * 0.25
  );
}

/** Apply once after contextual bonuses and their existing caps. Native ratings
 * stay unchanged in the input, database and rider profile. */
export function applyEliteNativeRatingPremium(
  adjustedRatings: RiderRatings,
  nativeRatings: RiderRatings = adjustedRatings,
): RiderRatings {
  let result = adjustedRatings;
  for (const key of Object.keys(nativeRatings) as RiderRatingKey[]) {
    const premium = getEliteNativeRatingPremium(nativeRatings[key]);
    if (premium === 0) continue;
    if (result === adjustedRatings) result = { ...adjustedRatings };
    result[key] = adjustedRatings[key] + premium;
  }
  return result;
}
