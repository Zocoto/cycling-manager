// Private provisional/legacy previews only. Public collection access is checked
// by the sealed-catalogue RPC, never by this UUID or a query parameter.
const ALBUM_PILOT_OWNER_ID = "58140add-54c6-40af-9528-f823d0051d0f";

export function canAccessCollectorAlbum(userId: string | null | undefined): boolean {
  return userId === ALBUM_PILOT_OWNER_ID;
}
