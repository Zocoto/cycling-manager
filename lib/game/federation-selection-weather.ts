import type { RaceProfileType, RaceStageType } from "./race-calendar";
import type { RaceStageSegment } from "./race-profiles";
import {
  getRaceStageWeatherSeed,
  getRaceWeather,
  type RaceWeather,
} from "./race-weather";

export type FederationSelectionForecast = {
  slotKey: string;
  gameYear: number;
  eventDayNumber: number;
  revealDayNumber: number;
  isVisible: boolean;
  isOfficialCourse: boolean;
  weather: RaceWeather | null;
  course?: FederationSelectionCourse | null;
};

export type FederationSelectionCourse = {
  raceEditionId: string;
  stageId: string;
  stageName: string;
  stageType: RaceStageType;
  profileType: RaceProfileType;
  countryCode: string;
  countryName: string;
  distanceKm: number;
  dayNumber: number;
  segments: RaceStageSegment[];
  href: string;
};

export type FederationSelectionWeatherSlot = {
  slotKey: string;
  competitionCode: string;
  riderCategory: "professional" | "junior";
  profileLabel: string;
  hostCountryCode: string;
  dayNumber: number;
};

export type FederationSelectionOfficialStage = {
  raceEditionId: string;
  stageId: string;
  countryCode: string;
  profileType: RaceProfileType;
  course?: FederationSelectionCourse;
};

export function getFederationSelectionForecast({
  slot,
  gameYear,
  currentGameYear,
  currentDayNumber,
  officialStage,
}: {
  slot: FederationSelectionWeatherSlot;
  gameYear: number;
  currentGameYear: number;
  currentDayNumber: number;
  officialStage?: FederationSelectionOfficialStage | null;
}): FederationSelectionForecast {
  const eventDayNumber = officialStage?.course?.dayNumber ?? slot.dayNumber;
  const revealDayNumber = Math.max(
    1,
    eventDayNumber - getFederationSelectionCallUpLeadDays(slot),
  );
  const isVisible =
    currentGameYear === gameYear && currentDayNumber >= revealDayNumber;
  const raceEditionId =
    officialStage?.raceEditionId ?? `federation-selection:${slot.slotKey}`;
  const stageId = officialStage?.stageId ?? slot.slotKey;

  return {
    slotKey: slot.slotKey,
    gameYear,
    eventDayNumber,
    revealDayNumber,
    isVisible,
    isOfficialCourse: Boolean(officialStage),
    course: officialStage?.course ?? null,
    weather: isVisible
      ? getRaceWeather(
          getRaceStageWeatherSeed({
            seasonGameYear: gameYear,
            raceEditionId,
            stageId,
          }),
          {
            countryCode:
              officialStage?.countryCode ?? slot.hostCountryCode,
            profileType:
              officialStage?.profileType ??
              getFederationSelectionProfileType(slot.profileLabel),
          },
        )
      : null,
  };
}

export function getFederationSelectionCallUpLeadDays(
  slot: Pick<
    FederationSelectionWeatherSlot,
    "competitionCode" | "riderCategory"
  >,
) {
  if (slot.riderCategory === "junior") return 3;
  if (slot.competitionCode === "world_championship") return 4;
  return 1;
}

export function getFederationSelectionProfileType(
  profileLabel: string,
): RaceProfileType {
  const normalized = profileLabel.trim().toLocaleLowerCase("fr");
  if (normalized.includes("montagne")) return "mountain";
  if (normalized.includes("vallon")) return "hilly";
  if (normalized.includes("sprint")) return "sprint";
  if (normalized.includes("pav")) return "cobbles";
  if (normalized.includes("chrono")) return "time_trial";
  return "mixed";
}
