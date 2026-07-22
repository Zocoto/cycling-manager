import type { RaceStageSegment } from "@/lib/game/race-profiles";

export const RACE_SCENERY_KINDS = [
  "forest",
  "fields",
  "meadow",
  "coast",
  "village",
  "urban",
] as const;

export type RaceSceneryKind = (typeof RACE_SCENERY_KINDS)[number];

export const TEAM_KIT_PATTERNS = [
  "diagonal",
  "center_stripe",
  "halves",
  "chevron",
] as const;

export type TeamKitPattern = (typeof TEAM_KIT_PATTERNS)[number];

export function getRaceSceneryKind({
  seed,
  segment,
  isFinish = false,
}: {
  seed: string | number;
  segment: Pick<
    RaceStageSegment,
    "segmentNumber" | "terrain" | "surface"
  >;
  isFinish?: boolean;
}): RaceSceneryKind {
  const seedNumber = stableVisualHash(String(seed));

  if (isFinish) {
    return seedNumber % 3 === 0 ? "village" : "urban";
  }

  const rotatedIndex =
    (Math.max(1, segment.segmentNumber) - 1 +
      seedNumber % RACE_SCENERY_KINDS.length) %
    RACE_SCENERY_KINDS.length;
  const candidate = RACE_SCENERY_KINDS[rotatedIndex];

  if (segment.surface === "cobbles") {
    return (["village", "fields", "forest"] as const)[
      (segment.segmentNumber + seedNumber) % 3
    ];
  }

  if (segment.terrain === "climb" && ["coast", "urban", "fields"].includes(candidate)) {
    return segment.segmentNumber % 2 === 0 ? "forest" : "meadow";
  }

  if (segment.terrain === "descent" && candidate === "urban") {
    return seedNumber % 2 === 0 ? "forest" : "coast";
  }

  return candidate;
}

export function shouldShowRaceSpectators({
  seed,
  segmentNumber,
  scenery,
  isFinish = false,
}: {
  seed: string | number;
  segmentNumber: number;
  scenery: RaceSceneryKind;
  isFinish?: boolean;
}) {
  if (isFinish || scenery === "urban" || scenery === "village") return true;
  return (stableVisualHash(String(seed)) + segmentNumber) % 5 === 0;
}

export function getTeamKitPattern(teamId: string): TeamKitPattern {
  return TEAM_KIT_PATTERNS[
    stableVisualHash(teamId) % TEAM_KIT_PATTERNS.length
  ];
}

export function getTeamMonogram(teamName: string) {
  const words = teamName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");
  return (initials || teamName.slice(0, 2)).toLocaleUpperCase("fr");
}

function stableVisualHash(value: string) {
  return [...value].reduce(
    (total, character) =>
      (total * 31 + character.charCodeAt(0)) >>> 0,
    17
  );
}
