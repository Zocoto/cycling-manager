import { getRaceProfileHref } from "./race-navigation";

export const INTERNATIONAL_CHAMPIONSHIPS_HREF =
  "/jeu/championnats-internationaux";
export const INTERNATIONAL_SELECTIONS_HREF =
  "/jeu/selections-internationales";

export function getInternationalSelectionsHref({
  audience = "professional",
  raceEditionId,
}: {
  audience?: "professional" | "junior";
  raceEditionId?: string | null;
} = {}) {
  const params = new URLSearchParams();
  if (audience === "junior") params.set("categorie", "junior");
  if (raceEditionId) params.set("epreuve", raceEditionId);
  const query = params.toString();
  return query ? `${INTERNATIONAL_SELECTIONS_HREF}?${query}` : INTERNATIONAL_SELECTIONS_HREF;
}

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
