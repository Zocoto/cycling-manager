import type { CycloStickersEditionSummary } from "./cyclo-stickers-persistence";
export type CycloStickersLibraryEntry = CycloStickersEditionSummary;

export function cycloStickersEditionHref(editionId: string) {
  return `/jeu/album?edition=${encodeURIComponent(editionId)}`;
}

/** All visible labels use the season depicted by the stickers, not the year in
 * which its packs were distributed. These two seasons have distinct meanings. */
export function cycloStickersCollectionLabel(sourceSeason: number) {
  return `Album S${sourceSeason}`;
}
