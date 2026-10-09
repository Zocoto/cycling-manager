import type { RaceCalendarStage } from "@/lib/game/race-calendar";

type DatedRacePreparationEdition = {
  name: string;
  stages: Array<
    Pick<RaceCalendarStage, "dayNumber" | "departureAt" | "stageNumber">
  >;
};

type DatedRacePreparationNavigationEdition = {
  name: string;
  startDayNumber: number | null;
  startDepartureAt: string | null;
};

export function compareRacePreparationEditionsByDate(
  first: DatedRacePreparationEdition,
  second: DatedRacePreparationEdition,
) {
  const firstStart = getRacePreparationStart(first.stages);
  const secondStart = getRacePreparationStart(second.stages);

  return (
    firstStart.departureTimestamp - secondStart.departureTimestamp ||
    firstStart.dayNumber - secondStart.dayNumber ||
    first.name.localeCompare(second.name, "fr")
  );
}

export function compareRacePreparationNavigationEditionsByDate(
  first: DatedRacePreparationNavigationEdition,
  second: DatedRacePreparationNavigationEdition,
) {
  return (
    departureTimestamp(first.startDepartureAt) - departureTimestamp(second.startDepartureAt) ||
    (first.startDayNumber ?? Number.MAX_SAFE_INTEGER) - (second.startDayNumber ?? Number.MAX_SAFE_INTEGER) ||
    first.name.localeCompare(second.name, "fr")
  );
}

function departureTimestamp(value: string | null | undefined) {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function getRacePreparationStart(
  stages: DatedRacePreparationEdition["stages"],
) {
  const firstStage = [...stages].sort(
    (first, second) =>
      first.dayNumber - second.dayNumber ||
      first.stageNumber - second.stageNumber,
  )[0];
  return {
    dayNumber: firstStage?.dayNumber ?? Number.MAX_SAFE_INTEGER,
    departureTimestamp: departureTimestamp(firstStage?.departureAt),
  };
}
