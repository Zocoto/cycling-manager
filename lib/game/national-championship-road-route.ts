import type { RaceStageSegment } from "@/lib/game/race-profiles";

export const NATIONAL_CHAMPIONSHIP_ROAD_PRESETS = {
  flat: "Plaine",
  flat_hilly: "Plaine / Vallonné",
  hilly: "Vallonné",
  cobbles: "Pavés",
  hilly_cobbles: "Pavé / Vallonné",
  mountain: "Montagne",
} as const;

export type NationalChampionshipRoadPreset = keyof typeof NATIONAL_CHAMPIONSHIP_ROAD_PRESETS;

export function isNationalChampionshipRoadPreset(value: unknown): value is NationalChampionshipRoadPreset {
  return typeof value === "string" && Object.hasOwn(NATIONAL_CHAMPIONSHIP_ROAD_PRESETS, value);
}

export type NationalChampionshipRouteChoice = {
  countryCode: string;
  targetGameYear: number;
  currentPreset: NationalChampionshipRoadPreset;
  nextPreset: NationalChampionshipRoadPreset | null;
  opensOn: string;
  closesOn: string;
  window: "upcoming" | "open" | "closed";
  viewerIsPresident: boolean;
  presets: Record<NationalChampionshipRoadPreset, RaceStageSegment[]>;
};
