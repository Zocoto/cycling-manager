// Result settlement remains owner-only. Public page access is separate.
const GALA_PREVIEW_OWNER_ID = "58140add-54c6-40af-9528-f823d0051d0f";

export function canAccessSeasonFourGala(userId: string | null | undefined): boolean {
  return userId === GALA_PREVIEW_OWNER_ID;
}

export function canExportSeasonFourGala(userId: string | null | undefined): boolean {
  // Gouille: verified active Cidrerie de l’Aulne account, not the unused
  // homonymous profile. Names, email addresses and roles grant no access.
  return userId === GALA_PREVIEW_OWNER_ID || userId === "ee244935-5722-4626-a28f-dc3cf63aa6f4";
}
