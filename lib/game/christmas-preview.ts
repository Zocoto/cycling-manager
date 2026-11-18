export const CHRISTMAS_PREVIEW_HREF = "/apercus/noel/index.html";

// Public director identifiers only. This controls the menu, not file access.
const previewDirectorIds = new Set([
  "3161715a-ad6a-4335-b820-45fc1969a849", // Zocoto
  "d7ec0ccf-bcb4-4802-8a14-b458eccf41d7", // Ujik
  "2ac12cfa-b9a5-43ea-bf34-3685e07e0d89", // Fra Troisset
]);

export function showChristmasPreviewInMenu(directorId: string | null | undefined) {
  return typeof directorId === "string" && previewDirectorIds.has(directorId);
}
