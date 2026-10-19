// Deliberately account-bound, never enabled by a query parameter or team name.
const ALBUM_PILOT_OWNER_ID = "58140add-54c6-40af-9528-f823d0051d0f";

export function canAccessCollectorAlbum(userId: string | null | undefined): boolean {
  return userId === ALBUM_PILOT_OWNER_ID;
}
