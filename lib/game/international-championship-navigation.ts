import { getRaceProfileHref } from "./race-navigation";

export const INTERNATIONAL_CHAMPIONSHIPS_HREF =
  "/jeu/championnats-internationaux";
export const INTERNATIONAL_SELECTIONS_HREF =
  "/jeu/selections-internationales";

export function getInternationalChampionshipDirectoryHref(raceSlug?: string) {
  return raceSlug
    ? `${INTERNATIONAL_CHAMPIONSHIPS_HREF}#${encodeURIComponent(raceSlug.trim())}`
    : INTERNATIONAL_CHAMPIONSHIPS_HREF;
}

export function getInternationalChampionshipDetailsHref(raceSlug: string) {
  return getRaceProfileHref(raceSlug);
}

export function getInternationalChampionshipStartlistHref(raceSlug: string) {
  return `${getRaceProfileHref(raceSlug)}#peloton`;
}
