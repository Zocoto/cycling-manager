export type SalaryRiderRatings = Record<"mountain" | "hills" | "flat" | "time_trial" | "cobbles" | "sprint" | "acceleration" | "downhill" | "endurance" | "resistance" | "recovery" | "breakaway" | "prologue", number>;

export function getRiderSalaryProfileScore(r: SalaryRiderRatings): number {
  const overall = (r.mountain + r.hills + r.flat + r.time_trial + r.cobbles + r.sprint + r.acceleration + r.downhill + r.endurance + r.resistance + r.recovery + r.breakaway + r.prologue) / 13;
  const profiles = [
    .55 * r.mountain + .2 * r.endurance + .15 * r.resistance + .1 * r.recovery,
    .55 * r.hills + .2 * r.acceleration + .15 * r.resistance + .1 * r.endurance,
    .65 * r.sprint + .2 * r.acceleration + .15 * r.flat,
    .6 * r.cobbles + .2 * r.flat + .1 * r.resistance + .1 * r.endurance,
    .65 * r.time_trial + .15 * r.flat + .1 * r.resistance + .1 * r.endurance,
    .35 * r.flat + .3 * r.endurance + .2 * r.resistance + .15 * r.recovery,
  ];
  return Math.min(100, Math.max(0, .7 * Math.max(...profiles) + .3 * overall));
}

export function getRiderSalaryResultMultiplier(percentile: number | null | undefined, points = 0): number {
  if (percentile == null) return 1;
  if (points >= 1000 && percentile >= .99) return 1.25;
  if (points >= 300 && percentile >= .95) return 1.15;
  if (points >= 100 && percentile >= .85) return 1.1;
  if (points >= 25 && percentile >= .7) return 1.05;
  return 1;
}

export const RIDER_PROFILE_SALARY_KNOTS = [
  { overall: 0, salary: 6000 }, { overall: 45, salary: 6000 },
  { overall: 50, salary: 6500 }, { overall: 55, salary: 7500 },
  { overall: 60, salary: 9000 }, { overall: 65, salary: 12500 },
  { overall: 70, salary: 18500 }, { overall: 75, salary: 28000 },
  { overall: 80, salary: 45000 }, { overall: 85, salary: 90000 },
  { overall: 90, salary: 160000 }, { overall: 95, salary: 240000 },
  { overall: 100, salary: 320000 },
] as const;
