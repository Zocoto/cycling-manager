import type {
  RaceFormat,
  RaceProfileType,
} from "@/lib/game/race-calendar";
import { isRaceRegistrationHref } from "@/lib/game/race-navigation";
import type { RaceStageSegment } from "@/lib/game/race-profiles";

const RACES_WITHOUT_QUICK_PREVIEW = new Set([
  "criterium-de-la-decouverte",
]);

export type RaceQuickPreviewStage = {
  id: string;
  dayNumber: number;
  stageNumber: number;
  name: string;
  profileType: RaceProfileType;
  distanceKm: number;
  segments: RaceStageSegment[];
};

export type RaceQuickPreview = {
  id: string;
  slug: string;
  name: string;
  raceFormat: RaceFormat;
  stages: RaceQuickPreviewStage[];
};

export type RaceQuickPreviewTarget = {
  slug: string;
  stageNumber: number | null;
};

export type CobblesSummary = {
  sectorCount: number;
  distanceKm: number;
};

export function getRaceQuickPreviewTargetFromHref(
  href: string,
): RaceQuickPreviewTarget | null {
  if (isRaceRegistrationHref(href)) return null;

  const pathname = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const match = pathname.match(
    /^\/jeu\/(?:courses|resultats)\/([^/]+)(?:\/(\d+))?$/,
  );

  if (!match) return null;

  try {
    const stageNumber = match[2] ? Number(match[2]) : null;

    if (
      stageNumber !== null &&
      (!Number.isInteger(stageNumber) || stageNumber < 1)
    ) {
      return null;
    }

    const slug = decodeURIComponent(match[1]);

    if (RACES_WITHOUT_QUICK_PREVIEW.has(slug)) return null;

    return {
      slug,
      stageNumber,
    };
  } catch {
    return null;
  }
}

export function summarizeCobbles(
  segments: RaceStageSegment[],
): CobblesSummary {
  let sectorCount = 0;
  let distanceKm = 0;
  let previousWasCobbled = false;

  for (const segment of segments) {
    const isCobbled = segment.surface === "cobbles";

    if (isCobbled) {
      distanceKm += segment.distanceKm;
      if (!previousWasCobbled) sectorCount += 1;
    }

    previousWasCobbled = isCobbled;
  }

  return { sectorCount, distanceKm };
}
