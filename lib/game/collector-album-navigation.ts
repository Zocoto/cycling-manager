import { ALBUM_PROFILES, type AlbumProfile, type CollectorCard } from "./collector-album";
import { ALBUM_INTRODUCTION_TITLES, getAlbumIntroductionLeaves, getAlbumProfileCards, getAlbumProfileLeaves } from "./collector-album-layout";

export type AlbumPagePosition = { profile: AlbumProfile; leaf: 1 | 2 };
export type AlbumBookPosition = {section:"introduction";leaf:number} | ({section:"riders"} & AlbumPagePosition);
type AlbumReadingPage = { position: AlbumBookPosition; title: string };

/** The contents follow the same physical leaves as mobile page turns. */
export function getAlbumReadingPages(cards: readonly CollectorCard[]): AlbumReadingPage[] {
  const pages: AlbumReadingPage[] = cards.some(card => card.kind)
    ? ALBUM_INTRODUCTION_TITLES.map((title, leaf) => ({ position: { section: "introduction", leaf }, title }))
    : [];

  for (const { id: profile, label: title } of ALBUM_PROFILES) {
    pages.push({ position: { section: "riders", profile, leaf: 1 }, title });
    if (getAlbumProfileLeaves(getAlbumProfileCards(cards, profile))[1].length > 0) {
      pages.push({ position: { section: "riders", profile, leaf: 2 }, title });
    }
  }

  return pages;
}

export function getAlbumReadingPageIndex(pages: readonly AlbumReadingPage[], position: AlbumBookPosition) {
  return pages.findIndex(page =>
    page.position.section === position.section &&
    page.position.leaf === position.leaf &&
    (page.position.section !== "riders" || (position.section === "riders" && page.position.profile === position.profile)),
  );
}

export function getAlbumBookTurn(cards: readonly CollectorCard[], position: AlbumBookPosition, singlePage: boolean, direction: -1|1): AlbumBookPosition | null {
  if (direction !== -1 && direction !== 1) return null;
  const hasIntroduction = cards.some(card=>card.kind);
  if (position.section === "introduction") {
    const leaves = getAlbumIntroductionLeaves(cards);
    if (!hasIntroduction || !Number.isInteger(position.leaf) || position.leaf<0 || position.leaf>=leaves.length) return null;
    const current = singlePage ? position.leaf : Math.floor(position.leaf/2)*2;
    const next = current + direction*(singlePage?1:2);
    if (next<0) return null;
    return next<leaves.length ? {section:"introduction",leaf:next} : {section:"riders",profile:"tours",leaf:1};
  }
  const next = getAlbumPageTurn(cards,position.profile,position.leaf,singlePage,direction);
  if (next) return {section:"riders",...next};
  return hasIntroduction && position.profile === "tours" && direction === -1 && (!singlePage || position.leaf === 1)
    ? {section:"introduction",leaf:singlePage?3:2} : null;
}

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
