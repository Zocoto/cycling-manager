// Verified accounts: Zocoto and Gouille. The private review never depends on
// display names or a client-side flag and does not grant settlement permissions.
const PREVIEW_USERS = new Set([
  "58140add-54c6-40af-9528-f823d0051d0f",
  "ee244935-5722-4626-a28f-dc3cf63aa6f4",
]);

export function canAccessSeasonFiveGalaPreview(userId: string | null | undefined): boolean {
  return typeof userId === "string" && PREVIEW_USERS.has(userId);
}
