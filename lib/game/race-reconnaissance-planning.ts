import {
  RECOGNITION_CAMP_DURATION_DAYS,
  validateRecognitionCampSchedule,
} from "@/lib/game/training";

export type RecognitionPlanningUnavailability = {
  startDayNumber: number;
  endDayNumber: number;
  reason: string;
};

export type RecognitionPlanningRider = {
  id: string;
  firstName: string;
  lastName: string;
  unavailabilities: RecognitionPlanningUnavailability[];
};

export type RecognitionPlanningStage = {
  dayNumber: number;
  editionStartDayNumber: number;
  editionEndDayNumber: number;
};

export type RecognitionPlanningSeasonDay = {
  dayNumber: number;
  calendarDate: string;
};

export function getUpcomingRecognitionDays({
  seasonDays,
  currentDayNumber,
}: {
  seasonDays: RecognitionPlanningSeasonDay[];
  currentDayNumber: number;
}) {
  return seasonDays.filter((day) => day.dayNumber > currentDayNumber);
}

export function getRecognitionDateCandidates({
  stage,
  currentDayNumber,
  seasonDays,
  riders,
}: {
  stage: RecognitionPlanningStage;
  currentDayNumber: number;
  seasonDays: RecognitionPlanningSeasonDay[];
  riders: RecognitionPlanningRider[];
}) {
  return getUpcomingRecognitionDays({
    seasonDays,
    currentDayNumber,
  })
    .filter(
      (day) =>
        day.dayNumber + RECOGNITION_CAMP_DURATION_DAYS - 1 <
        stage.dayNumber,
    )
    .map((day) => {
      const endDayNumber =
        day.dayNumber + RECOGNITION_CAMP_DURATION_DAYS - 1;
      const scheduleValidation = validateRecognitionCampSchedule({
        currentDayNumber,
        startDayNumber: day.dayNumber,
        targetStageDayNumber: stage.dayNumber,
        targetEditionStartDayNumber: stage.editionStartDayNumber,
        targetEditionEndDayNumber: stage.editionEndDayNumber,
      });
      const riderConflicts = riders.flatMap((rider) => {
        const unavailability = findRiderUnavailability(
          rider,
          day.dayNumber,
          endDayNumber,
        );

        return unavailability
          ? [
              {
                riderId: rider.id,
                riderName: `${rider.firstName} ${rider.lastName}`,
                reason: unavailability.reason,
              },
            ]
          : [];
      });

      return {
        ...day,
        endDayNumber,
        scheduleValidation,
        riderConflicts,
        available: scheduleValidation.valid && riderConflicts.length === 0,
      };
    });
}

export function findRiderUnavailability(
  rider: Pick<RecognitionPlanningRider, "unavailabilities">,
  startDayNumber: number,
  endDayNumber: number,
) {
  return (
    rider.unavailabilities.find(
      (unavailability) =>
        unavailability.startDayNumber <= endDayNumber &&
        unavailability.endDayNumber >= startDayNumber,
    ) ?? null
  );
}
