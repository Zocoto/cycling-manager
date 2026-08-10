import type { RaceCalendarStage } from "@/lib/game/race-calendar";

type DatedRacePreparationEdition = {
  name: string;
  stages: Array<
    Pick<RaceCalendarStage, "dayNumber" | "departureAt" | "stageNumber">
  >;
};

export function compareRacePreparationEditionsByDate(
  first: DatedRacePreparationEdition,
  second: DatedRacePreparationEdition,
) {
  const firstStart = getRacePreparationStart(first.stages);
  const secondStart = getRacePreparationStart(second.stages);

  return (
    firstStart.dayNumber - secondStart.dayNumber ||
    firstStart.departureTimestamp - secondStart.departureTimestamp ||
    first.name.localeCompare(second.name, "fr")
  );
}

function getRacePreparationStart(
  stages: DatedRacePreparationEdition["stages"],
) {
  const firstStage = [...stages].sort(
    (first, second) =>
      first.dayNumber - second.dayNumber ||
      first.stageNumber - second.stageNumber,
  )[0];
  const parsedDeparture = firstStage?.departureAt
    ? Date.parse(firstStage.departureAt)
    : Number.NaN;

  return {
    dayNumber: firstStage?.dayNumber ?? Number.MAX_SAFE_INTEGER,
    departureTimestamp: Number.isFinite(parsedDeparture)
      ? parsedDeparture
      : Number.MAX_SAFE_INTEGER,
  };
}
