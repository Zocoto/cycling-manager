import type { CareerTrophy, TrophyWin } from "@/lib/game/trophy-gallery";

export type TrophyAwardNotice = {
  sourceReference: string;
  kind: CareerTrophy["kind"];
};

export type TrophyArrival = {
  trophyId: string;
  trophyTitle: string;
  win: TrophyWin;
  isNew: boolean;
};

const SOURCE_PATTERN = /^(special|attendance|sponsor|race|uci-team|uci-rider|referral):[a-zA-Z0-9_-]{1,80}$/;

export function buildTrophyGalleryHref(sourceReference: string): string | null {
  const source = sourceReference.replace(/^trophy:/, "");
  return SOURCE_PATTERN.test(source)
    ? `/jeu/objectifs?onglet=trophees&trophee=${encodeURIComponent(source)}`
    : null;
}

export function getTrophyCardAnchor(trophyId: string): string {
  return `trophee-${trophyId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/** Resolve an individual award inside its merged, multi-season trophy. */
export function getTrophyArrivals({
  trophies,
  notices = [],
  focusedSource,
}: {
  trophies: CareerTrophy[];
  notices?: TrophyAwardNotice[];
  focusedSource?: string;
}): TrophyArrival[] {
  const arrivals: TrophyArrival[] = [];
  const sources = [
    ...(focusedSource ? [{ sourceReference: focusedSource }] : []),
    ...notices,
  ];
  for (const { sourceReference } of sources) {
    if (!SOURCE_PATTERN.test(sourceReference)) continue;
    const separator = sourceReference.indexOf(":");
    const sourceKind = sourceReference.slice(0, separator);
    const awardId = sourceReference.slice(separator + 1);
    for (const trophy of trophies) {
      const expectedPrefix =
        sourceKind === "special" && ["special", "achievement", "medical"].includes(trophy.kind)
          ? trophy.kind
          : sourceKind === "sponsor" && trophy.kind === "sponsor"
            ? "sponsor-ambassador"
            : sourceKind === "race" && ["grand_tour", "monument", "world_championship", "continental_championship"].includes(trophy.kind)
              ? trophy.kind.replaceAll("_", "-")
              : sourceKind;
      const win = (trophy.wins ?? [trophy]).find(
        (candidate) => candidate.id === `${expectedPrefix}:${awardId}`,
      );
      if (!win || arrivals.some((arrival) => arrival.win.id === win.id)) continue;
      arrivals.push({
        trophyId: trophy.id,
        trophyTitle: trophy.title,
        win,
        isNew: notices.some((notice) => notice.sourceReference === sourceReference),
      });
    }
  }
  return arrivals;
}
