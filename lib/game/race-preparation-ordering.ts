import type { RaceCalendarEdition, RaceCalendarStage } from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import { isRaceStagePreparationPending } from "@/lib/game/race-preparation";

export function getNextPendingPreparationTarget(
  editions: readonly RaceCalendarEdition[],
  plans: ReadonlyMap<string, { stages: Record<string, { updatedAt: string | null; timeTrialUpdatedAt: string | null }> }>,
  now: Date,
) {
  const candidates = editions.filter(edition => plans.has(edition.id)).flatMap(edition => edition.stages.flatMap(stage =>
    isRaceStagePreparationPending({ edition, stage, plan: plans.get(edition.id)?.stages[stage.id], scheduled: getStageLiveState(stage, now).status === "scheduled" })
      ? [{ slug: edition.slug, stageNumber: stage.stageNumber, dayNumber: stage.dayNumber, slot: stage.daySlot, departureAt: stage.departureAt }]
      : []));
  candidates.sort((a, b) => departureTimestamp(a.departureAt) - departureTimestamp(b.departureAt) || a.dayNumber - b.dayNumber || (a.slot === "late" ? 1 : 0) - (b.slot === "late" ? 1 : 0) || a.slug.localeCompare(b.slug) || a.stageNumber - b.stageNumber);
  return candidates[0] ?? null;
}

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
