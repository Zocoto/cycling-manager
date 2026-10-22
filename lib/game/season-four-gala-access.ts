// This rehearsal belongs to Zocoto's authenticated account, not to a role,
// display name, team, URL flag or client-side preference.
const GALA_PREVIEW_OWNER_ID = "58140add-54c6-40af-9528-f823d0051d0f";

export function canAccessSeasonFourGala(userId: string | null | undefined): boolean {
  return userId === GALA_PREVIEW_OWNER_ID;
}
