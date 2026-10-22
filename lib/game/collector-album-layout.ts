import { ALBUM_PROFILES, type AlbumProfile, type CollectorCard } from "./collector-album";

/** Keep the catalogue's frozen order within a complete profile chapter. */
export function getAlbumProfileCards<T extends Pick<CollectorCard, "profileKey"> & Partial<Pick<CollectorCard,"kind">>>(
  cards: readonly T[],
  profile: AlbumProfile,
): T[] {
  return cards.filter(card => !card.kind && card.profileKey === profile);
}

/** Split a chapter into two leaves without dropping, sorting or copying cards. */
export function getAlbumProfileLeaves<T>(cards: readonly T[]): [T[], T[]] {
  const middle = Math.ceil(cards.length / 2);
  return [cards.slice(0, middle), cards.slice(middle)];
}

/** Printed opening leaves, before the rider chapters; no separate catalogue. */
export function getAlbumIntroductionLeaves(cards: readonly CollectorCard[]): CollectorCard[][] {
  const continental = cards.filter(card=>card.kind === "continental");
  return [
    cards.filter(card=>card.kind === "team"),
    continental.slice(0,6),
    [...continental.slice(6),...cards.filter(card=>card.kind === "world")],
    cards.filter(card=>card.kind === "games" || card.kind === "legend"),
  ];
}

/** Browsing stops at the cover/end instead of silently wrapping chapters. */
export function getAdjacentAlbumProfile(profile: AlbumProfile, offset: -1 | 1): AlbumProfile {
  const current = ALBUM_PROFILES.findIndex(entry => entry.id === profile);
  const next = Math.max(0, Math.min(ALBUM_PROFILES.length - 1, current + offset));
  return ALBUM_PROFILES[next].id;
}
