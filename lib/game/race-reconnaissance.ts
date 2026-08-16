import {
  getRegistrationAvailability,
  type RaceCategoryCode,
  type RaceFormat,
  type RegistrationPolicy,
} from "./race-calendar";

export const RACE_RECONNAISSANCE_DURATION_DAYS = 2;
export const RACE_RECONNAISSANCE_BASE_BONUS = 2;

const RECONNAISSANCE_COSTS: Record<
  RaceCategoryCode,
  Record<RaceFormat, number>
> = {
  elite: {
    one_day: 20_000,
    stage_race: 15_000,
  },
  world: {
    one_day: 12_000,
    stage_race: 9_000,
  },
  continental: {
    one_day: 7_000,
    stage_race: 5_000,
  },
  national: {
    one_day: 4_000,
    stage_race: 3_000,
  },
  regional: {
    one_day: 2_500,
    stage_race: 2_000,
  },
};

export function getRaceReconnaissanceCost({
  categoryCode,
  raceFormat,
}: {
  categoryCode: RaceCategoryCode;
  raceFormat: RaceFormat;
}) {
  return RECONNAISSANCE_COSTS[categoryCode][raceFormat];
}

export function getRacePreparerBonusPercentage(level: number) {
  const safeLevel = Math.min(
    5,
    Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)),
  );

  return safeLevel * 5;
}

export function getRaceReconnaissanceBonus(level?: number | null) {
  const preparerBonusPercentage = getRacePreparerBonusPercentage(level ?? 0);

  return (
    Math.round(
      RACE_RECONNAISSANCE_BASE_BONUS *
        (1 + preparerBonusPercentage / 100) *
        100,
    ) / 100
  );
}

export function canTeamRecognizeRace({
  registrationStatus,
  registrationPolicy,
  registrationClosesAt,
  minimumReputation,
  reputationPoints,
  now = new Date(),
}: {
  registrationStatus: string | null;
  registrationPolicy: RegistrationPolicy;
  registrationClosesAt: string | null;
  minimumReputation: number | null;
  reputationPoints: number;
  now?: Date;
}) {
  if (
    registrationStatus === "accepted" ||
    registrationStatus === "pending"
  ) {
    return true;
  }

  if (
    registrationStatus === "rejected" ||
    registrationStatus === "withdrawn"
  ) {
    return false;
  }

  return (
    getRegistrationAvailability({
      policy: registrationPolicy,
      closesAt: registrationClosesAt,
      minimumReputation,
      reputationPoints,
      now,
    }) === "open"
  );
}
