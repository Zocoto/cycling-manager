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
  isStart = false,
  isFinish = false,
}: {
  seed: string | number;
  segment: Pick<
    RaceStageSegment,
    "segmentNumber" | "terrain" | "surface"
  >;
  isStart?: boolean;
  isFinish?: boolean;
}): RaceSceneryKind {
  const seedNumber = stableVisualHash(String(seed));

  if (isStart || isFinish) {
    return "urban";
  }

  const sceneryThemes = [
    ["forest", "meadow"],
    ["fields", "meadow"],
    ["coast", "village"],
    ["fields", "village"],
  ] as const satisfies ReadonlyArray<
    readonly [RaceSceneryKind, RaceSceneryKind]
  >;
  const theme = sceneryThemes[seedNumber % sceneryThemes.length];
  const candidate =
    theme[
      (Math.max(2, segment.segmentNumber) +
        ((seedNumber >>> 4) % 2)) %
        theme.length
    ];

  if (segment.surface === "cobbles") {
    return theme[1] === "village"
      ? "village"
      : theme[0];
  }

  if (segment.terrain === "climb" && candidate === "coast") {
    return theme[1];
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
