import { ALBUM_PROFILES, type AlbumProfile, type CollectorCard } from "./collector-album";
import { getAlbumProfileCards, getAlbumProfileLeaves } from "./collector-album-layout";

export type AlbumPagePosition = { profile: AlbumProfile; leaf: 1 | 2 };

/** Desktop turns full chapters; mobile visits each nonempty printed leaf. */
export function getAlbumPageTurn(
  cards: readonly CollectorCard[],
  profile: AlbumProfile,
  leaf: 1 | 2,
  singlePage: boolean,
  direction: -1 | 1,
): AlbumPagePosition | null {
  const index = ALBUM_PROFILES.findIndex(entry => entry.id === profile);
  if (index < 0 || (leaf !== 1 && leaf !== 2) || (direction !== -1 && direction !== 1)) return null;
  if (singlePage) {
    const rightLeaf = getAlbumProfileLeaves(getAlbumProfileCards(cards, profile))[1];
    if (direction === 1 && leaf === 1 && rightLeaf.length > 0) return { profile, leaf: 2 };
    if (direction === -1 && leaf === 2) return { profile, leaf: 1 };
  }
  const adjacent = ALBUM_PROFILES[index + direction];
  if (!adjacent) return null;
  const previousHasRightLeaf = singlePage && direction === -1 && getAlbumProfileLeaves(getAlbumProfileCards(cards, adjacent.id))[1].length > 0;
  return { profile: adjacent.id, leaf: previousHasRightLeaf ? 2 : 1 };
}

/** Ignore short, vertical, diagonal and nonfinite gesture noise. */
export function getAlbumSwipeDirection(dx: number, dy: number): -1 | 1 | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx < 0 ? 1 : -1;
}
