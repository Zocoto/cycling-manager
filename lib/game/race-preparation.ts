import {
  isInternationalChampionshipEdition,
  type RaceCalendarEdition,
  type RaceCalendarStage,
} from "@/lib/game/race-calendar";

const TIME_TRIAL_STAGE_TYPES = new Set<RaceCalendarStage["stageType"]>([
  "individual_time_trial",
  "team_time_trial",
  "prologue",
]);

export function isTimeTrialPreparationStage(
  stage: Pick<RaceCalendarStage, "stageType">,
) {
  return TIME_TRIAL_STAGE_TYPES.has(stage.stageType);
}

export function isRacePreparationStageAvailable({
  edition,
  allowInternational = false,
}: {
  edition: Pick<RaceCalendarEdition, "competitionType">;
  stage: Pick<RaceCalendarStage, "stageType">;
  allowInternational?: boolean;
}) {
  return Boolean(
    allowInternational ||
      (!isInternationalChampionshipEdition(edition) &&
        edition.competitionType !== "nations_cup"),
  );
}

export function isRaceStagePreparationPending({
  edition,
  stage,
  plan,
  scheduled,
  allowInternational = false,
}: {
  edition: Pick<RaceCalendarEdition, "competitionType">;
  stage: Pick<RaceCalendarStage, "stageType">;
  plan:
    | { updatedAt: string | null; timeTrialUpdatedAt: string | null }
    | undefined;
  scheduled: boolean;
  allowInternational?: boolean;
}) {
  if (
    !scheduled ||
    !isRacePreparationStageAvailable({
      edition,
      stage,
      allowInternational,
    })
  ) {
    return false;
  }

  return isTimeTrialPreparationStage(stage)
    ? !plan?.timeTrialUpdatedAt
    : !plan?.updatedAt;
}
