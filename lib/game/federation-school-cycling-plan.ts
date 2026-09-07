export const SCHOOL_CYCLING_PLAN_REQUIRED_ACADEMY_LEVEL = 2;
export const SCHOOL_CYCLING_PLAN_COST = 1_500_000;
export const SCHOOL_CYCLING_PLAN_DURATION_DAYS = 56;
export const SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS = [3, 6, 10] as const;

export type SchoolCyclingPlanTransferPoints =
  (typeof SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS)[number] | 0;

export function getSchoolCyclingPlanDeliveryGameYear(
  completesGameDayIndex: number,
): number {
  return Math.max(1, Math.floor(Math.max(0, completesGameDayIndex) / 28));
}

export function getSchoolCyclingPlanTransferPoints({
  completesGameDayIndex,
  currentGameDayIndex,
  currentGameYear,
}: {
  completesGameDayIndex: number;
  currentGameDayIndex: number;
  currentGameYear: number;
}): SchoolCyclingPlanTransferPoints {
  if (currentGameDayIndex < completesGameDayIndex) return 0;

  const deliveryGameYear = getSchoolCyclingPlanDeliveryGameYear(
    completesGameDayIndex,
  );
  const promotionIndex = Math.max(0, currentGameYear - deliveryGameYear);

  return SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS[
    Math.min(
      SCHOOL_CYCLING_PLAN_MATURITY_TRANSFERS.length - 1,
      promotionIndex,
    )
  ];
}
