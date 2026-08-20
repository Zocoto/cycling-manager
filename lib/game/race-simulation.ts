import type { RaceSegmentPrime, RaceStageSegment } from "./race-profiles";
import type { RaceProfileType } from "./race-calendar";
import type {
  StageRaceJerseyType,
  StageRaceJerseyVisual,
} from "./stage-race-jerseys";
import type {
  ContinentalChampionshipCode,
  RiderJerseyAppearance,
} from "@/lib/rider-jersey";
import {
  MAX_RACE_ATTACK_ORDERS,
  type RaceAttackOrder,
  type RaceTeamStrategy,
  type RiderRaceDuty,
} from "./race-strategy";
import {
  applyEquipmentRatingBonuses,
  type EquipmentEffects,
} from "./equipment";
import {
  DEFAULT_TIME_TRIAL_RIDER_PLAN,
  TIME_TRIAL_EFFORT_EFFECTS,
  isTimeTrialEffortMode,
  type TimeTrialRiderPlan,
} from "./time-trial-preparation";
import { getRiderExperienceRaceBonus } from "./rider-experience";
import {
  hasSpecialAbility,
  type RiderSpecialAbility,
} from "./special-abilities";
import {
  resolveCrashMedicalOutcome,
  type RiderInjuryDiagnosisCode,
} from "./health-center";
import {
  applyRaceWeatherRatingAdjustments,
  getRiderClimateProfile,
  getRaceCrosswindIncidentRisk,
  getRaceWeatherCrashRiskBonus,
  getRaceWeather,
  type RaceWeather,
  type RiderClimateProfile,
} from "./race-weather";

export {
  RIDER_SPECIAL_ABILITIES,
  type RiderSpecialAbility,
} from "./special-abilities";

export const RACE_ROLES = [
  "auto",
  "leader",
  "sprinter",
  "leadout",
  "free_agent",
  "domestique",
  "mountain_classification",
] as const;

export type RaceRole = (typeof RACE_ROLES)[number];

export const RACE_ROLE_LABELS: Record<RaceRole, string> = {
  auto: "Automatique",
  leader: "Leader",
  sprinter: "Sprinteur",
  leadout: "Poisson pilote",
  free_agent: "Électron libre",
  domestique: "Équipier",
  mountain_classification: "Classement montagne",
};

export type SimulationStageType =
  "road" | "individual_time_trial" | "team_time_trial" | "prologue";

export type RiderSimulationRatings = {
  flat: number;
  mountain: number;
  hills: number;
  cobbles: number;
  downhill: number;
  sprint: number;
  acceleration: number;
  timeTrial: number;
  prologue: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
};

export type RiderNationalChampionship = {
  countryCode: string;
  championshipType: "road" | "time_trial";
};
export type RiderWorldChampionship = {
  championshipType: "road" | "time_trial";
};
export type RiderContinentalChampionship = {
  continentCode: ContinentalChampionshipCode;
  championshipType: "road" | "time_trial";
};

export type RiderSimulationInput = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  teamJersey?: RiderJerseyAppearance;
  avatarProfileKey?: string | null;
  avatarSeed?: number | string | null;
  nationalChampionships?: Partial<
    Record<
      RiderNationalChampionship["championshipType"],
      RiderNationalChampionship
    >
  >;
  activeNationalChampion?: RiderNationalChampionship | null;
  worldChampionships?: Partial<
    Record<RiderWorldChampionship["championshipType"], RiderWorldChampionship>
  >;
  activeWorldChampion?: RiderWorldChampionship | null;
  continentalChampionships?: Partial<
    Record<
      RiderContinentalChampionship["championshipType"],
      RiderContinentalChampionship
    >
  >;
  activeContinentalChampion?: RiderContinentalChampionship | null;
  classificationJersey?: StageRaceJerseyType | null;
  classificationJerseyVisual?: StageRaceJerseyVisual | null;
  age: number;
  form: number;
  careerRaceDays?: number;
  countryCode?: string | null;
  climateProfile?: RiderClimateProfile;
  localRaceBonus?: number;
  localRaceCountryCodes?: string[];
  reconnaissanceBonus?: number;
  performancePreparations?: Array<{
    type: "indoor_track" | "wind_tunnel";
    bonusStartGameDay: number;
    bonusEndGameDay: number;
    ratingBonus: number;
  }>;
  role: RaceRole;
  raceDuty?: RiderRaceDuty | null;
  mountainPointsTarget?: boolean;
  specialAbility?: RiderSpecialAbility | null;
  specialAbilities?: RiderSpecialAbility[];
  ratings: RiderSimulationRatings;
  equipmentEffects?: EquipmentEffects;
  equipmentEffectsByStageId?: Record<string, EquipmentEffects>;
  mechanicalIncidentTimeReductionPct?: number;
};

export type StageSimulationInput = {
  id: string;
  name: string;
  stageType: SimulationStageType;
  profileType: RaceProfileType;
  raceCountryCode?: string | null;
  gameDayIndex?: number;
  isStageRace: boolean;
  seed: string | number;
  weather?: RaceWeather;
  segments: RaceStageSegment[];
  riders: RiderSimulationInput[];
  unavailableRiderIds?: string[];
  generalClassification?: Array<{
    riderId: string;
    elapsedTimeSeconds: number;
  }>;
  mountainObjectiveRiderIds?: Record<string, string>;
  teamStrategies?: RaceTeamStrategy[];
  timeTrialPlans?: Record<string, TimeTrialRiderPlan>;
};

export type RaceGroupSnapshot = {
  id: string;
  label: string;
  type: "breakaway" | "chase" | "peloton" | "dropped" | "time_trial";
  riderIds: string[];
  gapToLeaderSeconds: number;
  elapsedTimeSeconds?: number;
  averageEnergy: number;
};

export const RACE_INCIDENT_TYPES = [
  "puncture",
  "crosswind",
  "crash_individual",
  "crash_mass",
] as const;

export type RaceIncidentType = (typeof RACE_INCIDENT_TYPES)[number];

export type RaceIncident = {
  id: string;
  type: RaceIncidentType;
  riderIds: string[];
  abandonedRiderIds: string[];
  label: string;
};

export const RACE_INJURY_SEVERITIES = ["minor", "moderate", "serious"] as const;

export type RaceInjurySeverity = (typeof RACE_INJURY_SEVERITIES)[number];

export type RaceInjury = {
  riderId: string;
  segmentNumber: number;
  type: "fracture";
  diagnosisCode: RiderInjuryDiagnosisCode;
  label: string;
  severity: RaceInjurySeverity;
  recoveryHours: number;
  recoveryDays: number;
};

export type RaceAbandonment = {
  riderId: string;
  segmentNumber: number;
  reason: "crash";
  injury: Omit<RaceInjury, "riderId" | "segmentNumber">;
};

export type RaceTimelineSnapshot = {
  segmentNumber: number;
  completedDistanceKm: number;
  groups: RaceGroupSnapshot[];
  incidents: RaceIncident[];
  abandonments: RaceAbandonment[];
  commentary: string[];
};

export type RacePrimeResult = {
  segmentNumber: number;
  prime: RaceSegmentPrime;
  classification: Array<{
    riderId: string;
    rank: number;
    points: number;
  }>;
};

export type StageSimulationResult = {
  stageId: string;
  seed: string;
  resolvedRiders: RiderSimulationInput[];
  timeline: RaceTimelineSnapshot[];
  results: Array<{
    riderId: string;
    rank: number | null;
    status: "finished" | "did_not_finish" | "outside_time_limit";
    elapsedTimeSeconds: number;
    gapToWinnerSeconds: number;
    energyAfter: number;
    injury: RaceInjury | null;
    abandonment: RaceAbandonment | null;
  }>;
  primes: RacePrimeResult[];
  mountainPoints: Record<string, number>;
  sprintPoints: Record<string, number>;
};

export type StageAttackParticipant = {
  riderId: string;
  participationType: "breakaway" | "chase";
  firstSegmentNumber: number;
};

export function getStageAttackParticipants(
  simulation: StageSimulationResult,
): StageAttackParticipant[] {
  const participantByRiderId = new Map<string, StageAttackParticipant>();

  for (const snapshot of simulation.timeline) {
    for (const group of snapshot.groups) {
      if (group.type !== "breakaway" && group.type !== "chase") continue;

      for (const riderId of group.riderIds) {
        const existing = participantByRiderId.get(riderId);
        const participationType =
          existing?.participationType === "breakaway" ||
          group.type === "breakaway"
            ? "breakaway"
            : "chase";
        participantByRiderId.set(riderId, {
          riderId,
          participationType,
          firstSegmentNumber: Math.min(
            existing?.firstSegmentNumber ?? snapshot.segmentNumber,
            snapshot.segmentNumber,
          ),
        });
      }
    }
  }

  return [...participantByRiderId.values()].sort(
    (left, right) =>
      left.firstSegmentNumber - right.firstSegmentNumber ||
      left.riderId.localeCompare(right.riderId),
  );
}

export type StageRaceStandings = {
  general: Array<{
    riderId: string;
    elapsedTimeSeconds: number;
  }>;
  mountain: Array<{ riderId: string; points: number }>;
  sprint: Array<{ riderId: string; points: number }>;
  youth: Array<{ riderId: string; elapsedTimeSeconds: number }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    elapsedTimeSeconds: number;
  }>;
};

export const FINAL_BATTLE_MAX_VISIBLE_RIDERS = 15;

export type FinalBattleScenario = {
  contenderIds: string[];
  decisiveContenderIds: string[];
  droppedRiderIds: string[];
  entryLeaderIds: string[];
  entryGroupLabel: string;
  entryGroups: Array<{
    id: string;
    label: string;
    gapToLeaderSeconds: number;
    riderIds: string[];
  }>;
  lateJoiners: Array<{
    riderId: string;
    fromGroupLabel: string;
    gapToLeaderSeconds: number;
  }>;
};

export function getFinalBattleRiderIds(simulation: StageSimulationResult) {
  return getFinalBattleScenario(simulation).contenderIds;
}

export function getLeadingFinishGroupRiderIds(
  simulation: StageSimulationResult,
) {
  const finalSnapshot = simulation.timeline.at(-1);
  if (!finalSnapshot) return [];

  const eligibleGroups = finalSnapshot.groups.filter(
    (group) => group.type !== "dropped" && group.type !== "time_trial",
  );
  if (eligibleGroups.length === 0) return [];

  const leadingGap = Math.min(
    ...eligibleGroups.map((group) => group.gapToLeaderSeconds),
  );
  return eligibleGroups
    .filter((group) => group.gapToLeaderSeconds === leadingGap)
    .flatMap((group) => group.riderIds);
}

export function isMassGroupFinish(
  simulation: StageSimulationResult,
  minimumGroupSize = 10,
) {
  const scenario = getFinalBattleScenario(simulation);
  const entrySnapshot =
    simulation.timeline.at(-2) ?? simulation.timeline.at(-1);
  if (!entrySnapshot) return false;

  const eligibleGroups = entrySnapshot.groups.filter(
    (group) => group.type !== "dropped" && group.type !== "time_trial",
  );
  const leadingGap = Math.min(
    ...eligibleGroups.map((group) => group.gapToLeaderSeconds),
  );
  const leadingGroups = eligibleGroups.filter(
    (group) => group.gapToLeaderSeconds === leadingGap,
  );
  const hasAttackAtTheFront = leadingGroups.some(
    (group) => group.type === "breakaway" || group.type === "chase",
  );
  const leadingFinishGroupRiderIds = getLeadingFinishGroupRiderIds(simulation);

  return (
    Number.isFinite(leadingGap) &&
    !hasAttackAtTheFront &&
    scenario.lateJoiners.length === 0 &&
    scenario.entryLeaderIds.length >= minimumGroupSize &&
    scenario.decisiveContenderIds.length >= minimumGroupSize &&
    leadingFinishGroupRiderIds.length >= minimumGroupSize
  );
}

export function getFinalBattleScenario(
  simulation: StageSimulationResult,
): FinalBattleScenario {
  const finalSnapshot = simulation.timeline.at(-1);
  const entrySnapshot = simulation.timeline.at(-2) ?? finalSnapshot;
  const orderedFinishers = simulation.results
    .filter(
      (result): result is typeof result & { rank: number } =>
        result.status === "finished" && result.rank !== null,
    )
    .sort((first, second) => first.rank - second.rank);
  const finisherIds = new Set(orderedFinishers.map((result) => result.riderId));
  const decisiveContenderIds = orderedFinishers
    .filter((result) => result.gapToWinnerSeconds === 0)
    .map((result) => result.riderId);

  if (!entrySnapshot || orderedFinishers.length === 0) {
    const contenderIds = (
      decisiveContenderIds.length > 0
        ? decisiveContenderIds
        : orderedFinishers.slice(0, 8).map((result) => result.riderId)
    ).slice(0, FINAL_BATTLE_MAX_VISIBLE_RIDERS);
    return {
      contenderIds,
      decisiveContenderIds: contenderIds,
      droppedRiderIds: [],
      entryLeaderIds: contenderIds,
      entryGroupLabel: "Groupe de tête",
      entryGroups: [
        {
          id: "fallback-leading-group",
          label: "Groupe de tête",
          gapToLeaderSeconds: 0,
          riderIds: contenderIds,
        },
      ],
      lateJoiners: [],
    };
  }

  const eligibleEntryGroups = entrySnapshot.groups.filter(
    (group) => group.type !== "dropped" && group.type !== "time_trial",
  );
  const leadingGap =
    eligibleEntryGroups.length > 0
      ? Math.min(
          ...eligibleEntryGroups.map((group) => group.gapToLeaderSeconds),
        )
      : 0;
  const leadingGroups = eligibleEntryGroups.filter(
    (group) => group.gapToLeaderSeconds === leadingGap,
  );
  const rankByRiderId = new Map(
    orderedFinishers.map((result) => [result.riderId, result.rank]),
  );
  const maximumVisibleRiders = FINAL_BATTLE_MAX_VISIBLE_RIDERS;
  const selectedEntryRiderIds: string[] = [];
  for (const group of [...eligibleEntryGroups].sort(
    (first, second) => first.gapToLeaderSeconds - second.gapToLeaderSeconds,
  )) {
    const groupFinishers = group.riderIds
      .filter((riderId) => finisherIds.has(riderId))
      .sort(
        (first, second) =>
          (rankByRiderId.get(first) ?? 999) -
          (rankByRiderId.get(second) ?? 999),
      );
    selectedEntryRiderIds.push(
      ...groupFinishers.slice(
        0,
        Math.max(0, maximumVisibleRiders - selectedEntryRiderIds.length),
      ),
    );
    if (selectedEntryRiderIds.length >= maximumVisibleRiders) break;
  }

  const candidateRiderIds = new Set([
    ...selectedEntryRiderIds,
    ...decisiveContenderIds,
  ]);
  const contenderIds = orderedFinishers
    .filter((result) => candidateRiderIds.has(result.riderId))
    .slice(0, maximumVisibleRiders)
    .map((result) => result.riderId);
  const contenderSet = new Set(contenderIds);
  const entryLeaderSet = new Set(
    leadingGroups
      .flatMap((group) => group.riderIds)
      .filter((riderId) => contenderSet.has(riderId)),
  );
  const entryGroups = [...eligibleEntryGroups]
    .sort(
      (first, second) => first.gapToLeaderSeconds - second.gapToLeaderSeconds,
    )
    .map((group) => ({
      id: group.id,
      label: group.label,
      gapToLeaderSeconds: Math.max(0, group.gapToLeaderSeconds - leadingGap),
      riderIds: group.riderIds
        .filter((riderId) => contenderSet.has(riderId))
        .sort(
          (first, second) =>
            (rankByRiderId.get(first) ?? 999) -
            (rankByRiderId.get(second) ?? 999),
        ),
    }))
    .filter((group) => group.riderIds.length > 0);
  const entryLeaderIds = contenderIds.filter((riderId) =>
    entryLeaderSet.has(riderId),
  );
  const decisiveContenderSet = new Set(decisiveContenderIds);
  const lateJoiners = decisiveContenderIds
    .filter(
      (riderId) => contenderSet.has(riderId) && !entryLeaderSet.has(riderId),
    )
    .map((riderId) => {
      const origin = eligibleEntryGroups.find((group) =>
        group.riderIds.includes(riderId),
      );

      return {
        riderId,
        fromGroupLabel: origin?.label ?? "Groupe intercalé",
        gapToLeaderSeconds: origin?.gapToLeaderSeconds ?? 0,
      };
    });

  return {
    contenderIds,
    decisiveContenderIds,
    droppedRiderIds: contenderIds.filter(
      (riderId) => !decisiveContenderSet.has(riderId),
    ),
    entryLeaderIds,
    entryGroupLabel: leadingGroups[0]?.label ?? "Groupe de tête",
    entryGroups,
    lateJoiners,
  };
}

type RiderState = {
  rider: RiderSimulationInput;
  energy: number;
  raceDayExecutionBonus: number;
  decisiveAttackBonus: number;
  injuryPerformancePenalty: number;
  elapsedTimeSeconds: number;
  group:
    | "breakaway"
    | "breakaway_2"
    | "chase"
    | "peloton"
    | "delayed"
    | "dropped"
    | "abandoned";
  groupSinceSegment: number;
  lostTimeSeconds: number;
};

const SCORE_NOISE = 3.2;
const SAME_TIME_MAX_GAP_SECONDS = 3;
const RACE_INJURY_PERFORMANCE_PENALTY = {
  minor: 2.5,
  moderate: 6,
  serious: 10,
} satisfies Record<RaceInjurySeverity, number>;
export const LARGE_BREAKAWAY_RIDER_THRESHOLD = 10;
export const LARGE_BREAKAWAY_EFFORT_MULTIPLIER = 2;
const LARGE_BREAKAWAY_MAXIMUM_SIZE = 14;
const LARGE_BREAKAWAY_PACE_PENALTY_PER_RIDER = 0.004;
const LARGE_BREAKAWAY_MAXIMUM_PACE_PENALTY = 0.035;

type StageFavoriteTier = "major" | "medium" | "none";

type StageTeamStrategy = {
  teamId: string;
  favoriteTier: StageFavoriteTier;
  protectedRiderIds: Set<string>;
};

type StageStrategyContext = {
  favoriteTierByTeamId: Map<string, StageFavoriteTier>;
  protectedRiderIds: Set<string>;
  controllingTeamIds: Set<string>;
  favoriteRankByRiderId: Map<string, number>;
  majorFavoriteCount: number;
  outsiderFavoriteCount: number;
};

export function getLargeBreakawayDynamics(riderCount: number) {
  const excessRiders = Math.max(
    0,
    Math.floor(riderCount) - LARGE_BREAKAWAY_RIDER_THRESHOLD,
  );

  return {
    effortMultiplier: excessRiders > 0 ? LARGE_BREAKAWAY_EFFORT_MULTIPLIER : 1,
    pacePenalty: Math.min(
      LARGE_BREAKAWAY_MAXIMUM_PACE_PENALTY,
      excessRiders * LARGE_BREAKAWAY_PACE_PENALTY_PER_RIDER,
    ),
  };
}

export type LargeBreakawayStandoffDecision =
  "peloton_gives_up" | "breakaway_gives_up" | null;

export function decideLargeBreakawayStandoff({
  breakawaySize,
  pelotonSize,
  completedDistanceKm,
  raceProgress,
  gapSeconds,
  breakawayAverageEnergy,
  pelotonAverageEnergy,
  chasePressure,
  likelyMassSprint,
  roll,
}: {
  breakawaySize: number;
  pelotonSize: number;
  completedDistanceKm: number;
  raceProgress: number;
  gapSeconds: number;
  breakawayAverageEnergy: number;
  pelotonAverageEnergy: number;
  chasePressure: number;
  likelyMassSprint: boolean;
  roll: number;
}): LargeBreakawayStandoffDecision {
  if (
    breakawaySize <= LARGE_BREAKAWAY_RIDER_THRESHOLD ||
    pelotonSize === 0 ||
    completedDistanceKm < 60 ||
    raceProgress < 0.45 ||
    gapSeconds <= 0
  ) {
    return null;
  }

  const breakawayFatigue = clamp((42 - breakawayAverageEnergy) / 28, 0, 1);
  const pelotonEnergyAdvantage = clamp(
    (pelotonAverageEnergy - breakawayAverageEnergy - 4) / 24,
    0,
    1,
  );
  const catchableGap = clamp((160 - gapSeconds) / 140, 0, 1);
  const sustainedPressure = clamp((chasePressure - 0.55) / 0.35, 0, 1);
  const breakawayYieldChance = clamp(
    breakawayFatigue * 0.42 +
      pelotonEnergyAdvantage * 0.25 +
      catchableGap * 0.18 +
      sustainedPressure * 0.15,
    0,
    0.72,
  );

  const pelotonFatigue = clamp((38 - pelotonAverageEnergy) / 24, 0, 1);
  const gapOutOfReach = clamp((gapSeconds - 90) / 260, 0, 1);
  const groupBurden = clamp(
    (breakawaySize - LARGE_BREAKAWAY_RIDER_THRESHOLD) / 8,
    0,
    1,
  );
  const breakawayEnergyAdvantage = clamp(
    (breakawayAverageEnergy - pelotonAverageEnergy - 4) / 24,
    0,
    1,
  );
  const pelotonYieldChance = clamp(
    pelotonFatigue * 0.38 +
      gapOutOfReach * 0.3 +
      groupBurden * 0.18 +
      breakawayEnergyAdvantage * 0.12 -
      (likelyMassSprint ? 0.24 : 0),
    0,
    0.68,
  );

  const normalizedRoll = clamp(roll, 0, 1);
  if (normalizedRoll < breakawayYieldChance) {
    return "breakaway_gives_up";
  }
  if (normalizedRoll > 1 - pelotonYieldChance) {
    return "peloton_gives_up";
  }
  return null;
}
export function areFinishersInSameTimeGroup(
  previousElapsedTimeSeconds: number,
  elapsedTimeSeconds: number,
) {
  const gapSeconds = elapsedTimeSeconds - previousElapsedTimeSeconds;
  return gapSeconds >= 0 && gapSeconds <= SAME_TIME_MAX_GAP_SECONDS;
}

/**
 * Moteur V1 : déterministe, sans dépendance à React ou Supabase. Cette
 * séparation permet de le tester, le rejouer et, plus tard, de l'exécuter
 * côté serveur au moment du départ officiel.
 */
export function reduceMechanicalIncidentTimeLoss(
  timeLossSeconds: number,
  reductionPercentage: number,
) {
  return (
    Math.max(0, timeLossSeconds) * (1 - clamp(reductionPercentage, 0, 80) / 100)
  );
}

export function getRaceInjuryInRaceImpact({
  energy,
  currentPenalty = 0,
  severity,
}: {
  energy: number;
  currentPenalty?: number;
  severity: RaceInjurySeverity;
}) {
  const performancePenalty = Math.max(
    currentPenalty,
    RACE_INJURY_PERFORMANCE_PENALTY[severity],
  );

  return {
    performancePenalty,
    energyAfter: clamp(
      energy - RACE_INJURY_PERFORMANCE_PENALTY[severity] * 0.75,
      0,
      100,
    ),
  };
}

export function getControlledRaceDayExecutionSwing({
  firstRoll,
  secondRoll,
  experienceRaceBonus,
}: {
  firstRoll: number;
  secondRoll: number;
  experienceRaceBonus: number;
}) {
  const centeredTriangularRoll =
    clamp(firstRoll, 0, 1) + clamp(secondRoll, 0, 1) - 1;
  const experienceRatio = clamp(experienceRaceBonus / 1.5, 0, 1);
  const rawSwing = centeredTriangularRoll * 5;
  const composedSwing =
    rawSwing < 0 ? rawSwing * (1 - experienceRatio * 0.24) : rawSwing;

  return round(clamp(composedSwing, -5, 5), 3);
}

export function simulateRaceStage(
  input: StageSimulationInput,
): StageSimulationResult {
  const normalizedInput = normalizeStageSimulationInput(input);

  let simulation: StageSimulationResult;

  if (
    normalizedInput.stageType === "individual_time_trial" ||
    normalizedInput.stageType === "prologue"
  ) {
    simulation = simulateIndividualTimeTrial(normalizedInput);
  } else if (normalizedInput.stageType === "team_time_trial") {
    simulation = simulateTeamTimeTrial(normalizedInput);
  } else {
    simulation = simulateRoadStage(normalizedInput);
  }

  return applyStageTimeLimit(simulation, normalizedInput);
}

/**
 * Produit uniquement un classement déterministe, sans chronologie, incidents,
 * primes intermédiaires ni replay. Ce moteur est réservé aux championnats
 * nationaux à partir de la saison 2 afin que tous les pays puissent être
 * résolus dans la même tâche serveur sans fabriquer de lourds JSON de live.
 */
export function simulateRaceStageResultsOnly(
  input: StageSimulationInput,
): StageSimulationResult {
  const normalizedInput = normalizeStageSimulationInput(input);
  const distanceKm = Math.max(
    1,
    normalizedInput.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
  );
  const averageSpeedKph =
    normalizedInput.segments.reduce(
      (total, segment) => total + getBaseSpeed(segment) * segment.distanceKm,
      0,
    ) / distanceKm;
  const winnerElapsedTimeSeconds = Math.max(
    1,
    Math.round((distanceKm / Math.max(1, averageSpeedKph)) * 3_600),
  );
  const isTimeTrial =
    normalizedInput.stageType === "individual_time_trial" ||
    normalizedInput.stageType === "team_time_trial" ||
    normalizedInput.stageType === "prologue";
  const scoredRiders = normalizedInput.riders
    .map((rider) => {
      const random = createSeededRandom(
        `${normalizedInput.seed}:${rider.id}:results-only`,
      );
      const performanceRating = isTimeTrial
        ? getResultsOnlyTimeTrialRating(rider, normalizedInput)
        : getResultsOnlyRoadRating(rider, normalizedInput);

      return {
        rider,
        score: performanceRating + (random() - 0.5) * (isTimeTrial ? 4 : 6),
      };
    })
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.rider.id.localeCompare(second.rider.id),
    );
  const winnerScore = scoredRiders[0]?.score ?? 0;
  const gapMultiplier = isTimeTrial
    ? 5.5
    : {
        flat: 0.55,
        sprint: 0.45,
        hilly: 4.5,
        mountain: 7.5,
        cobbles: 3.5,
        time_trial: 5.5,
        mixed: 4,
      }[normalizedInput.profileType];

  return {
    stageId: normalizedInput.id,
    seed: String(normalizedInput.seed),
    resolvedRiders: normalizedInput.riders,
    timeline: [],
    results: scoredRiders.map(({ rider, score }, index) => {
      const gapToWinnerSeconds =
        index === 0
          ? 0
          : Math.max(0, Math.round((winnerScore - score) * gapMultiplier));
      return {
        riderId: rider.id,
        rank: index + 1,
        status: "finished" as const,
        elapsedTimeSeconds: winnerElapsedTimeSeconds + gapToWinnerSeconds,
        gapToWinnerSeconds,
        energyAfter: round(clamp(rider.form - distanceKm / 6, 5, 100), 2),
        injury: null,
        abandonment: null,
      };
    }),
    primes: [],
    mountainPoints: {},
    sprintPoints: {},
  };
}

function normalizeStageSimulationInput(
  input: StageSimulationInput,
): StageSimulationInput {
  validateTimeTrialPlans(input);
  const weather =
    input.weather ??
    getRaceWeather(input.seed, {
      countryCode: input.raceCountryCode,
      profileType: input.profileType,
    });
  const unavailableRiderIds = new Set(input.unavailableRiderIds ?? []);
  const eligibleInput = {
    ...input,
    weather,
    riders: input.riders
      .filter((rider) => !unavailableRiderIds.has(rider.id))
      .map((rider) => {
        const preparationAdjustedRatings = applyPerformancePreparationBonuses(
          rider.ratings,
          rider.performancePreparations,
          input.gameDayIndex,
        );
        const equipmentAdjustedRatings = rider.equipmentEffects
          ? applyEquipmentRatingBonuses(
              preparationAdjustedRatings,
              rider.equipmentEffects,
              {
                isTimeTrial:
                  input.stageType === "individual_time_trial" ||
                  input.stageType === "team_time_trial" ||
                  input.stageType === "prologue",
              },
            )
          : preparationAdjustedRatings;
        const climateProfile =
          rider.climateProfile ??
          getRiderClimateProfile({
            riderId: rider.id,
            countryCode: rider.countryCode,
          });

        return {
          ...rider,
          climateProfile,
          localRaceBonus:
            input.raceCountryCode &&
            ((rider.countryCode &&
              rider.countryCode.toUpperCase() ===
                input.raceCountryCode.toUpperCase()) ||
              rider.localRaceCountryCodes?.some(
                (countryCode) =>
                  countryCode.toUpperCase() ===
                  input.raceCountryCode?.toUpperCase(),
              ))
              ? 2
              : 0,
          ratings: applyReconnaissanceRatingBonus(
            applyRaceWeatherRatingAdjustments(
              equipmentAdjustedRatings,
              weather,
              hasSpecialAbility(rider, "flahute"),
              climateProfile,
            ),
            rider.reconnaissanceBonus,
            equipmentAdjustedRatings,
          ),
        };
      }),
  };
  validateSimulationInput(eligibleInput);
  const resolvedRiders = assignAutomaticRaceRoles(
    eligibleInput.riders,
    eligibleInput.segments,
    eligibleInput.profileType,
  );
  const normalizedInput = {
    ...eligibleInput,
    riders: assignRaceObjectiveDuties({
      ...eligibleInput,
      riders: resolvedRiders,
    }),
  };

  return normalizedInput;
}

function getResultsOnlyTimeTrialRating(
  rider: RiderSimulationInput,
  input: StageSimulationInput,
) {
  const totalDistance = Math.max(
    1,
    input.segments.reduce((total, segment) => total + segment.distanceKm, 0),
  );
  return input.segments.reduce(
    (total, segment) =>
      total +
      getTimeTrialSegmentRating(rider, segment, input.stageType) *
        (segment.distanceKm / totalDistance),
    0,
  );
}

function getResultsOnlyRoadRating(
  rider: RiderSimulationInput,
  input: StageSimulationInput,
) {
  const finishRating =
    input.profileType === "flat" || input.profileType === "sprint"
      ? rider.ratings.sprint * 0.48 +
        rider.ratings.acceleration * 0.25 +
        rider.ratings.flat * 0.15 +
        rider.ratings.resistance * 0.12
      : input.profileType === "hilly"
        ? rider.ratings.hills * 0.45 +
          rider.ratings.acceleration * 0.22 +
          rider.ratings.resistance * 0.15 +
          rider.ratings.endurance * 0.1 +
          rider.ratings.sprint * 0.08
        : input.profileType === "mountain"
          ? rider.ratings.mountain * 0.5 +
            rider.ratings.hills * 0.16 +
            rider.ratings.endurance * 0.16 +
            rider.ratings.resistance * 0.1 +
            rider.ratings.acceleration * 0.08
          : input.profileType === "cobbles"
            ? rider.ratings.cobbles * 0.46 +
              rider.ratings.flat * 0.18 +
              rider.ratings.resistance * 0.16 +
              rider.ratings.endurance * 0.12 +
              rider.ratings.acceleration * 0.08
            : getDecisiveRoadFinishRating(rider, input.segments);

  return (
    getStageSuitability(rider, input.segments) * 0.72 + finishRating * 0.28
  );
}

export function getStageTimeLimitAllowanceSeconds({
  winnerElapsedTimeSeconds,
  profileType,
  stageType,
}: {
  winnerElapsedTimeSeconds: number;
  profileType: RaceProfileType;
  stageType: SimulationStageType;
}) {
  const isTimeTrial =
    stageType === "individual_time_trial" ||
    stageType === "team_time_trial" ||
    stageType === "prologue";
  const percentage = isTimeTrial
    ? 0.25
    : {
        flat: 0.12,
        sprint: 0.12,
        hilly: 0.16,
        mountain: 0.22,
        cobbles: 0.18,
        time_trial: 0.25,
        mixed: 0.18,
      }[profileType];
  const minimumAllowanceSeconds = isTimeTrial
    ? 12 * 60
    : {
        flat: 15 * 60,
        sprint: 15 * 60,
        hilly: 20 * 60,
        mountain: 35 * 60,
        cobbles: 25 * 60,
        time_trial: 12 * 60,
        mixed: 25 * 60,
      }[profileType];

  return Math.round(
    Math.max(
      minimumAllowanceSeconds,
      Math.max(0, winnerElapsedTimeSeconds) * percentage,
    ),
  );
}

export function applyStageTimeLimit(
  simulation: StageSimulationResult,
  input: Pick<StageSimulationInput, "profileType" | "stageType" | "segments">,
): StageSimulationResult {
  const finishers = simulation.results
    .filter((result) => result.status === "finished")
    .sort(
      (first, second) =>
        first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
        (first.rank ?? Number.MAX_SAFE_INTEGER) -
          (second.rank ?? Number.MAX_SAFE_INTEGER),
    );
  const winnerElapsedTimeSeconds = finishers[0]?.elapsedTimeSeconds;
  if (!winnerElapsedTimeSeconds || finishers.length <= 1) {
    return simulation;
  }

  const allowanceSeconds = getStageTimeLimitAllowanceSeconds({
    winnerElapsedTimeSeconds,
    profileType: input.profileType,
    stageType: input.stageType,
  });
  const timeLimitSeconds = winnerElapsedTimeSeconds + allowanceSeconds;
  const outsideTimeLimitRiderIds = new Set(
    finishers
      .filter((result) => result.elapsedTimeSeconds > timeLimitSeconds)
      .map((result) => result.riderId),
  );
  if (outsideTimeLimitRiderIds.size === 0) {
    return simulation;
  }

  const classifiedResults = finishers
    .filter((result) => !outsideTimeLimitRiderIds.has(result.riderId))
    .map((result, index) => ({
      ...result,
      rank: index + 1,
      gapToWinnerSeconds: Math.max(
        0,
        result.elapsedTimeSeconds - winnerElapsedTimeSeconds,
      ),
    }));
  const outsideTimeLimitResults = finishers
    .filter((result) => outsideTimeLimitRiderIds.has(result.riderId))
    .map((result) => ({
      ...result,
      rank: null,
      status: "outside_time_limit" as const,
      gapToWinnerSeconds: Math.max(
        0,
        result.elapsedTimeSeconds - winnerElapsedTimeSeconds,
      ),
    }));
  const otherNonFinishers = simulation.results.filter(
    (result) => result.status !== "finished",
  );
  const results: StageSimulationResult["results"] = [
    ...classifiedResults,
    ...outsideTimeLimitResults,
    ...otherNonFinishers,
  ];
  const primes = simulation.primes.map((primeResult) => ({
    ...primeResult,
    classification: primeResult.classification
      .filter((entry) => !outsideTimeLimitRiderIds.has(entry.riderId))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        points: primeResult.prime.pointsScale[index] ?? 0,
      }))
      .filter((entry) => entry.points > 0),
  }));
  const mountainPoints: Record<string, number> = {};
  const sprintPoints: Record<string, number> = {};
  for (const primeResult of primes) {
    const pointsByRiderId =
      primeResult.prime.type === "mountain" ? mountainPoints : sprintPoints;
    for (const entry of primeResult.classification) {
      pointsByRiderId[entry.riderId] =
        (pointsByRiderId[entry.riderId] ?? 0) + entry.points;
    }
  }
  if (input.stageType === "road") {
    awardFinishClassificationPoints({
      results,
      segments: input.segments,
      mountainPoints,
      sprintPoints,
    });
  }

  const finalSnapshot = simulation.timeline.at(-1);
  const timeline = finalSnapshot
    ? simulation.timeline.map((snapshot, index) => {
        if (index !== simulation.timeline.length - 1) return snapshot;
        const groups = snapshot.groups
          .map((group) => ({
            ...group,
            riderIds: group.riderIds.filter(
              (riderId) => !outsideTimeLimitRiderIds.has(riderId),
            ),
          }))
          .filter((group) => group.riderIds.length > 0);
        groups.push({
          id: `outside-time-limit-${[...outsideTimeLimitRiderIds]
            .sort()
            .join("-")}`,
          label: "Hors délais",
          type: "dropped",
          riderIds: [...outsideTimeLimitRiderIds],
          gapToLeaderSeconds: Math.min(
            ...outsideTimeLimitResults.map(
              (result) => result.gapToWinnerSeconds,
            ),
          ),
          averageEnergy: round(
            average(
              outsideTimeLimitResults.map((result) => result.energyAfter),
            ),
            1,
          ),
        });

        return {
          ...snapshot,
          groups: accumulateRaceGroupGapsFromLeader(groups),
          commentary: [
            ...snapshot.commentary,
            `${outsideTimeLimitRiderIds.size} coureur${
              outsideTimeLimitRiderIds.size > 1 ? "s terminent" : " termine"
            } hors délais et quitte${
              outsideTimeLimitRiderIds.size > 1 ? "nt" : ""
            } la course.`,
          ],
        };
      })
    : simulation.timeline;

  return {
    ...simulation,
    timeline,
    results,
    primes,
    mountainPoints,
    sprintPoints,
  };
}
function applyReconnaissanceRatingBonus(
  ratings: RiderSimulationRatings,
  bonus: number | null | undefined,
  ratingMaximums: RiderSimulationRatings,
): RiderSimulationRatings {
  const safeBonus = Number.isFinite(bonus) ? Math.max(0, bonus ?? 0) : 0;
  if (safeBonus === 0) return ratings;

  return Object.fromEntries(
    Object.entries(ratings).map(([key, value]) => [
      key,
      Math.min(
        Math.max(
          100,
          ratingMaximums[key as keyof RiderSimulationRatings],
        ),
        value + safeBonus,
      ),
    ]),
  ) as RiderSimulationRatings;
}

export function assignAutomaticRaceRoles(
  riders: RiderSimulationInput[],
  segments: RaceStageSegment[],
  profileType: RaceProfileType = "mixed",
) {
  validateExplicitRoles(riders);
  const resolved = riders.map((rider) => ({ ...rider }));
  const teams = groupBy(resolved, (rider) => rider.teamId);
  const likelySprint = isLikelyMassSprint(segments);

  for (const teamRiders of teams.values()) {
    const automatic = () => teamRiders.filter((rider) => rider.role === "auto");
    const hasRole = (role: RaceRole) =>
      teamRiders.some((rider) => rider.role === role);

    if (likelySprint && !hasRole("sprinter")) {
      setBestAutomaticRole(
        automatic(),
        "sprinter",
        (rider) =>
          rider.ratings.sprint * 0.62 +
          rider.ratings.acceleration * 0.25 +
          rider.ratings.flat * 0.13,
      );
    }

    if (!hasRole("leader")) {
      setBestAutomaticRole(automatic(), "leader", (rider) =>
        getAutomaticLeaderScore(rider, segments, profileType),
      );
    }

    if (likelySprint && !hasRole("leadout")) {
      setBestAutomaticRole(
        automatic(),
        "leadout",
        (rider) =>
          rider.ratings.flat * 0.34 +
          rider.ratings.sprint * 0.25 +
          rider.ratings.acceleration * 0.2 +
          rider.ratings.resistance * 0.21,
      );
    }

    if (!hasRole("free_agent")) {
      setBestAutomaticRole(
        automatic(),
        "free_agent",
        (rider) =>
          rider.ratings.breakaway * 0.56 +
          rider.ratings.acceleration * 0.24 +
          rider.ratings.endurance * 0.2,
      );
    }

    for (const rider of automatic()) {
      rider.role = "domestique";
    }
  }

  return resolved;
}

export function assignRaceObjectiveDuties(
  input: StageSimulationInput,
): RiderSimulationInput[] {
  const riders = input.riders.map((rider) => {
    const resolved = { ...rider };
    delete resolved.mountainPointsTarget;
    return resolved;
  });
  const ridersByTeamId = groupBy(riders, (rider) => rider.teamId);
  const strategiesByTeamId = new Map(
    (input.teamStrategies ?? []).map((strategy) => [strategy.teamId, strategy]),
  );
  const hasMountainPrime =
    input.isStageRace &&
    input.segments.some((segment) => segment.prime?.type === "mountain");
  const stageWinMode = getStageWinObjectiveMode(input.segments);

  for (const [teamId, teamRiders] of ridersByTeamId) {
    const strategy = strategiesByTeamId.get(teamId);
    if (!strategy) continue;

    if (strategy.objective === "mountain_points" && input.isStageRace) {
      const carriedRiderId = input.mountainObjectiveRiderIds?.[teamId];
      const target =
        findObjectiveCandidate(teamRiders, carriedRiderId) ??
        findObjectiveCandidate(teamRiders, strategy.breakawayRiderId) ??
        rankObjectiveCandidates(teamRiders, getMountainObjectiveScore, true)[0];

      if (target) {
        target.mountainPointsTarget = true;
        if (hasMountainPrime) target.raceDuty = "breakaway_candidate";
      }
      continue;
    }

    if (
      strategy.objective === "stage_win" &&
      (stageWinMode === "breakaway" ||
        strategy.breakawayPolicy === "target" ||
        strategy.breakawayRiderId !== null)
    ) {
      const target =
        findObjectiveCandidate(teamRiders, strategy.breakawayRiderId) ??
        rankObjectiveCandidates(teamRiders, (rider) =>
          getStageWinBreakawayScore(rider, input.segments),
        )[0];
      if (target) target.raceDuty = "breakaway_candidate";
    }
  }

  return riders;
}

export function getMountainObjectiveRiderIdsByTeam(
  riders: RiderSimulationInput[],
) {
  return Object.fromEntries(
    riders
      .filter((rider) => rider.mountainPointsTarget)
      .sort(
        (first, second) =>
          first.teamId.localeCompare(second.teamId) ||
          first.id.localeCompare(second.id),
      )
      .map((rider) => [rider.teamId, rider.id]),
  );
}

export function getStageWinObjectiveMode(
  segments: RaceStageSegment[],
): "sprint" | "breakaway" {
  return isLikelyMassSprint(segments) ? "sprint" : "breakaway";
}

function findObjectiveCandidate(
  riders: RiderSimulationInput[],
  riderId: string | null | undefined,
) {
  if (!riderId) return null;
  const rider = riders.find((candidate) => candidate.id === riderId) ?? null;
  return rider && isAvailableObjectiveCandidate(rider) ? rider : null;
}

function rankObjectiveCandidates(
  riders: RiderSimulationInput[],
  score: (rider: RiderSimulationInput) => number,
  preferMountainRole = false,
) {
  const candidates = riders.filter(isAvailableObjectiveCandidate);
  const roleCandidates = preferMountainRole
    ? candidates.filter((rider) => rider.role === "mountain_classification")
    : [];
  const rankedPool = roleCandidates.length > 0 ? roleCandidates : candidates;
  return [...rankedPool].sort(
    (first, second) =>
      score(second) - score(first) || first.id.localeCompare(second.id),
  );
}

function isAvailableObjectiveCandidate(rider: RiderSimulationInput) {
  return (
    rider.role !== "leader" &&
    rider.role !== "sprinter" &&
    (rider.raceDuty === undefined ||
      rider.raceDuty === null ||
      rider.raceDuty === "breakaway_candidate")
  );
}

function getMountainObjectiveScore(rider: RiderSimulationInput) {
  return (
    rider.ratings.mountain * 0.32 +
    rider.ratings.breakaway * 0.24 +
    rider.ratings.hills * 0.16 +
    rider.ratings.acceleration * 0.12 +
    rider.ratings.endurance * 0.1 +
    rider.form * 0.06
  );
}

function getStageWinBreakawayScore(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[],
) {
  return (
    getStageSuitability(rider, segments) * 0.4 +
    getDecisiveRoadFinishRating(rider, segments) * 0.2 +
    rider.ratings.breakaway * 0.18 +
    rider.ratings.acceleration * 0.12 +
    rider.ratings.endurance * 0.1
  );
}

function simulateRoadStage(input: StageSimulationInput): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:road`);
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        raceDayExecutionBonus: getRiderRaceDayExecutionBonus(input, rider),
        decisiveAttackBonus: 0,
        injuryPerformancePenalty: 0,
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ]),
  );
  const strategyContext = buildStageStrategyContext(
    input.riders,
    input.segments,
  );
  const attackPlan = selectStageAttackPlan(
    input.riders,
    input.segments,
    random,
    input.generalClassification,
    input.teamStrategies ?? [],
  );
  const generalClassificationLeaderId = getGeneralClassificationLeaderId(
    input.generalClassification,
  );
  const plannedBreakawayIds = attackPlan.initialAttackIds;
  const totalDistanceKm = Math.max(
    1,
    input.segments.reduce((total, segment) => total + segment.distanceKm, 0),
  );
  const timeline: RaceTimelineSnapshot[] = [];
  const abandonments: RaceAbandonment[] = [];
  const injuries: RaceInjury[] = [];
  const primes: RacePrimeResult[] = [];
  const mountainPoints: Record<string, number> = {};
  const sprintPoints: Record<string, number> = {};
  const breakawayRiders = [...plannedBreakawayIds]
    .map((riderId) => input.riders.find((rider) => rider.id === riderId))
    .filter((rider): rider is RiderSimulationInput => Boolean(rider));
  const selectiveTerrainShare =
    input.segments.filter(
      (segment) => segment.terrain === "climb" || segment.surface === "cobbles",
    ).length / input.segments.length;
  const likelyMassSprint = isLikelyMassSprint(input.segments);
  const controllingTeamIds = getRaceObjectiveControllingTeamIds({
    baseControllingTeamIds: strategyContext.controllingTeamIds,
    teamStrategies: input.teamStrategies ?? [],
    likelyMassSprint,
  });
  const initialPelotonChaseCapacity = getPelotonChaseCapacity(
    [...states.values()],
    input.segments[0],
    controllingTeamIds,
  );
  const breakawayQuality = average(
    breakawayRiders.map(
      (rider) =>
        rider.ratings.breakaway * 0.46 +
        rider.ratings.endurance * 0.34 +
        rider.form * 0.2,
    ),
  );
  const breakawayChaseResistance = clamp(
    breakawayQuality * 0.003 +
      selectiveTerrainShare * 0.45 +
      (1 - initialPelotonChaseCapacity) * 0.16 +
      random() * 0.35 -
      (likelyMassSprint ? 0.32 : 0.08),
    0,
    0.72,
  );
  const breakawaySuccessChance = clamp(
    0.025 +
      selectiveTerrainShare * 0.3 +
      Math.max(0, breakawayQuality - 72) * 0.007 +
      (1 - initialPelotonChaseCapacity) * 0.14 -
      (likelyMassSprint ? 0.035 : 0) +
      (input.weather?.isWet ? 0.04 : 0),
    0.02,
    0.42,
  );
  const breakawayHasWinningDay = random() < breakawaySuccessChance;
  let breakawayGapSeconds = 0;
  let completedDistanceKm = 0;
  let breakawayWasCaught = false;
  let delayedAttackLaunched = attackPlan.delayedAttackIds.size === 0;
  let dangerousBreakawayReactionAnnounced = false;
  let opportunisticAttackCount = 0;
  let decisiveFavoriteAttackCount = 0;
  let largeBreakawayDecision: LargeBreakawayStandoffDecision = null;
  const breakawayTargetGapSeconds = Math.round(250 + random() * 150);
  let hillyClimbLoad = 0;

  input.segments.forEach((segment, segmentIndex) => {
    const commentary: string[] = [];
    const incidents: RaceIncident[] = [];
    const strategyAttackLaunched = attemptPlannedStrategyAttacks({
      orders: attackPlan.strategyAttackOrders.filter(
        (order) => order.segmentNumber === segment.segmentNumber,
      ),
      states,
      segment,
      segmentIndex,
      segmentCount: input.segments.length,
      completedDistanceKm,
      totalDistanceKm,
      teamStrategies: input.teamStrategies ?? [],
      generalClassification: input.generalClassification,
      random,
      commentary,
    });
    if (
      strategyAttackLaunched &&
      getStatesInGroup(states, "breakaway").length > 0
    ) {
      breakawayGapSeconds = Math.max(7, breakawayGapSeconds);
    }
    const raceProgress = clamp(completedDistanceKm / totalDistanceKm, 0, 1);
    const segmentEndProgress = clamp(
      (completedDistanceKm + segment.distanceKm) / totalDistanceKm,
      0,
      1,
    );

    if (
      !delayedAttackLaunched &&
      completedDistanceKm >= attackPlan.delayedAttackAtKm
    ) {
      const hasLeadingBreakaway =
        getStatesInGroup(states, "breakaway").length > 0;
      const pelotonIsGrouped =
        !hasLeadingBreakaway || breakawayGapSeconds <= 25;
      const remainingDistanceKm = totalDistanceKm - completedDistanceKm;
      const canLaunch =
        !attackPlan.delayedAttackRequiresGroupedPeloton || pelotonIsGrouped;

      if (canLaunch) {
        const delayedAttackers = [...attackPlan.delayedAttackIds]
          .map((riderId) => states.get(riderId))
          .filter((state): state is RiderState =>
            Boolean(state && state.group === "peloton" && state.energy >= 16),
          );

        for (const state of delayedAttackers) {
          state.group = hasLeadingBreakaway ? "chase" : "breakaway";
          state.groupSinceSegment = segmentIndex;
          state.energy = Math.max(0, state.energy - (2.2 + random() * 1.8));
        }

        if (delayedAttackers.length > 0) {
          if (!hasLeadingBreakaway) {
            breakawayGapSeconds = Math.max(
              breakawayGapSeconds,
              Math.round(14 + random() * 18),
            );
          }
          commentary.push(
            formatRiderList(delayedAttackers) +
              " ont gardé des réserves et passent à l’attaque à " +
              Math.round(remainingDistanceKm) +
              " km de l’arrivée.",
          );
        }
        delayedAttackLaunched = true;
      } else if (remainingDistanceKm <= 10) {
        delayedAttackLaunched = true;
      }
    }
    const peloton = getStatesInGroup(states, "peloton");
    const breakaway = getStatesInGroup(states, "breakaway");
    const secondaryBreakaway = getStatesInGroup(states, "breakaway_2");
    const chase = getStatesInGroup(states, "chase");
    const delayed = getStatesInGroup(states, "delayed");
    const dropped = getStatesInGroup(states, "dropped");
    const activeBreakawaySize = breakaway.length + secondaryBreakaway.length;
    const fieldPaceStates =
      peloton.length > 0
        ? peloton
        : delayed.length > 0
          ? delayed
          : dropped.length > 0
            ? dropped
            : chase.length > 0
              ? chase
              : secondaryBreakaway.length > 0
                ? secondaryBreakaway
                : breakaway;
    const frontTerrainRating = getFrontTerrainRating(
      fieldPaceStates,
      segment,
      input.profileType,
      hillyClimbLoad,
    );
    const breakawayThreat = getBreakawayThreat({
      breakaway: [...breakaway, ...secondaryBreakaway, ...chase],
      peloton,
      segments: input.segments,
      fieldSize: input.riders.length,
      gapSeconds: breakawayGapSeconds,
      generalClassification: input.generalClassification,
      isStageRace: input.isStageRace,
    });
    const baseChasePressure = getPelotonChasePressure(
      peloton,
      segment,
      raceProgress,
      breakaway.length + secondaryBreakaway.length > 0,
      breakawayThreat,
      breakawayGapSeconds,
      controllingTeamIds,
    );
    const strategyChaseModifier = getStrategyChaseModifier({
      states,
      teamStrategies: input.teamStrategies ?? [],
      breakawayThreat,
      raceProgress,
      generalClassificationLeaderId,
      likelyMassSprint,
    });
    if (
      largeBreakawayDecision === null &&
      activeBreakawaySize > LARGE_BREAKAWAY_RIDER_THRESHOLD &&
      peloton.length > 0
    ) {
      largeBreakawayDecision = decideLargeBreakawayStandoff({
        breakawaySize: activeBreakawaySize,
        pelotonSize: peloton.length,
        completedDistanceKm,
        raceProgress,
        gapSeconds: breakawayGapSeconds,
        breakawayAverageEnergy: average(
          [...breakaway, ...secondaryBreakaway].map((state) => state.energy),
        ),
        pelotonAverageEnergy: average(peloton.map((state) => state.energy)),
        chasePressure: baseChasePressure,
        likelyMassSprint,
        roll: random(),
      });

      if (largeBreakawayDecision === "breakaway_gives_up") {
        commentary.push(
          "La grande \u00e9chapp\u00e9e coupe son effort et accepte d\u2019\u00eatre reprise pour pr\u00e9server ses r\u00e9serves.",
        );
      } else if (largeBreakawayDecision === "peloton_gives_up") {
        commentary.push(
          "Le peloton renonce \u00e0 la poursuite : la grande \u00e9chapp\u00e9e peut creuser son avance.",
        );
      }
    }

    const pelotonHasGivenUp = largeBreakawayDecision === "peloton_gives_up";
    const breakawayHasGivenUp = largeBreakawayDecision === "breakaway_gives_up";
    const winningBreakawayPursuitFactor =
      breakawayHasWinningDay && raceProgress > 0.52 ? 0.5 : 1;
    const chasePressure = pelotonHasGivenUp
      ? Math.min(0.14, baseChasePressure * 0.25)
      : clamp(
          Math.max(
            baseChasePressure * winningBreakawayPursuitFactor,
            breakawayThreat >= 0.5 ? 0.46 + breakawayThreat * 0.34 : 0,
          ) + strategyChaseModifier,
          0,
          1,
        );
    const pelotonChaseWorkers = getPelotonChaseWorkers(
      peloton,
      controllingTeamIds,
    );
    const pelotonWorkerIds = new Set(
      pelotonChaseWorkers.map((state) => state.rider.id),
    );
    const pelotonSeconds = getGroupSegmentTime(
      fieldPaceStates,
      segment,
      "peloton",
      chasePressure,
      random,
      chasePressure >= 0.35 ? pelotonChaseWorkers : undefined,
    );
    let breakawaySeconds = breakaway.length
      ? getGroupSegmentTime(breakaway, segment, "breakaway", 0.58, random)
      : pelotonSeconds;
    const secondaryBreakawaySeconds = secondaryBreakaway.length
      ? breakawaySeconds + 3 + random() * 5
      : breakawaySeconds;
    const chaseSeconds = chase.length
      ? breakaway.length > 0
        ? breakawaySeconds + (pelotonSeconds - breakawaySeconds) * 0.58
        : pelotonSeconds + 3 + random() * 5
      : pelotonSeconds;

    if (breakaway.length > 0 && breakawayHasGivenUp) {
      breakawaySeconds *= 1.08;
    } else if (
      breakaway.length > 0 &&
      breakawayHasWinningDay &&
      raceProgress > 0.45
    ) {
      breakawaySeconds *= 0.955 + (1 - breakawayChaseResistance) * 0.012;
    }

    if (segmentIndex === 0) {
      commentary.push(
        "Le départ est donné : le peloton reste groupé tandis que les premières offensives se préparent.",
      );
    } else if (segmentIndex === 1 && breakaway.length > 0) {
      breakawayGapSeconds = Math.round(24 + random() * 24);
      commentary.push(
        `${formatRiderList(breakaway)} passent à l’attaque et ouvrent un premier écart de ${formatGap(breakawayGapSeconds)}.`,
      );
    } else if (breakaway.length > 0) {
      const naturalGap =
        breakawayGapSeconds + pelotonSeconds - breakawaySeconds;

      if (breakawayHasGivenUp) {
        breakawayGapSeconds = clamp(
          naturalGap - Math.max(35, breakawayGapSeconds * 0.38),
          -30,
          540,
        );
      } else if (pelotonHasGivenUp) {
        breakawayGapSeconds = clamp(
          Math.max(naturalGap, breakawayGapSeconds + 12),
          0,
          540,
        );
      } else if (raceProgress < 0.3) {
        const allowedGap = Math.min(
          breakawayTargetGapSeconds * (1 - breakawayThreat * 0.28),
          95 + segmentIndex * 58,
        );
        breakawayGapSeconds = clamp(
          Math.max(
            naturalGap,
            breakawayGapSeconds +
              Math.max(8, (allowedGap - breakawayGapSeconds) * 0.48),
          ),
          0,
          540,
        );
      } else if (raceProgress < 0.62) {
        const controlledFloor =
          breakawayTargetGapSeconds * 0.72 * (1 - breakawayThreat * 0.55);
        const dangerousGroupClosing =
          Math.max(0, chasePressure - 0.5) * (18 + breakawayThreat * 42);
        breakawayGapSeconds = clamp(
          Math.max(controlledFloor, naturalGap - dangerousGroupClosing),
          0,
          540,
        );
      } else {
        const chaseClosingSeconds =
          (raceProgress - 0.58) *
          (likelyMassSprint ? 115 : 72) *
          (1 - breakawayChaseResistance) *
          (breakawayHasWinningDay ? 0.18 : 1);
        breakawayGapSeconds = clamp(naturalGap - chaseClosingSeconds, -30, 540);
      }
    }

    if (
      breakaway.length > 0 &&
      raceProgress > 0.12 &&
      raceProgress < 0.58 &&
      commentary.length < 3
    ) {
      if (breakawayThreat >= 0.5 && chasePressure >= 0.6) {
        if (!dangerousBreakawayReactionAnnounced) {
          commentary.push(
            "Le groupe de t\u00eate est jug\u00e9 dangereux : plusieurs \u00e9quipes haussent nettement le rythme du peloton.",
          );
          dangerousBreakawayReactionAnnounced = true;
        }
      } else {
        commentary.push(
          `Le peloton contr\u00f4le l\u2019\u00e9cart autour de ${formatGap(breakawayGapSeconds)} sans lancer la poursuite.`,
        );
      }
    }

    for (const state of states.values()) {
      if (state.group === "abandoned") continue;

      if (state.group === "breakaway") {
        state.elapsedTimeSeconds += breakawaySeconds;
      } else if (state.group === "breakaway_2") {
        state.elapsedTimeSeconds += secondaryBreakawaySeconds;
        state.lostTimeSeconds += Math.max(
          0,
          secondaryBreakawaySeconds - breakawaySeconds,
        );
      } else if (state.group === "chase") {
        state.elapsedTimeSeconds += chaseSeconds;
      } else if (state.group === "peloton") {
        state.elapsedTimeSeconds += pelotonSeconds;
      } else if (state.group === "delayed") {
        state.elapsedTimeSeconds += pelotonSeconds;
      } else {
        const extraLoss = getDroppedRiderLoss(
          state,
          segment,
          frontTerrainRating,
          input.profileType,
          hillyClimbLoad,
          random,
        );
        state.lostTimeSeconds += extraLoss;
        state.elapsedTimeSeconds += pelotonSeconds + extraLoss;
      }

      state.energy = updateRiderEnergy({
        state,
        segment,
        segmentIndex,
        segmentCount: input.segments.length,
        groupSize:
          state.group === "breakaway"
            ? Math.max(1, breakaway.length)
            : state.group === "breakaway_2"
              ? Math.max(1, secondaryBreakaway.length)
              : state.group === "chase"
                ? Math.max(1, chase.length)
                : state.group === "delayed"
                  ? Math.max(1, delayed.length)
                  : state.group === "peloton"
                    ? Math.max(1, peloton.length)
                    : Math.max(1, dropped.length),
        chasePressure,
        frontBreakawaySize: activeBreakawaySize,
        frontGroupIsYielding: breakawayHasGivenUp,
        frontGroupIsUncontested: pelotonHasGivenUp,
        hasBottleCarrierSupport: hasTeammateBottleCarrier(state, states),
        leaderProtectionStrength: getLeaderProtectionStrength({
          state,
          states,
          segment,
          segmentIndex,
          segmentCount: input.segments.length,
        }),
        protectingLeader: isProtectingTeamLeader({
          state,
          states,
          segmentIndex,
          segmentCount: input.segments.length,
        }),
        pelotonWorker:
          state.group === "peloton" && pelotonWorkerIds.has(state.rider.id),
        profileType: input.profileType,
        hillyClimbLoad,
        groupPaceRating:
          state.group === "peloton"
            ? frontTerrainRating
            : state.group === "breakaway"
              ? getFrontTerrainRating(
                  breakaway,
                  segment,
                  input.profileType,
                  hillyClimbLoad,
                )
              : state.group === "breakaway_2"
                ? getFrontTerrainRating(
                    secondaryBreakaway,
                    segment,
                    input.profileType,
                    hillyClimbLoad,
                  )
                : state.group === "chase"
                  ? getFrontTerrainRating(
                      chase,
                      segment,
                      input.profileType,
                      hillyClimbLoad,
                    )
                  : state.group === "delayed"
                    ? getFrontTerrainRating(
                        delayed,
                        segment,
                        input.profileType,
                        hillyClimbLoad,
                      )
                    : getStateSelectionTerrainRating(
                        state,
                        segment,
                        input.profileType,
                        hillyClimbLoad,
                      ),
      });
    }

    if (
      opportunisticAttackCount < 2 &&
      maybeLaunchCounterAttack({
        states,
        segmentIndex,
        completedDistanceKm,
        totalDistanceKm,
        breakawayGapSeconds,
        chasePressure,
        strategy: strategyContext,
        random,
        commentary,
      })
    ) {
      opportunisticAttackCount += 1;
    }

    if (
      decisiveFavoriteAttackCount < 2 &&
      maybeLaunchDecisiveFavoriteAttack({
        states,
        segment,
        segmentIndex,
        segmentCount: input.segments.length,
        profileType: input.profileType,
        likelyMassSprint,
        hillyClimbLoad,
        strategy: strategyContext,
        random,
        commentary,
      })
    ) {
      decisiveFavoriteAttackCount += 1;
    }

    resolveExistingChasers({
      states,
      segmentIndex,
      breakawayGapSeconds,
      random,
      commentary,
    });

    resolveDelayedRiders({
      states,
      segment,
      segmentIndex,
      random,
      commentary,
    });

    dropStrugglingRiders({
      states,
      segment,
      segmentIndex,
      raceDistanceProgress: segmentEndProgress,
      segmentCount: input.segments.length,
      profileType: input.profileType,
      chasePressure,
      hillyClimbLoad,
      random,
      commentary,
    });

    maybeSplitBreakaway({
      states,
      segment,
      segmentIndex,
      random,
      commentary,
    });

    const incident = maybeCreateRaceIncident({
      states,
      segment,
      segmentIndex,
      segmentCount: input.segments.length,
      weather: input.weather ?? getRaceWeather(input.seed),
      protectedRiderId: generalClassificationLeaderId,
      random,
    });
    if (incident) {
      incidents.push(incident.incident);
      abandonments.push(...incident.abandonments);
      injuries.push(...incident.injuries);
      commentary.unshift(incident.commentary);
    }

    const exhaustedBreakaway = getStatesInGroup(states, "breakaway").filter(
      (state) => state.energy < 9,
    );
    for (const state of exhaustedBreakaway) {
      state.group = "breakaway_2";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 12;
      commentary.push(
        `${state.rider.name} lâche l’échappée principale et tente de résister dans un deuxième groupe.`,
      );
    }

    promoteSecondaryBreakawayWhenNeeded(states, segmentIndex);

    const activePeloton = getStatesInGroup(states, "peloton");
    if (
      activePeloton.length > 0 &&
      getStatesInGroup(states, "breakaway").length > 0 &&
      breakawayGapSeconds <= 0
    ) {
      const pelotonTime = average(
        activePeloton.map((item) => item.elapsedTimeSeconds),
      );
      for (const state of [...states.values()].filter(
        (candidate) =>
          candidate.group === "breakaway" ||
          candidate.group === "breakaway_2" ||
          candidate.group === "chase",
      )) {
        state.group = "peloton";
        state.groupSinceSegment = segmentIndex;
        state.elapsedTimeSeconds = pelotonTime;
      }
      breakawayGapSeconds = 0;
      breakawayWasCaught = true;
      commentary.push(
        "L’échappée est reprise : le peloton est de nouveau groupé.",
      );
    }

    if (segment.prime) {
      const primeResult = resolvePrime({
        states,
        segment,
        prime: segment.prime,
        segmentNumber: segment.segmentNumber,
        breakawayGapSeconds,
        random,
      });
      primes.push(primeResult);
      const target =
        segment.prime.type === "mountain" ? mountainPoints : sprintPoints;

      for (const classified of primeResult.classification) {
        target[classified.riderId] =
          (target[classified.riderId] ?? 0) + classified.points;
      }

      const winner = states.get(primeResult.classification[0]?.riderId)?.rider;
      if (winner) {
        commentary.push(
          `${winner.name} passe en tête ${segment.prime.type === "mountain" ? "du GPM" : "du sprint intermédiaire"}.`,
        );
      }
    }

    if (
      segmentIndex > input.segments.length * 0.62 &&
      getStatesInGroup(states, "breakaway").length > 0 &&
      chasePressure > 0.7
    ) {
      commentary.push(
        "Les équipes de sprinteurs organisent la poursuite en tête de peloton.",
      );
    }

    completedDistanceKm += segment.distanceKm;
    timeline.push(
      buildRoadSnapshot({
        states,
        segmentNumber: segment.segmentNumber,
        completedDistanceKm,
        breakawayGapSeconds,
        incidents,
        abandonments,
        commentary,
      }),
    );
    hillyClimbLoad = getNextHillyClimbLoad(
      hillyClimbLoad,
      segment,
      input.profileType,
    );

    if (segmentIndex === 0) {
      for (const riderId of plannedBreakawayIds) {
        const state = states.get(riderId);
        if (state && state.group === "peloton") {
          state.group = "breakaway";
          state.groupSinceSegment = 1;
        }
      }
    }
  });

  const finalCommentary = timeline.at(-1)?.commentary ?? [];
  const finishScores = getRoadFinishScores(
    states,
    input.segments,
    input.profileType,
    random,
    finalCommentary,
  );
  const rawResults = [...states.values()]
    .filter((state) => state.group !== "abandoned")
    .map((state) => ({
      riderId: state.rider.id,
      score: finishScores.get(state.rider.id) ?? 0,
      elapsedTimeSeconds: getRoadFinishTime(
        state,
        states,
        finishScores,
        input.segments,
        input.profileType,
      ),
      energyAfter: round(state.energy, 1),
    }));
  rawResults.sort(
    (first, second) =>
      first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
      second.score - first.score,
  );
  const winnerTime = rawResults[0].elapsedTimeSeconds;
  const results: StageSimulationResult["results"] = rawResults.map(
    (result, index) => ({
      riderId: result.riderId,
      rank: index + 1,
      status: "finished" as const,
      elapsedTimeSeconds: Math.round(result.elapsedTimeSeconds),
      gapToWinnerSeconds: Math.max(
        0,
        Math.round(result.elapsedTimeSeconds - winnerTime),
      ),
      energyAfter: result.energyAfter,
      injury:
        injuries.find((injury) => injury.riderId === result.riderId) ?? null,
      abandonment: null,
    }),
  );

  for (const abandonment of abandonments) {
    const state = states.get(abandonment.riderId)!;
    results.push({
      riderId: abandonment.riderId,
      rank: null,
      status: "did_not_finish",
      elapsedTimeSeconds: Math.round(state.elapsedTimeSeconds),
      gapToWinnerSeconds: 0,
      energyAfter: round(state.energy, 1),
      injury:
        injuries.find((injury) => injury.riderId === abandonment.riderId) ??
        null,
      abandonment,
    });
  }

  const finishGroups = normalizeRoadFinishGroupTimes({
    results,
  });

  awardFinishClassificationPoints({
    results,
    segments: input.segments,
    mountainPoints,
    sprintPoints,
  });

  updateFinalRoadGroups({
    timeline,
    finishGroups,
  });

  if (finalCommentary.length === 0) {
    finalCommentary.push(
      breakawayWasCaught
        ? "Le regroupement conduit le peloton vers l’explication finale."
        : "Les meilleurs coureurs se départagent dans le dernier kilomètre.",
    );
  }

  if (
    getStatesInGroup(states, "breakaway").length > 0 &&
    breakawayGapSeconds > 0
  ) {
    finalCommentary.push(
      `L’échappée résiste jusqu’à la ligne avec ${formatGap(breakawayGapSeconds)} d’avance : le peloton a trop attendu.`,
    );
  }

  return {
    stageId: input.id,
    seed: String(input.seed),
    resolvedRiders: input.riders,
    timeline,
    results,
    primes,
    mountainPoints,
    sprintPoints,
  };
}

export function normalizeTeamTimeTrialRelayShares(
  riderIds: string[],
  plans: Record<string, TimeTrialRiderPlan> = {},
) {
  if (riderIds.length === 0) return {};

  const configuredShares = riderIds.map((riderId) =>
    Math.max(0, plans[riderId]?.relaySharePct ?? 0),
  );
  const configuredTotal = configuredShares.reduce(
    (total, share) => total + share,
    0,
  );

  if (configuredTotal <= 0) {
    const equalShare = 1 / riderIds.length;
    return Object.fromEntries(
      riderIds.map((riderId) => [riderId, equalShare]),
    );
  }

  return Object.fromEntries(
    riderIds.map((riderId, index) => [
      riderId,
      configuredShares[index] / configuredTotal,
    ]),
  );
}

function getTimeTrialPlan(input: StageSimulationInput, riderId: string) {
  return input.timeTrialPlans?.[riderId] ?? DEFAULT_TIME_TRIAL_RIDER_PLAN;
}

function applyTimeTrialEnergyCost(
  energyBefore: number,
  baselineEnergyAfter: number,
  multiplier: number,
) {
  return clamp(
    energyBefore -
      Math.max(0, energyBefore - baselineEnergyAfter) * multiplier,
    0,
    100,
  );
}

function simulateIndividualTimeTrial(
  input: StageSimulationInput,
): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:itt`);
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        raceDayExecutionBonus: 0,
        decisiveAttackBonus: 0,
        injuryPerformancePenalty: 0,
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ]),
  );
  const timeline: RaceTimelineSnapshot[] = [];
  let completedDistanceKm = 0;

  input.segments.forEach((segment, segmentIndex) => {
    for (const state of states.values()) {
      const rating = getTimeTrialSegmentRating(
        state.rider,
        segment,
        input.stageType,
      );
      const baseSpeed = getBaseSpeed(segment);
      const effort =
        TIME_TRIAL_EFFORT_EFFECTS[
          getTimeTrialPlan(input, state.rider.id).effortMode
        ];
      const fatiguePenalty = Math.max(0, 28 - state.energy) * 0.0045;
      const speed = Math.max(
        8,
        baseSpeed *
          (0.82 +
            rating * 0.0041 -
            fatiguePenalty +
            (random() - 0.5) * 0.014) *
          effort.paceMultiplier,
      );
      state.elapsedTimeSeconds += (segment.distanceKm / speed) * 3_600;
      const energyBefore = state.energy;
      const baselineEnergyAfter = updateRiderEnergy({
        state,
        segment,
        segmentIndex,
        segmentCount: input.segments.length,
        groupSize: 1,
        chasePressure: 1,
        hasBottleCarrierSupport: false,
        timeTrial: true,
      });
      state.energy = applyTimeTrialEnergyCost(
        energyBefore,
        baselineEnergyAfter,
        effort.energyCostMultiplier,
      );
    }

    completedDistanceKm += segment.distanceKm;
    const ordered = [...states.values()].sort(
      (first, second) => first.elapsedTimeSeconds - second.elapsedTimeSeconds,
    );
    const leaderTime = ordered[0].elapsedTimeSeconds;
    timeline.push({
      segmentNumber: segment.segmentNumber,
      completedDistanceKm: round(completedDistanceKm, 1),
      groups: ordered.map((state, index) => ({
        id: `chrono-${state.rider.id}`,
        label:
          index === 0 ? "Meilleur temps provisoire" : `Chrono n°${index + 1}`,
        type: "time_trial",
        riderIds: [state.rider.id],
        gapToLeaderSeconds: Math.max(
          0,
          Math.round(state.elapsedTimeSeconds - leaderTime),
        ),
        elapsedTimeSeconds: round(state.elapsedTimeSeconds, 3),
        averageEnergy: round(state.energy, 1),
      })),
      incidents: [],
      abandonments: [],
      commentary: [
        `${ordered[0].rider.name} possède le meilleur temps au pointage des ${formatDistance(completedDistanceKm)} km.`,
      ],
    });
  });

  return buildTimedResult(input, states, timeline);
}

function simulateTeamTimeTrial(
  input: StageSimulationInput,
): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:ttt`);
  const teams = groupBy(input.riders, (rider) => rider.teamId);
  const teamGroupTimes = new Map<string, number>();
  const activeRiderIdsByTeam = new Map(
    [...teams].map(([teamId, riders]) => [
      teamId,
      new Set(riders.map((rider) => rider.id)),
    ]),
  );
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        raceDayExecutionBonus: 0,
        decisiveAttackBonus: 0,
        injuryPerformancePenalty: 0,
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ]),
  );
  const timeline: RaceTimelineSnapshot[] = [];
  let completedDistanceKm = 0;

  input.segments.forEach((segment, segmentIndex) => {
    const droppedThisSegment: RiderState[] = [];

    for (const [teamId, riders] of teams) {
      const activeRiderIds = activeRiderIdsByTeam.get(teamId)!;
      const activeRiders = riders.filter((rider) =>
        activeRiderIds.has(rider.id),
      );
      const alreadyDroppedRiders = riders.filter(
        (rider) => !activeRiderIds.has(rider.id),
      );

      for (const rider of alreadyDroppedRiders) {
        const state = states.get(rider.id)!;
        const effort =
          TIME_TRIAL_EFFORT_EFFECTS[
            getTimeTrialPlan(input, rider.id).effortMode
          ];
        const rating = getTimeTrialSegmentRating(
          rider,
          segment,
          "team_time_trial",
        );
        const fatiguePenalty = Math.max(0, 28 - state.energy) * 0.0045;
        const soloSpeed = Math.max(
          8,
          getBaseSpeed(segment) *
            (0.82 +
              rating * 0.0041 -
              fatiguePenalty +
              (random() - 0.5) * 0.012) *
            effort.paceMultiplier,
        );
        state.elapsedTimeSeconds += (segment.distanceKm / soloSpeed) * 3_600;
        const energyBefore = state.energy;
        const baselineEnergyAfter = updateRiderEnergy({
          state,
          segment,
          segmentIndex,
          segmentCount: input.segments.length,
          groupSize: 1,
          chasePressure: 1,
          hasBottleCarrierSupport: false,
          timeTrial: true,
        });
        state.energy = applyTimeTrialEnergyCost(
          energyBefore,
          baselineEnergyAfter,
          effort.energyCostMultiplier,
        );
      }

      const relayShares = normalizeTeamTimeTrialRelayShares(
        activeRiders.map((rider) => rider.id),
        input.timeTrialPlans,
      );
      const equalRelayShare = 1 / Math.max(1, activeRiders.length);
      const teamRating = activeRiders.reduce((total, rider) => {
        const effort =
          TIME_TRIAL_EFFORT_EFFECTS[
            getTimeTrialPlan(input, rider.id).effortMode
          ];
        return (
          total +
          getTimeTrialSegmentRating(rider, segment, "team_time_trial") *
            effort.paceMultiplier *
            relayShares[rider.id]
        );
      }, 0);
      const speed = Math.max(
        8,
        getBaseSpeed(segment) *
          (0.87 +
            teamRating * 0.0038 +
            Math.log2(activeRiders.length + 1) * 0.012 +
            (random() - 0.5) * 0.01),
      );
      const segmentSeconds = (segment.distanceKm / speed) * 3_600;
      const groupTime =
        (teamGroupTimes.get(teamId) ?? 0) + segmentSeconds;
      teamGroupTimes.set(teamId, groupTime);

      const dropScores: Array<{ state: RiderState; score: number }> = [];
      for (const rider of activeRiders) {
        const state = states.get(rider.id)!;
        const plan = getTimeTrialPlan(input, rider.id);
        const effort = TIME_TRIAL_EFFORT_EFFECTS[plan.effortMode];
        const normalizedRelayShare = relayShares[rider.id];
        const relayLoadMultiplier = clamp(
          0.55 + (normalizedRelayShare / equalRelayShare) * 0.45,
          0.45,
          2.2,
        );
        state.elapsedTimeSeconds = groupTime;
        const energyBefore = state.energy;
        const baselineEnergyAfter = updateRiderEnergy({
          state,
          segment,
          segmentIndex,
          segmentCount: input.segments.length,
          groupSize: activeRiders.length,
          chasePressure: 0.82,
          hasBottleCarrierSupport: activeRiders.some(
            (teammate) =>
              teammate.id !== rider.id &&
              hasSpecialAbility(teammate, "bottle_carrier"),
          ),
          timeTrial: true,
        });
        state.energy = applyTimeTrialEnergyCost(
          energyBefore,
          baselineEnergyAfter,
          effort.energyCostMultiplier * relayLoadMultiplier,
        );

        const riderRating = getTimeTrialSegmentRating(
          rider,
          segment,
          "team_time_trial",
        );
        const sustainableRating =
          riderRating * 0.72 +
          rider.ratings.endurance * 0.16 +
          rider.ratings.resistance * 0.12;
        const fatiguePressure = Math.max(0, 18 - state.energy) * 0.48;
        const relayPressure =
          Math.max(0, normalizedRelayShare / equalRelayShare - 1) *
          Math.max(0, 24 - state.energy) *
          0.16;
        dropScores.push({
          state,
          score:
            teamRating - sustainableRating + fatiguePressure + relayPressure,
        });
      }

      if (
        segmentIndex < input.segments.length - 1 &&
        activeRiders.length > 1
      ) {
        const candidates = dropScores
          .filter(
            ({ state, score }) =>
              state.energy <= 3.5 || score > 6.5 + random() * 3.5,
          )
          .sort(
            (first, second) =>
              second.score - first.score ||
              first.state.energy - second.state.energy,
          )
          .slice(0, activeRiders.length - 1);

        for (const { state, score } of candidates) {
          activeRiderIds.delete(state.rider.id);
          state.group = "dropped";
          state.groupSinceSegment = segmentIndex;
          const immediateLossSeconds = 4 + Math.max(0, score) * 1.4;
          state.lostTimeSeconds += immediateLossSeconds;
          state.elapsedTimeSeconds += immediateLossSeconds;
          droppedThisSegment.push(state);
        }
      }
    }

    completedDistanceKm += segment.distanceKm;
    const groups = [...teams].flatMap(([teamId, riders]) => {
      const activeIds = activeRiderIdsByTeam.get(teamId)!;
      const activeStates = riders
        .filter((rider) => activeIds.has(rider.id))
        .map((rider) => states.get(rider.id)!);
      const droppedStates = riders
        .filter((rider) => !activeIds.has(rider.id))
        .map((rider) => states.get(rider.id)!);
      const activeGroup =
        activeStates.length > 0
          ? [
              {
                id: `team-chrono-${teamId}`,
                label: riders[0].teamName,
                type: "time_trial" as const,
                riderIds: activeStates.map((state) => state.rider.id),
                elapsedTimeSeconds: teamGroupTimes.get(teamId)!,
                averageEnergy: average(
                  activeStates.map((state) => state.energy),
                ),
              },
            ]
          : [];
      return [
        ...activeGroup,
        ...droppedStates.map((state) => ({
          id: `chrono-dropped-${state.rider.id}`,
          label: `${state.rider.name} · lâché`,
          type: "dropped" as const,
          riderIds: [state.rider.id],
          elapsedTimeSeconds: state.elapsedTimeSeconds,
          averageEnergy: state.energy,
        })),
      ];
    });
    const orderedGroups = groups.sort(
      (first, second) =>
        first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
        first.id.localeCompare(second.id),
    );
    const leaderTime = orderedGroups[0].elapsedTimeSeconds;
    timeline.push({
      segmentNumber: segment.segmentNumber,
      completedDistanceKm: round(completedDistanceKm, 1),
      groups: orderedGroups.map((group, index) => ({
        ...group,
        label: index === 0 ? `${group.label} · meilleur temps` : group.label,
        gapToLeaderSeconds: Math.max(
          0,
          Math.round(group.elapsedTimeSeconds - leaderTime),
        ),
        elapsedTimeSeconds: round(group.elapsedTimeSeconds, 3),
        averageEnergy: round(group.averageEnergy, 1),
      })),
      incidents: [],
      abandonments: [],
      commentary: [
        `${orderedGroups[0].label} signe le meilleur temps intermédiaire.`,
        ...droppedThisSegment.slice(0, 3).map(
          (state) =>
            `${state.rider.name} ne peut plus suivre le rythme de ses coéquipiers et poursuit seul.`,
        ),
      ],
    });
  });

  return buildTimedResult(input, states, timeline);
}

function buildTimedResult(
  input: StageSimulationInput,
  states: Map<string, RiderState>,
  timeline: RaceTimelineSnapshot[],
): StageSimulationResult {
  const ordered = [...states.values()].sort(
    (first, second) => first.elapsedTimeSeconds - second.elapsedTimeSeconds,
  );
  const winnerTime = ordered[0].elapsedTimeSeconds;

  return {
    stageId: input.id,
    seed: String(input.seed),
    resolvedRiders: input.riders,
    timeline,
    results: ordered.map((state, index) => ({
      riderId: state.rider.id,
      rank: index + 1,
      status: "finished" as const,
      elapsedTimeSeconds: Math.round(state.elapsedTimeSeconds),
      gapToWinnerSeconds: Math.max(
        0,
        Math.round(state.elapsedTimeSeconds - winnerTime),
      ),
      energyAfter: round(state.energy, 1),
      injury: null,
      abandonment: null,
    })),
    primes: [],
    mountainPoints: {},
    sprintPoints: {},
  };
}

export type StageAttackPlan = {
  initialAttackIds: Set<string>;
  delayedAttackIds: Set<string>;
  delayedAttackAtKm: number;
  delayedAttackRequiresGroupedPeloton: boolean;
  strategyAttackOrders: Array<RaceAttackOrder & { teamId: string }>;
};

export function selectStageAttackPlan(
  riders: RiderSimulationInput[],
  segments: RaceStageSegment[],
  random: () => number,
  generalClassification?: StageSimulationInput["generalClassification"],
  teamStrategies: RaceTeamStrategy[] = [],
): StageAttackPlan {
  const strategy = buildStageStrategyContext(riders, segments);
  const strategiesByTeamId = new Map(
    teamStrategies.map((teamStrategy) => [teamStrategy.teamId, teamStrategy]),
  );
  const generalLeaderId = getGeneralClassificationLeaderId(
    generalClassification,
  );
  const plannedAttackerIds = new Set(
    teamStrategies.flatMap((teamStrategy) =>
      teamStrategy.attackOrders.map((order) => order.riderId),
    ),
  );
  const fieldAverage = average(
    riders.map((rider) => getStageSuitability(rider, segments)),
  );
  const rankedCandidates = riders
    .filter((rider) => {
      const teamStrategy = strategiesByTeamId.get(rider.teamId);
      return (
        rider.id !== generalLeaderId &&
        rider.role !== "leader" &&
        rider.role !== "sprinter" &&
        (!strategy.protectedRiderIds.has(rider.id) ||
          rider.raceDuty === "breakaway_candidate") &&
        (teamStrategy?.breakawayPolicy !== "avoid" ||
          rider.raceDuty === "breakaway_candidate") &&
        (!plannedAttackerIds.has(rider.id) ||
          rider.raceDuty === "breakaway_candidate")
      );
    })
    .map((rider) => {
      const favoriteTier =
        strategy.favoriteTierByTeamId.get(rider.teamId) ?? "none";
      const teamStrategy = strategiesByTeamId.get(rider.teamId);
      const tacticalBonus =
        (rider.raceDuty === "breakaway_candidate" ? 36 : 0) +
        (teamStrategy?.breakawayPolicy === "target" ? 8 : 0) +
        (teamStrategy?.objective === "breakaway" ? 8 : 0) +
        (teamStrategy?.collectivePosture === "aggressive" ? 4 : 0);
      const roleBonus =
        rider.role === "free_agent"
          ? 14
          : rider.role === "mountain_classification"
            ? 9
            : 0;
      const abilityBonus = hasSpecialAbility(rider, "panache") ? 10 : 0;
      const favoriteTeamPenalty =
        favoriteTier === "major" ? 21 : favoriteTier === "medium" ? 11 : 0;
      const score =
        rider.ratings.breakaway * 0.5 +
        rider.ratings.acceleration * 0.19 +
        rider.ratings.endurance * 0.16 +
        rider.form * 0.15 +
        roleBonus +
        abilityBonus +
        tacticalBonus -
        favoriteTeamPenalty +
        random() * 15;
      return { rider, score, favoriteTier };
    })
    .sort((first, second) => second.score - first.score);
  const candidates = rankedCandidates.filter(({ rider, score }) => {
    const stageStrength = getStageSuitability(rider, segments) - fieldAverage;
    return (
      rider.raceDuty === "breakaway_candidate" ||
      score > 61 + Math.max(0, stageStrength * 0.72)
    );
  });
  const maximum = Math.max(
    2,
    Math.min(LARGE_BREAKAWAY_MAXIMUM_SIZE, Math.ceil(riders.length / 4)),
  );
  const initialAttackIds = new Set<string>();
  const morningTeamCounts = new Map<string, number>();

  for (const candidate of candidates.filter(
    ({ rider }) => rider.raceDuty === "breakaway_candidate",
  )) {
    if (initialAttackIds.size >= maximum) break;
    if (morningTeamCounts.has(candidate.rider.teamId)) continue;
    initialAttackIds.add(candidate.rider.id);
    morningTeamCounts.set(candidate.rider.teamId, 1);
  }

  for (const candidate of candidates) {
    if (initialAttackIds.size >= maximum) break;

    const existingTeamCount =
      morningTeamCounts.get(candidate.rider.teamId) ?? 0;
    const rareSecondRider =
      existingTeamCount === 1 &&
      candidate.favoriteTier === "none" &&
      initialAttackIds.size >= 5 &&
      random() < 0.06;
    if (existingTeamCount > 0 && !rareSecondRider) continue;

    const launchChance =
      candidate.favoriteTier === "major"
        ? 0.12
        : candidate.favoriteTier === "medium"
          ? 0.32
          : candidate.rider.role === "free_agent"
            ? 0.82
            : 0.68;
    if (random() > launchChance) continue;

    initialAttackIds.add(candidate.rider.id);
    morningTeamCounts.set(candidate.rider.teamId, existingTeamCount + 1);
  }

  if (initialAttackIds.size === 0 && candidates.length > 0) {
    initialAttackIds.add(candidates[0].rider.id);
    morningTeamCounts.set(candidates[0].rider.teamId, 1);
  }

  const totalDistanceKm = segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0,
  );
  const lateAttackWindow = getLateAttackWindow(segments, random);
  const reserveCandidates = rankedCandidates
    .filter(({ rider, favoriteTier, score }) => {
      if (initialAttackIds.has(rider.id) || score < 60) return false;
      if (rider.form < 58 || rider.ratings.acceleration < 55) return false;
      if (favoriteTier === "major" && rider.role !== "free_agent") {
        return false;
      }
      return true;
    })
    .map(({ rider, favoriteTier }) => {
      const favoriteRank =
        strategy.favoriteRankByRiderId.get(rider.id) ??
        Number.POSITIVE_INFINITY;
      const outsiderBonus =
        favoriteRank > strategy.majorFavoriteCount &&
        favoriteRank <= strategy.outsiderFavoriteCount &&
        rider.form >= 70
          ? 10
          : 0;
      return {
        rider,
        reserveScore:
          rider.ratings.endurance * 0.31 +
          rider.ratings.breakaway * 0.29 +
          rider.ratings.acceleration * 0.24 +
          rider.form * 0.16 +
          (rider.role === "free_agent" ? 7 : 0) +
          (hasSpecialAbility(rider, "panache") ? 6 : 0) +
          outsiderBonus -
          (favoriteTier === "major" ? 18 : favoriteTier === "medium" ? 7 : 0) +
          random() * 6,
      };
    })
    .filter(({ reserveScore }) => reserveScore >= 64)
    .sort((first, second) => second.reserveScore - first.reserveScore);
  const canPlanLateAttack =
    totalDistanceKm >= 70 && reserveCandidates.length > 0 && random() < 0.68;
  const delayedAttackCount = canPlanLateAttack
    ? Math.min(
        3,
        reserveCandidates.length,
        Math.max(1, Math.ceil(riders.length / 28)),
      )
    : 0;
  const delayedAttackIds = new Set<string>();
  const delayedTeams = new Set<string>();

  for (const { rider } of reserveCandidates) {
    if (delayedAttackIds.size >= delayedAttackCount) break;
    if (delayedTeams.has(rider.teamId)) continue;
    delayedAttackIds.add(rider.id);
    delayedTeams.add(rider.teamId);
  }

  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const availableSegmentNumbers = new Set(
    segments.map((segment) => segment.segmentNumber),
  );
  const strategyAttackOrders = teamStrategies.flatMap((teamStrategy) =>
    teamStrategy.attackOrders
      .filter(
        (order) =>
          riderById.get(order.riderId)?.teamId === teamStrategy.teamId &&
          availableSegmentNumbers.has(order.segmentNumber),
      )
      .map((order) => ({ ...order, teamId: teamStrategy.teamId })),
  );

  return {
    initialAttackIds,
    delayedAttackIds,
    delayedAttackAtKm:
      delayedAttackIds.size > 0
        ? Math.max(0, totalDistanceKm - lateAttackWindow.remainingDistanceKm)
        : Number.POSITIVE_INFINITY,
    delayedAttackRequiresGroupedPeloton:
      delayedAttackIds.size > 0 && lateAttackWindow.requiresGroupedPeloton,
    strategyAttackOrders,
  };
}

function attemptPlannedStrategyAttacks({
  orders,
  states,
  segment,
  segmentIndex,
  segmentCount,
  completedDistanceKm,
  totalDistanceKm,
  teamStrategies,
  generalClassification,
  random,
  commentary,
}: {
  orders: Array<RaceAttackOrder & { teamId: string }>;
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  completedDistanceKm: number;
  totalDistanceKm: number;
  teamStrategies: RaceTeamStrategy[];
  generalClassification?: StageSimulationInput["generalClassification"];
  random: () => number;
  commentary: string[];
}) {
  if (orders.length === 0) return false;

  const strategiesByTeamId = new Map(
    teamStrategies.map((strategy) => [strategy.teamId, strategy]),
  );
  const successfulAttackers: RiderState[] = [];
  let strongestIntensity: RaceAttackOrder["intensity"] = "measured";

  for (const order of orders) {
    const state = states.get(order.riderId);
    if (
      !state ||
      state.rider.teamId !== order.teamId ||
      (state.group !== "peloton" && state.group !== "delayed") ||
      state.energy < getPlannedAttackMinimumEnergy(order.intensity) ||
      !isPlannedAttackConditionMet({
        order,
        state,
        states,
        segmentIndex,
        segmentCount,
        generalClassification,
      })
    ) {
      continue;
    }

    const strategy = strategiesByTeamId.get(order.teamId);
    const postureModifier =
      strategy?.collectivePosture === "aggressive"
        ? 0.08
        : strategy?.collectivePosture === "conservative"
          ? -0.07
          : 0;
    const intensityChance = {
      measured: 0.78,
      strong: 0.67,
      all_in: 0.56,
    }[order.intensity];
    const executionChance = clamp(
      intensityChance +
        postureModifier +
        (state.rider.ratings.acceleration - 68) * 0.004 +
        (state.rider.form - 65) * 0.002,
      0.28,
      0.92,
    );

    if (random() >= executionChance) continue;

    successfulAttackers.push(state);
    if (
      order.intensity === "all_in" ||
      (order.intensity === "strong" && strongestIntensity === "measured")
    ) {
      strongestIntensity = order.intensity;
    }
    state.energy = Math.max(
      0,
      state.energy -
        ({ measured: 2.2, strong: 3.8, all_in: 5.8 }[order.intensity] +
          random() * 1.2),
    );
  }

  if (successfulAttackers.length === 0) return false;

  const hasLeadingBreakaway = getStatesInGroup(states, "breakaway").length > 0;
  const initiativeSeconds =
    ({ measured: 8, strong: 13, all_in: 18 }[strongestIntensity] ?? 8) +
    random() * 12;

  for (const state of successfulAttackers) {
    state.group = hasLeadingBreakaway ? "chase" : "breakaway";
    state.groupSinceSegment = segmentIndex;
    state.elapsedTimeSeconds -= initiativeSeconds;
  }

  const remainingDistanceKm = Math.max(
    0,
    totalDistanceKm - completedDistanceKm,
  );
  commentary.push(
    formatRiderList(successfulAttackers) +
      " déclenchent l’attaque préparée sur le tronçon " +
      segment.segmentNumber +
      ", à " +
      Math.round(remainingDistanceKm) +
      " km de l’arrivée.",
  );

  return true;
}

function getPlannedAttackMinimumEnergy(
  intensity: RaceAttackOrder["intensity"],
) {
  return { measured: 18, strong: 28, all_in: 40 }[intensity];
}

function isPlannedAttackConditionMet({
  order,
  state,
  states,
  segmentIndex,
  segmentCount,
  generalClassification,
}: {
  order: RaceAttackOrder;
  state: RiderState;
  states: Map<string, RiderState>;
  segmentIndex: number;
  segmentCount: number;
  generalClassification?: StageSimulationInput["generalClassification"];
}) {
  if (order.condition === "always") return true;
  if (order.condition === "high_energy") return state.energy >= 58;
  if (order.condition === "leader_isolated") {
    return [...states.values()].some((candidate) => {
      if (
        candidate.rider.teamId === state.rider.teamId ||
        candidate.rider.role !== "leader" ||
        candidate.group !== state.group
      ) {
        return false;
      }

      const helpers = [...states.values()].filter(
        (helper) =>
          helper.rider.teamId === candidate.rider.teamId &&
          helper.rider.id !== candidate.rider.id &&
          helper.group === candidate.group &&
          (helper.rider.role === "domestique" ||
            helper.rider.role === "leadout" ||
            helper.rider.raceDuty === "protector" ||
            helper.rider.raceDuty === "lieutenant"),
      );
      return helpers.length <= 1;
    });
  }

  if (!generalClassification || generalClassification.length === 0) {
    return segmentIndex >= Math.floor(segmentCount * 0.68);
  }

  const generalTimes = new Map(
    generalClassification.map((entry) => [
      entry.riderId,
      entry.elapsedTimeSeconds,
    ]),
  );
  const leaderTime = Math.min(...generalTimes.values());
  const bestTeamTime = Math.min(
    ...[...states.values()]
      .filter((candidate) => candidate.rider.teamId === state.rider.teamId)
      .map(
        (candidate) =>
          generalTimes.get(candidate.rider.id) ?? Number.POSITIVE_INFINITY,
      ),
  );
  return bestTeamTime - leaderTime >= 20;
}

function buildStageStrategyContext(
  riders: RiderSimulationInput[],
  segments: RaceStageSegment[],
): StageStrategyContext {
  const rankedFavorites = [...riders]
    .map((rider) => ({
      rider,
      rating: getStageFavoriteRating(rider, segments),
    }))
    .sort(
      (first, second) =>
        second.rating - first.rating ||
        first.rider.id.localeCompare(second.rider.id),
    );
  const favoriteRankByRiderId = new Map(
    rankedFavorites.map(({ rider }, index) => [rider.id, index + 1]),
  );
  const majorFavoriteCount = Math.max(
    1,
    Math.min(3, Math.ceil(riders.length * 0.08)),
  );
  const mediumFavoriteCount = Math.max(
    majorFavoriteCount,
    Math.min(10, Math.ceil(riders.length * 0.22)),
  );
  const outsiderFavoriteCount = Math.max(
    mediumFavoriteCount,
    Math.min(20, Math.ceil(riders.length * 0.42)),
  );
  const strategies: StageTeamStrategy[] = [];
  const protectedRiderIds = new Set(
    riders
      .filter((rider) => rider.role === "leader" || rider.role === "sprinter")
      .map((rider) => rider.id),
  );

  for (const [teamId, teamRiders] of groupBy(riders, (rider) => rider.teamId)) {
    const rankedTeam = [...teamRiders].sort(
      (first, second) =>
        (favoriteRankByRiderId.get(first.id) ?? Number.POSITIVE_INFINITY) -
        (favoriteRankByRiderId.get(second.id) ?? Number.POSITIVE_INFINITY),
    );
    const bestRider = rankedTeam[0];
    const bestRank =
      favoriteRankByRiderId.get(bestRider.id) ?? Number.POSITIVE_INFINITY;
    const favoriteTier: StageFavoriteTier =
      bestRank <= majorFavoriteCount
        ? "major"
        : bestRank <= mediumFavoriteCount
          ? "medium"
          : "none";
    const teamProtectedIds = new Set<string>();

    if (favoriteTier !== "none") {
      teamProtectedIds.add(bestRider.id);
      protectedRiderIds.add(bestRider.id);
    }

    strategies.push({
      teamId,
      favoriteTier,
      protectedRiderIds: teamProtectedIds,
    });
  }

  return {
    favoriteTierByTeamId: new Map(
      strategies.map((strategy) => [strategy.teamId, strategy.favoriteTier]),
    ),
    protectedRiderIds,
    controllingTeamIds: new Set(
      strategies
        .filter((strategy) => strategy.favoriteTier !== "none")
        .map((strategy) => strategy.teamId),
    ),
    favoriteRankByRiderId,
    majorFavoriteCount,
    outsiderFavoriteCount,
  };
}

function getStageFavoriteRating(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[],
) {
  if (isLikelyMassSprint(segments)) {
    return (
      rider.ratings.sprint * 0.44 +
      rider.ratings.acceleration * 0.24 +
      rider.ratings.flat * 0.13 +
      rider.ratings.resistance * 0.09 +
      rider.form * 0.1 +
      (rider.role === "sprinter" ? 4 : 0)
    );
  }

  return (
    getStageSuitability(rider, segments) * 0.57 +
    getDecisiveRoadFinishRating(rider, segments) * 0.24 +
    rider.ratings.acceleration * 0.08 +
    rider.ratings.resistance * 0.06 +
    rider.form * 0.05 +
    (rider.role === "leader" ? 2 : 0)
  );
}

function getLateAttackWindow(
  segments: RaceStageSegment[],
  random: () => number,
) {
  const climbShare =
    segments.filter((segment) => segment.terrain === "climb").length /
    Math.max(1, segments.length);
  const cobbleShare =
    segments.filter((segment) => segment.surface === "cobbles").length /
    Math.max(1, segments.length);

  if (isLikelyMassSprint(segments) && climbShare < 0.2) {
    return {
      remainingDistanceKm: 36 + random() * 8,
      requiresGroupedPeloton: true,
    };
  }
  if (climbShare >= 0.2) {
    return {
      remainingDistanceKm: 10 + random() * 10,
      requiresGroupedPeloton: false,
    };
  }
  if (cobbleShare > 0) {
    return {
      remainingDistanceKm: 22 + random() * 13,
      requiresGroupedPeloton: false,
    };
  }
  return {
    remainingDistanceKm: 24 + random() * 12,
    requiresGroupedPeloton: false,
  };
}

export function getGeneralClassificationLeaderId(
  generalClassification?: StageSimulationInput["generalClassification"],
) {
  if (!generalClassification || generalClassification.length === 0) {
    return null;
  }

  return (
    [...generalClassification].sort(
      (first, second) =>
        first.elapsedTimeSeconds - second.elapsedTimeSeconds ||
        first.riderId.localeCompare(second.riderId),
    )[0]?.riderId ?? null
  );
}

export function getBreakawayGeneralClassificationThreat(
  breakawayRiderIds: string[],
  generalClassification:
    StageSimulationInput["generalClassification"] | undefined,
) {
  if (generalClassification === undefined) return 0.5;
  if (breakawayRiderIds.length === 0 || generalClassification.length === 0) {
    return 0;
  }

  const generalTimeByRiderId = new Map(
    generalClassification.map((entry) => [
      entry.riderId,
      entry.elapsedTimeSeconds,
    ]),
  );
  const generalLeaderTime = Math.min(...generalTimeByRiderId.values());
  const closestGeneralGap = Math.min(
    ...breakawayRiderIds.map((riderId) => {
      const time = generalTimeByRiderId.get(riderId);
      return time === undefined
        ? Number.POSITIVE_INFINITY
        : Math.max(0, time - generalLeaderTime);
    }),
  );

  return Number.isFinite(closestGeneralGap)
    ? clamp((9 * 60 - closestGeneralGap) / (8 * 60), 0, 1)
    : 0;
}

function getBreakawayThreat({
  breakaway,
  peloton,
  segments,
  fieldSize,
  gapSeconds,
  generalClassification,
  isStageRace,
}: {
  breakaway: RiderState[];
  peloton: RiderState[];
  segments: RaceStageSegment[];
  fieldSize: number;
  gapSeconds: number;
  generalClassification?: StageSimulationInput["generalClassification"];
  isStageRace: boolean;
}) {
  if (breakaway.length === 0) return 0;

  const breakawaySuitability = average(
    [...breakaway]
      .sort(
        (first, second) =>
          getStageSuitability(second.rider, segments) -
          getStageSuitability(first.rider, segments),
      )
      .slice(0, Math.min(3, breakaway.length))
      .map((state) => getStageSuitability(state.rider, segments)),
  );
  const pelotonContenders = [...peloton]
    .sort(
      (first, second) =>
        getStageSuitability(second.rider, segments) -
        getStageSuitability(first.rider, segments),
    )
    .slice(0, Math.max(1, Math.ceil(peloton.length * 0.25)));
  const pelotonReference = average(
    (pelotonContenders.length > 0 ? pelotonContenders : breakaway).map(
      (state) => getStageSuitability(state.rider, segments),
    ),
  );
  const suitabilityThreat = clamp(
    (breakawaySuitability - pelotonReference + 6) / 16,
    0,
    1,
  );
  const groupThreat = clamp(
    breakaway.length / Math.max(3, fieldSize * 0.2),
    0,
    1,
  );
  const gapThreat = clamp((gapSeconds - 45) / 285, 0, 1);
  const generalThreat = getBreakawayGeneralClassificationThreat(
    breakaway.map((state) => state.rider.id),
    generalClassification,
  );
  const protectedRoleThreat = breakaway.some(
    (state) => state.rider.role === "leader" || state.rider.role === "sprinter",
  )
    ? 0.1
    : 0;

  if (isStageRace) {
    return clamp(
      suitabilityThreat * 0.34 +
        groupThreat * 0.2 +
        gapThreat * 0.16 +
        generalThreat * 0.3 +
        protectedRoleThreat,
      0,
      1,
    );
  }

  return clamp(
    suitabilityThreat * 0.52 +
      groupThreat * 0.25 +
      gapThreat * 0.18 +
      protectedRoleThreat,
    0,
    1,
  );
}
function getGroupSegmentTime(
  states: RiderState[],
  segment: RaceStageSegment,
  group: "breakaway" | "peloton",
  chasePressure: number,
  random: () => number,
  paceSetterCandidates?: RiderState[],
) {
  if (states.length === 0) return 0;
  const scoringShare = group === "peloton" ? 0.42 : 0.72;
  const paceSetterPool =
    paceSetterCandidates && paceSetterCandidates.length > 0
      ? paceSetterCandidates
      : states;
  const paceSetters = getGroupPaceSetters(
    paceSetterPool,
    segment,
    paceSetterPool === states ? scoringShare : 0.72,
  );
  const groupRating = average(
    paceSetters.map((state) => getStateTerrainRating(state, segment)),
  );
  const paceSettersEnergy = average(paceSetters.map((state) => state.energy));
  const draftingBonus =
    group === "peloton"
      ? Math.min(0.095, Math.log2(states.length + 1) * 0.018)
      : Math.min(0.055, Math.log2(states.length + 1) * 0.013);
  const chaseBonus = group === "peloton" ? chasePressure * 0.055 : 0.018;
  const fatiguePenalty = Math.max(0, 30 - paceSettersEnergy) * 0.0035;
  const largeBreakawayPacePenalty =
    group === "breakaway"
      ? getLargeBreakawayDynamics(states.length).pacePenalty
      : 0;
  const speed = Math.max(
    8,
    getBaseSpeed(segment) *
      (0.69 +
        groupRating * 0.0029 +
        draftingBonus +
        chaseBonus -
        fatiguePenalty -
        largeBreakawayPacePenalty +
        (random() - 0.5) * 0.012),
  );

  return (segment.distanceKm / speed) * 3_600;
}

function getGroupPaceSetters(
  states: RiderState[],
  segment: RaceStageSegment,
  scoringShare: number,
) {
  const ridersAbleToSetPace = states.filter((state) => state.energy >= 18);
  const candidates =
    ridersAbleToSetPace.length > 0 ? ridersAbleToSetPace : states;
  const scoringCount = Math.max(
    1,
    Math.min(candidates.length, Math.ceil(states.length * scoringShare)),
  );

  return [...candidates]
    .sort(
      (first, second) =>
        getStateTerrainRating(second, segment) +
        second.rider.ratings.endurance * 0.08 -
        (getStateTerrainRating(first, segment) +
          first.rider.ratings.endurance * 0.08),
    )
    .slice(0, scoringCount);
}

function updateRiderEnergy({
  state,
  segment,
  segmentIndex,
  segmentCount,
  groupSize,
  chasePressure,
  frontBreakawaySize = 0,
  frontGroupIsYielding = false,
  frontGroupIsUncontested = false,
  hasBottleCarrierSupport,
  leaderProtectionStrength = 0,
  protectingLeader = false,
  pelotonWorker = false,
  groupPaceRating,
  profileType,
  hillyClimbLoad = 0,
  timeTrial = false,
}: {
  state: RiderState;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  groupSize: number;
  chasePressure: number;
  frontBreakawaySize?: number;
  frontGroupIsYielding?: boolean;
  frontGroupIsUncontested?: boolean;
  hasBottleCarrierSupport: boolean;
  leaderProtectionStrength?: number;
  protectingLeader?: boolean;
  pelotonWorker?: boolean;
  groupPaceRating?: number;
  profileType?: RaceProfileType;
  hillyClimbLoad?: number;
  timeTrial?: boolean;
}) {
  const rider = state.rider;
  const terrainLoad =
    segment.terrain === "climb"
      ? 1 + Math.abs(segment.averageGradientPct) / 8
      : segment.surface === "cobbles"
        ? 1.28
        : segment.terrain === "descent"
          ? 0.62
          : 0.9;
  const isWorking =
    timeTrial ||
    state.group === "breakaway" ||
    state.group === "breakaway_2" ||
    state.group === "chase" ||
    state.group === "delayed" ||
    (pelotonWorker &&
      (rider.role === "domestique" || rider.role === "leadout") &&
      segmentIndex < segmentCount - 2 &&
      chasePressure > 0.35) ||
    (rider.raceDuty === "danger_pacer" && chasePressure > 0.34) ||
    ((rider.raceDuty === "protector" || rider.raceDuty === "lieutenant") &&
      protectingLeader);
  const largeBreakawayEffortMultiplier =
    frontBreakawaySize > LARGE_BREAKAWAY_RIDER_THRESHOLD &&
    !frontGroupIsYielding &&
    !frontGroupIsUncontested &&
    (state.group === "breakaway" ||
      state.group === "breakaway_2" ||
      state.group === "chase" ||
      (state.group === "peloton" && isWorking))
      ? LARGE_BREAKAWAY_EFFORT_MULTIPLIER
      : 1;
  const baseGroupShelter = timeTrial
    ? 1
    : state.group === "peloton"
      ? Math.max(0.55, 0.77 - Math.log2(groupSize + 1) * 0.035)
      : state.group === "breakaway" ||
          state.group === "breakaway_2" ||
          state.group === "chase" ||
          state.group === "delayed"
        ? Math.max(0.74, 0.93 - Math.log2(groupSize + 1) * 0.035)
        : 0.88;
  const draftingRelevance =
    segment.terrain === "climb"
      ? clamp(0.8 - Math.abs(segment.averageGradientPct) / 10, 0.18, 0.55)
      : segment.terrain === "descent"
        ? 1
        : 0.95;
  const groupShelter = timeTrial
    ? 1
    : 1 - (1 - baseGroupShelter) * draftingRelevance;
  const breakawayCanSaveEnergy =
    frontGroupIsYielding &&
    (state.group === "breakaway" || state.group === "breakaway_2");
  const workFactor =
    state.group === "breakaway" ||
    state.group === "breakaway_2" ||
    state.group === "chase" ||
    state.group === "delayed"
      ? breakawayCanSaveEnergy
        ? 0.9
        : 1.48
      : isWorking
        ? 1.2
        : protectingLeader
          ? 1.06
          : 0.86;
  const enduranceFactor = 1.2 - rider.ratings.endurance / 300;
  const longEffortFactor =
    1 + (segmentIndex / Math.max(1, segmentCount - 1)) * 0.22;
  const riderTerrainRating =
    (profileType
      ? getSelectionTerrainRating(
          rider,
          segment,
          profileType,
          hillyClimbLoad,
        )
      : getTerrainRating(rider, segment)) +
    state.raceDayExecutionBonus * 0.65 -
    state.injuryPerformancePenalty;
  const terrainDeficit = Math.max(
    0,
    (groupPaceRating ?? riderTerrainRating) - riderTerrainRating,
  );
  const paceSustainabilityFactor =
    1 + terrainDeficit * (segment.terrain === "climb" ? 0.025 : 0.015);
  let abilityFactor = 1;

  if (
    hasSpecialAbility(rider, "flahute") &&
    (segmentIndex > segmentCount * 0.45 || terrainLoad > 1.25)
  ) {
    abilityFactor *= 0.88;
  }
  if (hasSpecialAbility(rider, "locomotive") && isWorking) {
    abilityFactor *= 0.84;
  }

  const teamSupport = hasBottleCarrierSupport ? 0.97 : 1;
  const loss =
    (segment.distanceKm / 10) *
    (2.05 + terrainLoad * 1.18) *
    groupShelter *
    workFactor *
    largeBreakawayEffortMultiplier *
    enduranceFactor *
    longEffortFactor *
    paceSustainabilityFactor *
    abilityFactor *
    teamSupport *
    (1 + state.injuryPerformancePenalty * 0.035) *
    (1 - clamp(leaderProtectionStrength * 1.35, 0, 0.3));

  if (segment.terrain === "descent" && !timeTrial) {
    const recoveryCeiling = clamp(
      rider.form - state.injuryPerformancePenalty * 1.25,
      5,
      100,
    );
    const groupRecoveryFactor =
      state.group === "peloton"
        ? 1
        : state.group === "breakaway" ||
            state.group === "breakaway_2" ||
            state.group === "chase"
          ? 0.68
          : 0.82;
    const workloadRecoveryFactor = isWorking ? 0.68 : 1;
    const recoveryGain =
      ((segment.distanceKm / 10) *
        (0.65 +
          (rider.ratings.downhill / 100) * 0.65 +
          (rider.ratings.recovery / 100) * 0.45) *
        groupRecoveryFactor *
        workloadRecoveryFactor) /
      largeBreakawayEffortMultiplier /
      (1 + state.injuryPerformancePenalty * 0.04);

    return clamp(state.energy + recoveryGain, 0, recoveryCeiling);
  }

  return clamp(state.energy - loss, 0, 100);
}

function hasTeammateBottleCarrier(
  state: RiderState,
  states: Map<string, RiderState>,
) {
  return [...states.values()].some(
    (teammate) =>
      teammate.rider.id !== state.rider.id &&
      teammate.rider.teamId === state.rider.teamId &&
      teammate.group === state.group &&
      hasSpecialAbility(teammate.rider, "bottle_carrier"),
  );
}

function getLeaderProtectionStrength({
  state,
  states,
  segment,
  segmentIndex,
  segmentCount,
}: {
  state: RiderState;
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
}) {
  if (
    state.rider.role !== "leader" ||
    (state.group !== "peloton" && state.group !== "delayed")
  ) {
    return 0;
  }

  const helpers = [...states.values()].filter(
    (teammate) =>
      teammate.rider.id !== state.rider.id &&
      teammate.rider.teamId === state.rider.teamId &&
      teammate.group === state.group &&
      teammate.energy >= 12 &&
      (teammate.rider.role === "domestique" ||
        teammate.rider.role === "leadout" ||
        teammate.rider.raceDuty === "protector" ||
        teammate.rider.raceDuty === "lieutenant"),
  );
  if (helpers.length === 0) return 0;

  const gradient = Math.abs(segment.averageGradientPct);
  const terrainRelevance =
    segment.surface === "cobbles"
      ? 0.78
      : segment.terrain === "climb"
        ? clamp(1 - Math.max(0, gradient - 3) / 9, 0.32, 0.88)
        : 1;
  const raceProgress = segmentIndex / Math.max(1, segmentCount - 1);
  const progressRelevance = clamp(
    1 - Math.max(0, raceProgress - 0.68) * 1.4,
    0.48,
    1,
  );
  const helperQuality = average(
    helpers.map(
      (helper) =>
        helper.energy * 0.55 +
        helper.rider.ratings.endurance * 0.25 +
        helper.rider.ratings.resistance * 0.2 +
        (helper.rider.raceDuty === "protector"
          ? 12
          : helper.rider.raceDuty === "lieutenant"
            ? 12
            : 0),
    ),
  );

  return clamp(
    helpers.length *
      0.045 *
      clamp(helperQuality / 65, 0.72, 1.18) *
      terrainRelevance *
      progressRelevance,
    0,
    0.27,
  );
}

function isProtectingTeamLeader({
  state,
  states,
  segmentIndex,
  segmentCount,
}: {
  state: RiderState;
  states: Map<string, RiderState>;
  segmentIndex: number;
  segmentCount: number;
}) {
  if (
    state.rider.role !== "domestique" &&
    state.rider.role !== "leadout" &&
    state.rider.raceDuty !== "protector" &&
    state.rider.raceDuty !== "lieutenant"
  ) {
    return false;
  }
  if (segmentIndex >= segmentCount - 1 || state.energy < 10) {
    return false;
  }

  return [...states.values()].some(
    (teammate) =>
      teammate.rider.teamId === state.rider.teamId &&
      teammate.rider.role === "leader" &&
      teammate.group === state.group,
  );
}
function dropStrugglingRiders({
  states,
  segment,
  segmentIndex,
  segmentCount,
  raceDistanceProgress,
  profileType,
  chasePressure,
  hillyClimbLoad,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  raceDistanceProgress: number;
  profileType: RaceProfileType;
  chasePressure: number;
  hillyClimbLoad: number;
  random: () => number;
  commentary: string[];
}) {
  if (segmentIndex === 0 || segment.terrain === "descent") return;
  const peloton = getStatesInGroup(states, "peloton");
  if (peloton.length < 4) return;

  const isSelectiveTerrain =
    segment.terrain === "climb" || segment.surface === "cobbles";
  if (!isSelectiveTerrain) {
    // Les cassures sur le plat viennent des bordures et incidents dédiés :
    // une simple note de plaine faible ne suffit pas à sortir du peloton.
    return;
  }

  const selectionDifficulty = getSegmentSelectionDifficulty(
    segment,
    profileType,
    hillyClimbLoad,
  );
  const ranked = [...peloton].sort(
    (first, second) =>
      getStateSelectionTerrainRating(
        second,
        segment,
        profileType,
        hillyClimbLoad,
      ) -
      getStateSelectionTerrainRating(
        first,
        segment,
        profileType,
        hillyClimbLoad,
      ),
  );
  const frontRiders = ranked.slice(
    0,
    Math.max(2, Math.ceil(ranked.length * 0.2)),
  );
  const frontTerrainRating = average(
    frontRiders.map((state) =>
      getStateSelectionTerrainRating(
        state,
        segment,
        profileType,
        hillyClimbLoad,
      ),
    ),
  );
  const frontResistance = average(
    frontRiders.map((state) => state.rider.ratings.resistance),
  );
  const frontEnergy = average(frontRiders.map((state) => state.energy));
  const tolerance =
    segment.surface === "cobbles"
      ? 5.5
      : profileType === "mountain"
        ? 4.5
        : profileType === "hilly"
          ? 6.5
          : 5.5;
  const initialPelotonCohesion = clamp(
    (0.3 - raceDistanceProgress) / 0.3,
    0,
    1,
  );
  const earlyTerrainTolerance =
    initialPelotonCohesion * (profileType === "mountain" ? 5 : 6.5);
  const lateRaceSelectivity =
    clamp((raceDistanceProgress - 0.62) / 0.38, 0, 1) *
    (profileType === "mountain" ? 2.4 : profileType === "hilly" ? 1.4 : 0.8);

  for (const state of peloton) {
    const isMeaningfulDifficulty =
      selectionDifficulty >= 0.68 + initialPelotonCohesion * 0.08 ||
      state.energy < 8;
    if (!isMeaningfulDifficulty) continue;

    const terrainDeficit =
      frontTerrainRating -
      getStateSelectionTerrainRating(
        state,
        segment,
        profileType,
        hillyClimbLoad,
      );
    const secondarySupport =
      Math.max(0, state.rider.ratings.resistance - frontResistance) * 0.12 +
      Math.max(0, state.energy - frontEnergy) * 0.06;
    const leaderProtectionStrength = getLeaderProtectionStrength({
      state,
      states,
      segment,
      segmentIndex,
      segmentCount,
    });
    const leaderProtection =
      state.rider.role === "leader" ? 1.5 + leaderProtectionStrength * 22 : 0;
    const freshRiderProtection =
      clamp((state.energy - 24) / 38, 0, 1) *
      (selectionDifficulty < 0.9 ? 3.5 : 1.5);
    const fatiguePenalty = Math.max(0, 22 - state.energy) * 0.12;
    const effectiveDeficit =
      terrainDeficit -
      secondarySupport -
      leaderProtection -
      freshRiderProtection +
      fatiguePenalty;
    const difficultyTolerance = clamp((0.9 - selectionDifficulty) * 5, 0, 4);
    const ruptureThreshold =
      tolerance +
      difficultyTolerance +
      earlyTerrainTolerance +
      random() * 2.5 -
      lateRaceSelectivity;
    const minimumReserveToFollow = Math.max(
      2.5,
      3 +
        selectionDifficulty * 5 +
        chasePressure * (1 + selectionDifficulty * 3) +
        Math.max(0, terrainDeficit) * 0.12 -
        leaderProtectionStrength * 12 +
        lateRaceSelectivity * 0.8 -
        initialPelotonCohesion * 3,
    );
    const losesContactFromExhaustion =
      state.energy < minimumReserveToFollow &&
      (selectionDifficulty >= 0.55 || state.energy < 3.5) &&
      random() > 0.08;
    const exceptionalHoldChance = clamp(
      0.07 - Math.max(0, effectiveDeficit - tolerance) * 0.008,
      0.015,
      0.05,
    );
    const exceptionallyHoldsOn =
      effectiveDeficit > ruptureThreshold &&
      effectiveDeficit < 17 &&
      random() < exceptionalHoldChance;

    if (
      state.energy < 3.5 ||
      losesContactFromExhaustion ||
      (effectiveDeficit > ruptureThreshold && !exceptionallyHoldsOn)
    ) {
      const immediateLossSeconds =
        5 +
        selectionDifficulty * 10 +
        Math.max(0, effectiveDeficit) * (1.8 + selectionDifficulty * 1.7);
      state.group = "dropped";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += immediateLossSeconds;
      state.elapsedTimeSeconds += immediateLossSeconds;
      if (commentary.length < 4) {
        commentary.push(
          `${state.rider.name} cède dans la difficulté après avoir épuisé ses réserves et bascule parmi les attardés.`,
        );
      }
    } else if (exceptionallyHoldsOn && commentary.length < 4) {
      commentary.push(
        `${state.rider.name} est à la limite mais s’accroche au groupe de tête.`,
      );
    }
  }
}

function maybeLaunchCounterAttack({
  states,
  segmentIndex,
  completedDistanceKm,
  totalDistanceKm,
  breakawayGapSeconds,
  chasePressure,
  strategy,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segmentIndex: number;
  completedDistanceKm: number;
  totalDistanceKm: number;
  breakawayGapSeconds: number;
  chasePressure: number;
  strategy: StageStrategyContext;
  random: () => number;
  commentary: string[];
}) {
  const progress = completedDistanceKm / Math.max(1, totalDistanceKm);
  if (
    progress < 0.12 ||
    progress > 0.72 ||
    breakawayGapSeconds < 35 ||
    breakawayGapSeconds > 210 ||
    chasePressure > 0.58
  ) {
    return false;
  }

  const candidate = getStatesInGroup(states, "peloton")
    .filter((state) => {
      const rider = state.rider;
      if (
        strategy.protectedRiderIds.has(rider.id) ||
        rider.role === "leader" ||
        rider.role === "sprinter" ||
        state.energy < 28
      ) {
        return false;
      }
      return (
        hasSpecialAbility(rider, "chase_potato") ||
        hasSpecialAbility(rider, "panache") ||
        rider.role === "free_agent" ||
        (rider.ratings.breakaway >= 66 && rider.ratings.acceleration >= 60)
      );
    })
    .map((state) => {
      const favoriteTier =
        strategy.favoriteTierByTeamId.get(state.rider.teamId) ?? "none";
      return {
        state,
        favoriteTier,
        score:
          state.rider.ratings.acceleration * 0.34 +
          state.rider.ratings.breakaway * 0.36 +
          state.rider.ratings.endurance * 0.12 +
          state.rider.form * 0.1 +
          state.energy * 0.08 +
          (hasSpecialAbility(state.rider, "chase_potato") ? 8 : 0) +
          (hasSpecialAbility(state.rider, "panache") ? 5 : 0) -
          (favoriteTier === "major" ? 16 : favoriteTier === "medium" ? 7 : 0),
      };
    })
    .sort((first, second) => second.score - first.score)[0];

  if (!candidate) return false;

  const launchChance = clamp(
    0.08 +
      (candidate.state.rider.role === "free_agent" ? 0.08 : 0) +
      (hasSpecialAbility(candidate.state.rider, "chase_potato") ? 0.17 : 0) +
      (hasSpecialAbility(candidate.state.rider, "panache") ? 0.08 : 0) +
      Math.max(0, candidate.state.rider.form - 72) * 0.006 -
      (candidate.favoriteTier === "major"
        ? 0.08
        : candidate.favoriteTier === "medium"
          ? 0.03
          : 0),
    0.05,
    0.42,
  );

  if (random() >= launchChance) return false;

  candidate.state.group = "chase";
  candidate.state.groupSinceSegment = segmentIndex;
  candidate.state.elapsedTimeSeconds -= Math.min(
    18,
    breakawayGapSeconds * 0.18,
  );
  commentary.push(
    hasSpecialAbility(candidate.state.rider, "chase_potato")
      ? candidate.state.rider.name +
          " profite d’un temps mort et part seul en chasse-patate."
      : candidate.state.rider.name +
          " profite d’un peloton encore attentiste pour tenter de rejoindre la tête.",
  );
  return true;
}

function maybeLaunchDecisiveFavoriteAttack({
  states,
  segment,
  segmentIndex,
  segmentCount,
  profileType,
  likelyMassSprint,
  hillyClimbLoad,
  strategy,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  profileType: RaceProfileType;
  likelyMassSprint: boolean;
  hillyClimbLoad: number;
  strategy: StageStrategyContext;
  random: () => number;
  commentary: string[];
}) {
  const raceProgress = (segmentIndex + 1) / Math.max(1, segmentCount);
  const selectiveTerrain =
    segment.terrain === "climb" || segment.surface === "cobbles";
  if (
    raceProgress < 0.58 ||
    (likelyMassSprint && profileType !== "cobbles") ||
    (!selectiveTerrain && profileType !== "hilly")
  ) {
    return false;
  }

  const candidate = getStatesInGroup(states, "peloton")
    .flatMap((state) => {
      const favoriteRank =
        strategy.favoriteRankByRiderId.get(state.rider.id) ??
        Number.POSITIVE_INFINITY;
      if (
        favoriteRank <= 1 ||
        favoriteRank > strategy.outsiderFavoriteCount ||
        state.energy < 22 ||
        state.decisiveAttackBonus > 0 ||
        state.injuryPerformancePenalty >= 8 ||
        (state.rider.role !== "leader" &&
          !strategy.protectedRiderIds.has(state.rider.id))
      ) {
        return [];
      }

      const terrainRating = getStateSelectionTerrainRating(
        state,
        segment,
        profileType,
        hillyClimbLoad,
      );
      const challengerInitiative = Math.min(3, (favoriteRank - 1) * 0.45);
      const score =
        terrainRating * 0.34 +
        state.rider.ratings.acceleration * 0.27 +
        state.energy * 0.17 +
        state.rider.ratings.resistance * 0.08 +
        getRiderExperienceRaceBonus(state.rider.careerRaceDays ?? 0) * 2.4 +
        state.raceDayExecutionBonus * 0.55 +
        challengerInitiative +
        (hasSpecialAbility(state.rider, "giclette") ? 5 : 0) +
        (hasSpecialAbility(state.rider, "panache") ? 3 : 0) +
        random() * 5;

      return [{ state, favoriteRank, score, terrainRating }];
    })
    .sort((first, second) => second.score - first.score)[0];

  if (!candidate) return false;

  const launchChance = clamp(
    0.13 +
      (selectiveTerrain ? 0.08 : 0) +
      Math.max(0, candidate.state.rider.ratings.acceleration - 70) * 0.007 +
      Math.min(0.08, (candidate.favoriteRank - 1) * 0.012) +
      (hasSpecialAbility(candidate.state.rider, "giclette") ? 0.08 : 0) +
      (hasSpecialAbility(candidate.state.rider, "panache") ? 0.06 : 0) +
      Math.max(0, candidate.state.raceDayExecutionBonus) * 0.012,
    0.12,
    0.52,
  );
  if (random() >= launchChance) return false;

  const timingQuality =
    candidate.terrainRating * 0.38 +
    candidate.state.rider.ratings.acceleration * 0.34 +
    candidate.state.energy * 0.18 +
    candidate.state.rider.ratings.resistance * 0.1;
  candidate.state.decisiveAttackBonus = clamp(
    1.2 +
      Math.max(0, timingQuality - 66) * 0.07 +
      Math.max(0, candidate.state.raceDayExecutionBonus) * 0.22 +
      random() * 1.8,
    1.2,
    4.5,
  );
  candidate.state.energy = clamp(
    candidate.state.energy - (3.2 + random() * 2.3),
    0,
    100,
  );
  commentary.push(
    `${candidate.state.rider.name}, favori n°${candidate.favoriteRank}, refuse d’attendre et place une attaque dans le final.`,
  );
  return true;
}

function resolveExistingChasers({
  states,
  segmentIndex,
  breakawayGapSeconds,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segmentIndex: number;
  breakawayGapSeconds: number;
  random: () => number;
  commentary: string[];
}) {
  const peloton = getStatesInGroup(states, "peloton");
  const pelotonTime = average(peloton.map((state) => state.elapsedTimeSeconds));

  for (const state of getStatesInGroup(states, "chase")) {
    if (state.groupSinceSegment >= segmentIndex) continue;

    const bridgeScore =
      state.rider.ratings.breakaway * 0.42 +
      state.rider.ratings.acceleration * 0.34 +
      state.energy * 0.24 +
      (hasSpecialAbility(state.rider, "chase_potato") ? 11 : 0) +
      random() * 10;

    if (
      breakawayGapSeconds > 0 &&
      breakawayGapSeconds < 150 &&
      bridgeScore > 77
    ) {
      state.group = "breakaway_2";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 8;
      commentary.push(
        `${state.rider.name} se rapproche de l’échappée, mais reste dans un groupe intercalé.`,
      );
    } else if (random() < 0.66) {
      state.group = "peloton";
      state.groupSinceSegment = segmentIndex;
      state.elapsedTimeSeconds = Math.max(
        state.elapsedTimeSeconds,
        pelotonTime,
      );
    } else {
      state.group = "dropped";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 10 + random() * 12;
    }
  }
}

function resolveDelayedRiders({
  states,
  segment,
  segmentIndex,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  random: () => number;
  commentary: string[];
}) {
  const peloton = getStatesInGroup(states, "peloton");
  if (peloton.length === 0) return;

  const pelotonTime = average(peloton.map((state) => state.elapsedTimeSeconds));
  const rejoined: RiderState[] = [];

  for (const state of getStatesInGroup(states, "delayed")) {
    if (state.groupSinceSegment >= segmentIndex) continue;

    const gapSeconds = Math.max(0, state.elapsedTimeSeconds - pelotonTime);
    const catchUpScore =
      getStateTerrainRating(state, segment) * 0.45 +
      state.rider.ratings.flat * 0.15 +
      state.rider.ratings.acceleration * 0.15 +
      state.rider.ratings.resistance * 0.15 +
      state.energy * 0.1;
    const recoveredSeconds = Math.min(
      gapSeconds,
      clamp(2 + (catchUpScore - 50) * 0.15 + random() * 4, 1, 12),
    );
    const remainingGapSeconds = Math.max(0, gapSeconds - recoveredSeconds);

    state.elapsedTimeSeconds = pelotonTime + remainingGapSeconds;
    state.lostTimeSeconds = Math.max(
      0,
      state.lostTimeSeconds - recoveredSeconds,
    );

    if (remainingGapSeconds <= 3) {
      state.group = "peloton";
      state.groupSinceSegment = segmentIndex;
      state.elapsedTimeSeconds = pelotonTime;
      state.lostTimeSeconds = 0;
      rejoined.push(state);
    }
  }

  if (rejoined.length > 0 && commentary.length < 4) {
    commentary.push(
      `${formatRiderList(rejoined)} recollent au peloton apr\u00e8s leur poursuite.`,
    );
  }
}

function maybeSplitBreakaway({
  states,
  segment,
  segmentIndex,
  random,
  commentary,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  random: () => number;
  commentary: string[];
}) {
  const breakaway = getStatesInGroup(states, "breakaway");
  if (
    segmentIndex < 3 ||
    breakaway.length < 3 ||
    getStatesInGroup(states, "breakaway_2").length > 0
  ) {
    return;
  }

  const selectiveTerrain =
    segment.terrain === "climb" || segment.surface === "cobbles";
  const tiredRiders = breakaway.filter((state) => state.energy < 24);

  if (tiredRiders.length === 0 && (!selectiveTerrain || random() > 0.42)) {
    return;
  }

  const splitCount = Math.min(2, Math.max(1, Math.floor(breakaway.length / 3)));
  const detached = [...breakaway]
    .sort(
      (first, second) =>
        first.energy +
        getStateTerrainRating(first, segment) * 0.45 -
        (second.energy + getStateTerrainRating(second, segment) * 0.45),
    )
    .slice(0, splitCount);

  for (const state of detached) {
    state.group = "breakaway_2";
    state.groupSinceSegment = segmentIndex;
    state.lostTimeSeconds += 10 + random() * 14;
  }

  commentary.push(
    `${formatRiderList(detached)} lâchent prise : l’échappée se scinde en deux groupes.`,
  );
}

function promoteSecondaryBreakawayWhenNeeded(
  states: Map<string, RiderState>,
  segmentIndex: number,
) {
  if (getStatesInGroup(states, "breakaway").length > 0) {
    return;
  }

  const secondary = getStatesInGroup(states, "breakaway_2").sort(
    (first, second) => second.energy - first.energy,
  );
  const newLeader = secondary[0];

  if (newLeader) {
    newLeader.group = "breakaway";
    newLeader.groupSinceSegment = segmentIndex;
  }
}

function maybeCreateRaceIncident({
  states,
  segment,
  segmentIndex,
  segmentCount,
  weather,
  protectedRiderId,
  random,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  weather: RaceWeather;
  protectedRiderId: string | null;
  random: () => number;
}): {
  incident: RaceIncident;
  abandonments: RaceAbandonment[];
  injuries: RaceInjury[];
  commentary: string;
} | null {
  if (segmentIndex < 2 || segmentIndex >= segmentCount - 1) {
    return null;
  }

  const activeStates = [...states.values()].filter(
    (state) => state.group !== "dropped" && state.group !== "abandoned",
  );
  if (activeStates.length === 0) return null;

  const incidentRoll = random();
  const rainCrashRisk = getRaceWeatherCrashRiskBonus(weather);
  const punctureThreshold =
    (segment.surface === "cobbles" ? 0.105 : 0.065) + rainCrashRisk * 0.25;
  const individualCrashThreshold = punctureThreshold + 0.045 + rainCrashRisk;
  const massCrashThreshold =
    individualCrashThreshold + 0.028 + rainCrashRisk * 0.55;
  const crosswindRisk = getRaceCrosswindIncidentRisk(
    weather,
    segment.terrain === "flat",
  );
  const crosswindThreshold = massCrashThreshold + crosswindRisk;

  let type: RaceIncidentType;
  if (incidentRoll < punctureThreshold) {
    type = "puncture";
  } else if (incidentRoll < individualCrashThreshold) {
    type = "crash_individual";
  } else if (incidentRoll < massCrashThreshold) {
    type = "crash_mass";
  } else if (incidentRoll < crosswindThreshold) {
    type = "crosswind";
  } else {
    return null;
  }

  const peloton = getStatesInGroup(states, "peloton");
  if (type === "crosswind" && peloton.length < 4) {
    return null;
  }
  if (
    (type === "crash_individual" || type === "crash_mass") &&
    activeStates.length <= 1
  ) {
    return null;
  }
  let affected: RiderState[];

  if (type === "crash_mass" || type === "crosswind") {
    const candidates = peloton.length >= 4 ? peloton : activeStates;
    const maximumAffectedCount = Math.max(1, candidates.length - 1);
    const affectedCount = Math.min(
      maximumAffectedCount,
      type === "crash_mass"
        ? 3 + Math.floor(random() * 4)
        : 2 + Math.floor(random() * 4),
    );

    const holdingScoreByRiderId = new Map(
      candidates.map((state) => [
        state.rider.id,
        type === "crosswind"
          ? getCrosswindHoldingScore(state, candidates, protectedRiderId) +
            random() * 7
          : state.rider.ratings.flat * 0.55 +
            state.rider.ratings.resistance * 0.45 +
            getDesignatedProtectionBonus(state, candidates) +
            random() * 10,
      ]),
    );
    affected = [...candidates]
      .sort(
        (first, second) =>
          (holdingScoreByRiderId.get(first.rider.id) ?? 0) -
          (holdingScoreByRiderId.get(second.rider.id) ?? 0),
      )
      .slice(0, affectedCount);
  } else if (type === "crash_individual") {
    affected = [
      activeStates
        .map((state) => ({
          state,
          exposure:
            random() * 20 - getDesignatedProtectionBonus(state, activeStates),
        }))
        .sort((first, second) => second.exposure - first.exposure)[0].state,
    ];
  } else {
    affected = [activeStates[Math.floor(random() * activeStates.length)]];
  }

  const abandonments: RaceAbandonment[] = [];
  const injuries: RaceInjury[] = [];

  for (const state of affected) {
    let timeLossSeconds: number;

    if (type === "puncture") {
      state.energy = clamp(state.energy - 1.5, 0, 100);
      timeLossSeconds = 12 + random() * 12;
    } else if (type === "crosswind") {
      state.energy = clamp(state.energy - 2.5, 0, 100);
      timeLossSeconds = 9 + random() * 10;
    } else {
      state.energy = clamp(
        state.energy - (type === "crash_mass" ? 6 : 4),
        0,
        100,
      );
      timeLossSeconds = (type === "crash_mass" ? 18 : 14) + random() * 16;
    }

    if (type === "puncture") {
      timeLossSeconds = reduceMechanicalIncidentTimeLoss(
        timeLossSeconds,
        state.rider.mechanicalIncidentTimeReductionPct ?? 0,
      );
    }

    state.lostTimeSeconds += timeLossSeconds;
    state.elapsedTimeSeconds += timeLossSeconds;

    const crashMedicalResult =
      type === "crash_individual" || type === "crash_mass"
        ? maybeCreateCrashMedicalResult(state, segmentIndex, random)
        : null;

    if (crashMedicalResult?.injury) {
      injuries.push(crashMedicalResult.injury);
      if (!crashMedicalResult.abandonment) {
        const inRaceImpact = getRaceInjuryInRaceImpact({
          energy: state.energy,
          currentPenalty: state.injuryPerformancePenalty,
          severity: crashMedicalResult.injury.severity,
        });
        state.energy = inRaceImpact.energyAfter;
        state.injuryPerformancePenalty = inRaceImpact.performancePenalty;
      }
    }

    if (crashMedicalResult?.abandonment) {
      abandonments.push(crashMedicalResult.abandonment);
      state.group = "abandoned";
      state.energy = 0;
    } else if (state.group === "breakaway") {
      state.group = "breakaway_2";
    } else if (state.group === "peloton" || state.group === "delayed") {
      state.group = "delayed";
    } else if (state.group !== "breakaway_2" && state.group !== "chase") {
      state.group = "chase";
    }
    state.groupSinceSegment = segmentIndex;
  }

  const affectedNames = formatRiderList(affected);
  const details = {
    puncture: {
      label: `Crevaison · ${affected[0].rider.name}`,
      commentary: `Crevaison pour ${affected[0].rider.name}, contraint de chasser pour retrouver son groupe.`,
    },
    crosswind: {
      label: `Bordure · ${affected.length} piégés`,
      commentary: `Le vent provoque une bordure : ${affectedNames} sont piégés derrière une cassure.`,
    },
    crash_individual: {
      label: `Chute · ${affected[0].rider.name}`,
      commentary: `${affected[0].rider.name} chute seul et repart avec du retard.`,
    },
    crash_mass: {
      label: `Chute massive · ${affected.length} coureurs`,
      commentary: `Chute massive dans le peloton : ${affectedNames} sont retardés.`,
    },
  } satisfies Record<RaceIncidentType, { label: string; commentary: string }>;

  return {
    incident: {
      id: `${segmentIndex + 1}-${type}-${affected
        .map((state) => state.rider.id)
        .join("-")}`,
      type,
      riderIds: affected.map((state) => state.rider.id),
      abandonedRiderIds: abandonments.map((abandonment) => abandonment.riderId),
      label: abandonments.length
        ? `${details[type].label} · ${abandonments.length} abandon${
            abandonments.length > 1 ? "s" : ""
          }`
        : details[type].label,
    },
    abandonments,
    injuries,
    commentary: abandonments.length
      ? `${details[type].commentary} ${formatRiderList(
          abandonments.map((abandonment) => states.get(abandonment.riderId)!),
        )} ${abandonments.length > 1 ? "abandonnent" : "abandonne"}, sur blessure.`
      : injuries.length
        ? `${details[type].commentary} ${formatRiderList(
            injuries.map((injury) => states.get(injury.riderId)!),
          )} ${injuries.length > 1 ? "repartent diminués" : "repart diminué"} malgré une blessure diagnostiquée.`
        : details[type].commentary,
  };
}

function getDesignatedProtectionBonus(
  state: RiderState,
  activeStates: RiderState[],
) {
  if (state.rider.role !== "leader") return 0;

  return activeStates.reduce((bonus, teammate) => {
    if (
      teammate.rider.teamId !== state.rider.teamId ||
      teammate.rider.id === state.rider.id ||
      teammate.group !== state.group ||
      teammate.energy < 12
    ) {
      return bonus;
    }
    if (teammate.rider.raceDuty === "protector") return bonus + 22;
    if (teammate.rider.raceDuty === "lieutenant") return bonus + 22;
    return bonus;
  }, 0);
}

function getCrosswindHoldingScore(
  state: RiderState,
  peloton: RiderState[],
  protectedRiderId: string | null,
) {
  const isProtectedLeader =
    state.rider.role === "leader" || state.rider.id === protectedRiderId;
  const protectorCount = isProtectedLeader
    ? peloton.filter(
        (teammate) =>
          teammate.rider.id !== state.rider.id &&
          teammate.rider.teamId === state.rider.teamId &&
          teammate.energy >= 12 &&
          (teammate.rider.role === "domestique" ||
            teammate.rider.role === "leadout" ||
            teammate.rider.raceDuty === "protector" ||
            teammate.rider.raceDuty === "lieutenant"),
      ).length
    : 0;
  const protectionBonus = Math.min(
    18,
    protectorCount * 2.5 + getDesignatedProtectionBonus(state, peloton),
  );
  const isolationPenalty = isProtectedLeader && protectorCount === 0 ? 3 : 0;

  return (
    state.rider.ratings.flat * 0.5 +
    state.rider.ratings.resistance * 0.3 +
    state.energy * 0.12 +
    protectionBonus -
    isolationPenalty
  );
}

function maybeCreateCrashMedicalResult(
  state: RiderState,
  segmentIndex: number,
  random: () => number,
): { injury: RaceInjury; abandonment: RaceAbandonment | null } | null {
  const outcome = resolveCrashMedicalOutcome({
    random,
    injuryRiskReductionPct:
      state.rider.equipmentEffects?.injuryRiskReductionPct ?? 0,
  });

  if (!outcome) return null;

  const injury: RaceInjury = {
    riderId: state.rider.id,
    segmentNumber: segmentIndex + 1,
    type: "fracture",
    diagnosisCode: outcome.diagnosisCode,
    label: outcome.label,
    severity: outcome.severity,
    recoveryHours: outcome.recoveryHours,
    recoveryDays: outcome.recoveryDays,
  };

  return {
    injury,
    abandonment: outcome.causesAbandonment
      ? {
          riderId: injury.riderId,
          segmentNumber: injury.segmentNumber,
          reason: "crash",
          injury: {
            type: injury.type,
            diagnosisCode: injury.diagnosisCode,
            label: injury.label,
            severity: injury.severity,
            recoveryHours: injury.recoveryHours,
            recoveryDays: injury.recoveryDays,
          },
        }
      : null,
  };
}

function awardFinishClassificationPoints({
  results,
  segments,
  mountainPoints,
  sprintPoints,
}: {
  results: StageSimulationResult["results"];
  segments: RaceStageSegment[];
  mountainPoints: Record<string, number>;
  sprintPoints: Record<string, number>;
}) {
  const finishers = results.filter((result) => result.status === "finished");
  const finalSegment = segments.at(-1);
  if (!finalSegment) return;

  let climbingLoad = 0;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.terrain !== "climb") break;
    climbingLoad +=
      segment.distanceKm * Math.max(1, segment.averageGradientPct);
  }

  if (finalSegment.terrain === "climb") {
    const scale =
      climbingLoad >= 180
        ? [30, 24, 20, 16, 12, 10, 8, 6, 4, 2]
        : climbingLoad >= 100
          ? [20, 15, 12, 10, 8, 6, 4, 2]
          : [10, 8, 6, 4, 2, 1];
    scale.forEach((points, index) => {
      const riderId = finishers[index]?.riderId;
      if (riderId)
        mountainPoints[riderId] = (mountainPoints[riderId] ?? 0) + points;
    });
  }

  const flatFinish =
    finalSegment.terrain === "flat" &&
    segments.slice(-3).filter((segment) => segment.terrain === "flat").length >=
      2;
  if (flatFinish) {
    [50, 35, 25, 20, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2].forEach(
      (points, index) => {
        const riderId = finishers[index]?.riderId;
        if (riderId)
          sprintPoints[riderId] = (sprintPoints[riderId] ?? 0) + points;
      },
    );
  }
}

export function buildStageRaceStandings(
  stageResults: StageSimulationResult[],
): StageRaceStandings {
  const riderById = new Map(
    stageResults
      .flatMap((stage) => stage.resolvedRiders)
      .map((rider) => [rider.id, rider]),
  );
  const eliminatedRiderIds = new Set(
    stageResults.flatMap((stage) =>
      stage.results
        .filter((result) => result.status !== "finished")
        .map((result) => result.riderId),
    ),
  );
  const medicallyWithdrawnRiderIds = new Set(
    stageResults
      .slice(0, -1)
      .flatMap((stage) =>
        stage.results
          .filter((result) => result.injury !== null)
          .map((result) => result.riderId),
      ),
  );
  const riderTimes = new Map<string, number>();
  const teamTimes = new Map<string, number>();
  const registeredRiderIdsByTeam = new Map<string, Set<string>>();
  const teamNameById = new Map<string, string>();
  const mountainPoints = new Map<string, number>();
  const sprintPoints = new Map<string, number>();

  for (const rider of riderById.values()) {
    const registeredRiderIds =
      registeredRiderIdsByTeam.get(rider.teamId) ?? new Set<string>();
    registeredRiderIds.add(rider.id);
    registeredRiderIdsByTeam.set(rider.teamId, registeredRiderIds);
    teamNameById.set(rider.teamId, rider.teamName);
  }

  for (const stage of stageResults) {
    for (const result of stage.results) {
      if (result.status !== "finished") continue;
      const rider = riderById.get(result.riderId);
      if (!rider) continue;
      riderTimes.set(
        rider.id,
        (riderTimes.get(rider.id) ?? 0) + result.elapsedTimeSeconds,
      );
    }

    const finishedTimeByRiderId = new Map(
      stage.results.flatMap((result) =>
        result.status === "finished"
          ? [[result.riderId, result.elapsedTimeSeconds] as const]
          : [],
      ),
    );
    const slowestFinisherTime = Math.max(0, ...finishedTimeByRiderId.values());
    const nonFinisherTime = slowestFinisherTime + 5 * 60;

    for (const [teamId, registeredRiderIds] of registeredRiderIdsByTeam) {
      if (registeredRiderIds.size === 0) continue;
      const weightedStageTime =
        [...registeredRiderIds].reduce(
          (total, riderId) =>
            total + (finishedTimeByRiderId.get(riderId) ?? nonFinisherTime),
          0,
        ) / registeredRiderIds.size;
      teamTimes.set(teamId, (teamTimes.get(teamId) ?? 0) + weightedStageTime);
    }

    for (const [riderId, points] of Object.entries(stage.mountainPoints)) {
      mountainPoints.set(riderId, (mountainPoints.get(riderId) ?? 0) + points);
    }
    for (const [riderId, points] of Object.entries(stage.sprintPoints)) {
      sprintPoints.set(riderId, (sprintPoints.get(riderId) ?? 0) + points);
    }
  }

  const activeRider = ([riderId]: [string, number]) =>
    !eliminatedRiderIds.has(riderId) &&
    !medicallyWithdrawnRiderIds.has(riderId);
  const byPoints = (first: [string, number], second: [string, number]) =>
    second[1] - first[1];
  const general = [...riderTimes.entries()]
    .filter(activeRider)
    .sort(
      (first, second) =>
        first[1] - second[1] || first[0].localeCompare(second[0]),
    );

  return {
    general: general.map(([riderId, elapsedTimeSeconds]) => ({
      riderId,
      elapsedTimeSeconds,
    })),
    mountain: [...mountainPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    sprint: [...sprintPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    youth: general
      .filter(([riderId]) => (riderById.get(riderId)?.age ?? 99) < 25)
      .map(([riderId, elapsedTimeSeconds]) => ({
        riderId,
        elapsedTimeSeconds,
      })),
    teams: [...teamTimes.entries()]
      .sort((first, second) => first[1] - second[1])
      .map(([teamId, elapsedTimeSeconds]) => ({
        teamId,
        teamName: teamNameById.get(teamId) ?? teamId,
        elapsedTimeSeconds: Math.round(elapsedTimeSeconds),
      })),
  };
}

function resolvePrime({
  states,
  segment,
  prime,
  segmentNumber,
  breakawayGapSeconds,
  random,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  prime: RaceSegmentPrime;
  segmentNumber: number;
  breakawayGapSeconds: number;
  random: () => number;
}): RacePrimeResult {
  const frontGroup =
    breakawayGapSeconds > 0 && getStatesInGroup(states, "breakaway").length > 0
      ? getStatesInGroup(states, "breakaway")
      : getStatesInGroup(states, "peloton");
  const ordered = [...frontGroup].sort((first, second) => {
    const firstScore = getPrimeScore(first, segment, prime, random);
    const secondScore = getPrimeScore(second, segment, prime, random);
    return secondScore - firstScore;
  });

  return {
    segmentNumber,
    prime,
    classification: ordered
      .slice(0, prime.pointsScale.length)
      .map((state, index) => ({
        riderId: state.rider.id,
        rank: index + 1,
        points: prime.pointsScale[index],
      })),
  };
}

function getPrimeScore(
  state: RiderState,
  segment: RaceStageSegment,
  prime: RaceSegmentPrime,
  random: () => number,
) {
  const roleBonus =
    prime.type === "mountain" && state.rider.role === "mountain_classification"
      ? 16
      : prime.type === "intermediate_sprint" && state.rider.role === "sprinter"
        ? 10
        : state.rider.role === "leader"
          ? -4
          : 0;
  const objectiveBonus =
    prime.type === "mountain" && state.rider.mountainPointsTarget ? 18 : 0;
  return (
    (prime.type === "mountain"
      ? getStateTerrainRating(state, segment) * 0.68 +
        state.rider.ratings.acceleration * 0.2 +
        getRaceDayBonus(state.rider) * 0.32
      : state.rider.ratings.sprint * 0.58 +
        state.rider.ratings.acceleration * 0.3 +
        getRaceDayBonus(state.rider)) +
    state.energy * 0.12 +
    roleBonus +
    objectiveBonus +
    random() * SCORE_NOISE -
    state.injuryPerformancePenalty * 0.45
  );
}

function getRoadFinishScores(
  states: Map<string, RiderState>,
  segments: RaceStageSegment[],
  profileType: RaceProfileType,
  random: () => number,
  commentary: string[],
) {
  const scores = new Map<string, number>();
  const sprintFinish = isLikelyMassSprint(segments);
  const peloton = getStatesInGroup(states, "peloton");
  const trainScores = getSprintTrainScores(peloton);
  const longSummitFinishFactor = getLongSummitFinishFactor(segments);
  const positionedTeams = [...trainScores.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([teamId]) => teamId);
  const finalAttackScores: Array<{ state: RiderState; score: number }> = [];
  const sprintContenders = [...peloton]
    .filter((state) => state.rider.role === "sprinter")
    .sort(
      (first, second) =>
        getSprintLaunchRating(second) - getSprintLaunchRating(first),
    );
  const borrowedWheelByRiderId = new Map<string, RiderState>();
  const primaryFavorite = sprintContenders[0];

  if (sprintFinish && primaryFavorite) {
    for (const challenger of sprintContenders.slice(1)) {
      const trainRank = positionedTeams.indexOf(challenger.rider.teamId);
      const canFollowFavorite =
        challenger.rider.teamId !== primaryFavorite.rider.teamId &&
        trainRank > 1 &&
        getSprintLaunchRating(challenger) >=
          getSprintLaunchRating(primaryFavorite) - 8;
      if (canFollowFavorite) {
        borrowedWheelByRiderId.set(challenger.rider.id, primaryFavorite);
      }
    }

    const wheelFollower = [...borrowedWheelByRiderId.keys()]
      .map((riderId) => states.get(riderId))
      .find((state): state is RiderState => state !== undefined);
    if (wheelFollower) {
      commentary.push(
        `${primaryFavorite.rider.name} lance le sprint ; ${wheelFollower.rider.name} a pris sa roue malgré les maillots adverses.`,
      );
    } else if (sprintContenders[1]) {
      commentary.push(
        `${primaryFavorite.rider.name} et ${sprintContenders[1].rider.name} se découvrent pour jouer la victoire.`,
      );
    } else {
      commentary.push(
        `${primaryFavorite.rider.name} lance le sprint en position de favori.`,
      );
    }
  }

  for (const state of states.values()) {
    const rider = state.rider;
    let score: number;
    let scoreNoiseFactor = 1;

    if (longSummitFinishFactor > 0) {
      const attackBonus = hasSpecialAbility(rider, "giclette") ? 1.5 : 0;
      const roleBonus =
        rider.role === "leader"
          ? 3
          : rider.role === "mountain_classification"
            ? 1
            : 0;
      const mountainWeight = 0.68 + longSummitFinishFactor * 0.08;
      const hillsWeight = 0.1 - longSummitFinishFactor * 0.02;
      const energyWeight = 0.07 - longSummitFinishFactor * 0.02;
      score =
        rider.ratings.mountain * mountainWeight +
        rider.ratings.hills * hillsWeight +
        rider.ratings.endurance * 0.07 +
        rider.ratings.resistance * 0.05 +
        state.energy * energyWeight +
        getRaceDayBonus(rider) * 0.8 +
        attackBonus +
        roleBonus +
        random() * (1.2 - longSummitFinishFactor * 0.7);
      scoreNoiseFactor = 0.3;
      if (state.group === "peloton") {
        finalAttackScores.push({ state, score });
      }
    } else if (sprintFinish && state.group !== "abandoned") {
      const trainRank = positionedTeams.indexOf(rider.teamId);
      const ownTrainBonus =
        trainRank === 0
          ? 5
          : trainRank === 1
            ? 3
            : trainRank >= 0 && trainRank < 4
              ? 1
              : 0;
      const borrowedWheel = borrowedWheelByRiderId.has(rider.id);
      const positioningBonus = borrowedWheel
        ? Math.max(3.5, ownTrainBonus)
        : ownTrainBonus;
      const roleFactor =
        rider.role === "sprinter" ? 3 : rider.role === "leadout" ? -3 : 0;
      const lostWheelPenalty =
        !borrowedWheel && trainRank > 2 && random() < 0.16 ? 4 : 0;
      score =
        rider.ratings.sprint * 0.76 +
        rider.ratings.acceleration * 0.12 +
        rider.ratings.resistance * 0.04 +
        state.energy * 0.08 +
        getRaceDayBonus(rider) +
        positioningBonus +
        roleFactor -
        lostWheelPenalty;
    } else if (profileType === "hilly") {
      const attackBonus = hasSpecialAbility(rider, "giclette") ? 6 : 0;
      const roleBonus = rider.role === "leader" ? 4 : 0;
      const timingBonus = isBreakawaySpecialist(rider)
        ? 0
        : random() * 1.5 + (random() < 0.06 ? 2 + random() * 2 : 0);
      score =
        rider.ratings.hills * 0.62 +
        rider.ratings.acceleration * 0.12 +
        rider.ratings.resistance * 0.05 +
        rider.ratings.endurance * 0.04 +
        getDecisiveRoadFinishRating(rider, segments) * 0.08 +
        state.energy * 0.04 +
        getRaceDayBonus(rider) * 0.92 +
        attackBonus * 0.65 +
        roleBonus +
        timingBonus;
      scoreNoiseFactor = 0.7;
      if (state.group === "peloton") {
        finalAttackScores.push({ state, score });
      }
    } else if (profileType === "mountain") {
      const attackBonus = hasSpecialAbility(rider, "giclette") ? 2.5 : 0;
      const roleBonus = rider.role === "leader" ? 3.5 : 0;
      const initiativeBonus = isBreakawaySpecialist(rider) ? 0 : random() * 1.5;
      score =
        rider.ratings.mountain * 0.68 +
        rider.ratings.hills * 0.08 +
        rider.ratings.acceleration * 0.05 +
        rider.ratings.resistance * 0.04 +
        rider.ratings.endurance * 0.05 +
        state.energy * 0.05 +
        getRaceDayBonus(rider) +
        attackBonus +
        roleBonus +
        initiativeBonus;
      scoreNoiseFactor = 0.7;
      if (state.group === "peloton") {
        finalAttackScores.push({ state, score });
      }
    } else {
      const attackBonus = hasSpecialAbility(rider, "giclette") ? 6 : 0;
      const roleBonus =
        rider.role === "leader" ? 5 : rider.role === "free_agent" ? 2 : 0;
      score =
        getDecisiveRoadFinishRating(rider, segments) * 0.68 +
        rider.ratings.acceleration * 0.14 +
        rider.ratings.resistance * 0.06 +
        state.energy * 0.06 +
        getRaceDayBonus(rider) * 0.42 +
        attackBonus * 0.75 +
        roleBonus;
      scoreNoiseFactor = 0.8;
    }

    scores.set(
      rider.id,
      score -
        (sprintFinish ? 0 : getLowEnergyPerformancePenalty(state)) +
        random() * SCORE_NOISE * scoreNoiseFactor +
        state.raceDayExecutionBonus * (sprintFinish ? 0.7 : 1) +
        state.decisiveAttackBonus -
        state.injuryPerformancePenalty,
    );
  }

  const finalAttacker = finalAttackScores.sort(
    (first, second) => second.score - first.score,
  )[0]?.state.rider;
  if (finalAttacker) {
    commentary.push(
      longSummitFinishFactor > 0
        ? `${finalAttacker.name} impose son rythme dans la longue ascension finale ; les purs grimpeurs prennent progressivement le dessus.`
        : profileType === "mountain"
          ? `${finalAttacker.name} déclenche la bataille des leaders dans la dernière ascension ; chacun tente de suivre à son rythme.`
          : `${finalAttacker.name} choisit son moment et place une accélération tranchante dans le final vallonné.`,
    );
  }

  return scores;
}

function getRoadFinishTime(
  state: RiderState,
  states: Map<string, RiderState>,
  scores: Map<string, number>,
  segments: RaceStageSegment[],
  profileType: RaceProfileType,
) {
  const ownScore = scores.get(state.rider.id) ?? 0;
  const longSummitFinishFactor = getLongSummitFinishFactor(segments);
  const peers = [...states.values()]
    .filter((peer) =>
      longSummitFinishFactor > 0
        ? peer.group !== "abandoned"
        : peer.group === state.group,
    )
    .map((peer) => scores.get(peer.rider.id) ?? 0);
  const bestScore = Math.max(...peers);
  const sprintFinish =
    isLikelyMassSprint(segments) && state.group === "peloton";

  if (sprintFinish) {
    // La photo-finish ordonne les coureurs, mais un peloton qui franchit la
    // ligne groupé reçoit un seul temps officiel. Les écarts ne viennent que
    // des cassures entre groupes, jamais de la longueur d'un vélo.
    return average(
      [...states.values()]
        .filter((peer) => peer.group === "peloton")
        .map((peer) => peer.elapsedTimeSeconds),
    );
  }

  const finishScale =
    longSummitFinishFactor > 0
      ? 14 + longSummitFinishFactor * 5
      : state.group === "peloton" || state.group === "breakaway"
        ? profileType === "mountain"
          ? 14
          : profileType === "hilly"
            ? 2.8
            : 0.72
        : 0.72;
  const finishGap = Math.max(0, bestScore - ownScore) * finishScale;
  return state.elapsedTimeSeconds + finishGap;
}

function getLongSummitFinishFactor(segments: RaceStageSegment[]) {
  let distanceKm = 0;
  let weightedGradient = 0;
  let segmentCount = 0;

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (segment.terrain !== "climb") break;
    distanceKm += segment.distanceKm;
    weightedGradient +=
      segment.distanceKm * Math.max(0, segment.averageGradientPct);
    segmentCount += 1;
  }

  if (segmentCount < 2 || distanceKm <= 0) return 0;
  const averageGradientPct = weightedGradient / distanceKm;
  const difficulty = distanceKm * averageGradientPct;
  if (difficulty < 100) return 0;

  return clamp(
    0.45 + (difficulty - 100) / 220 + (segmentCount - 2) * 0.08,
    0.45,
    1,
  );
}

function getLowEnergyPerformancePenalty(state: RiderState) {
  const resistanceBuffer = (state.rider.ratings.resistance - 50) * 0.12;
  const criticalReserve = clamp(34 - resistanceBuffer, 26, 36);
  if (state.energy >= criticalReserve) return 0;
  const depletion = (criticalReserve - state.energy) / criticalReserve;
  return depletion ** 2 * 6;
}

function updateFinalRoadGroups({
  timeline,
  finishGroups,
}: {
  timeline: RaceTimelineSnapshot[];
  finishGroups: ClassifiedStageResult[][];
}) {
  const finalSnapshot = timeline.at(-1);
  if (!finalSnapshot) return;
  const escapedRiderIds = new Set(
    finalSnapshot.groups
      .filter((group) => group.type === "breakaway")
      .flatMap((group) => group.riderIds),
  );

  finalSnapshot.groups = finishGroups.map((group, index) => {
    const escapedGroupWins =
      index === 0 && escapedRiderIds.has(group[0].riderId);
    return {
      id: `finish-group-${index + 1}`,
      label: escapedGroupWins
        ? "Échappée victorieuse"
        : index === 0
          ? "Groupe de tête"
          : `Groupe ${index + 1}`,
      type: escapedGroupWins
        ? "breakaway"
        : index === 0
          ? "peloton"
          : "dropped",
      riderIds: group.map((result) => result.riderId),
      gapToLeaderSeconds: group[0].gapToWinnerSeconds,
      averageEnergy: round(
        average(group.map((result) => result.energyAfter)),
        1,
      ),
    } satisfies RaceGroupSnapshot;
  });

  if (finishGroups.length > 1) {
    finalSnapshot.commentary.push(
      `${finishGroups.length} groupes franchissent la ligne : la sélection a créé des écarts durables.`,
    );
  }
}

type ClassifiedStageResult = StageSimulationResult["results"][number] & {
  rank: number;
  status: "finished";
};

function normalizeRoadFinishGroupTimes({
  results,
}: {
  results: StageSimulationResult["results"];
}): ClassifiedStageResult[][] {
  const finishers = results
    .filter(
      (result): result is ClassifiedStageResult =>
        result.status === "finished" && result.rank !== null,
    )
    .sort((first, second) => first.rank - second.rank);
  const finishGroups = splitFinishGroupByTime(finishers);
  const winnerTime = finishGroups[0]?.[0]?.elapsedTimeSeconds ?? 0;

  for (const group of finishGroups) {
    const groupTime = group[0].elapsedTimeSeconds;

    for (const result of group) {
      result.elapsedTimeSeconds = groupTime;
      result.gapToWinnerSeconds = Math.max(0, groupTime - winnerTime);
    }
  }

  return finishGroups;
}

function splitFinishGroupByTime(finishers: ClassifiedStageResult[]) {
  const groups: ClassifiedStageResult[][] = [];

  for (const finisher of finishers) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    if (
      !current ||
      !previous ||
      !areFinishersInSameTimeGroup(
        previous.elapsedTimeSeconds,
        finisher.elapsedTimeSeconds,
      )
    ) {
      groups.push([finisher]);
    } else {
      current.push(finisher);
    }
  }

  return groups;
}

function getSprintLaunchRating(state: RiderState) {
  return (
    state.rider.ratings.sprint * 0.68 +
    state.rider.ratings.acceleration * 0.2 +
    state.rider.ratings.resistance * 0.04 +
    state.energy * 0.08 -
    state.injuryPerformancePenalty * 0.7
  );
}

function getSprintTrainScores(states: RiderState[]) {
  const teams = groupBy(states, (state) => state.rider.teamId);
  const result = new Map<string, number>();

  for (const [teamId, teamStates] of teams) {
    const leadouts = teamStates.filter(
      (state) => state.rider.role === "leadout",
    );
    const domestiques = teamStates.filter(
      (state) => state.rider.role === "domestique",
    );
    const helpers = leadouts.length > 0 ? leadouts : domestiques.slice(0, 2);
    const score = helpers.length
      ? average(
          helpers.map(
            (state) =>
              state.rider.ratings.flat * 0.33 +
              state.rider.ratings.sprint * 0.24 +
              state.rider.ratings.acceleration * 0.18 +
              state.energy * 0.25,
          ),
        ) +
        helpers.length * 2.5
      : 0;
    result.set(teamId, score);
  }

  return result;
}

function buildRoadSnapshot({
  states,
  segmentNumber,
  completedDistanceKm,
  breakawayGapSeconds,
  incidents,
  abandonments,
  commentary,
}: {
  states: Map<string, RiderState>;
  segmentNumber: number;
  completedDistanceKm: number;
  breakawayGapSeconds: number;
  incidents: RaceIncident[];
  abandonments: RaceAbandonment[];
  commentary: string[];
}): RaceTimelineSnapshot {
  const breakaway = getStatesInGroup(states, "breakaway");
  const secondaryBreakaway = getStatesInGroup(states, "breakaway_2");
  const chase = getStatesInGroup(states, "chase");
  const peloton = getStatesInGroup(states, "peloton");
  const delayed = getStatesInGroup(states, "delayed");
  const dropped = getStatesInGroup(states, "dropped");
  const groups: RaceGroupSnapshot[] = [];
  const hasBreakaway = breakaway.length > 0 && breakawayGapSeconds > 0;

  if (hasBreakaway) {
    groups.push(toGroupSnapshot("breakaway", "Échappée", breakaway, 0));
  }

  if (secondaryBreakaway.length > 0 && hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "breakaway",
        "Échappée 2 · lâchés",
        secondaryBreakaway,
        Math.round(
          clamp(
            average(secondaryBreakaway.map((state) => state.lostTimeSeconds)),
            8,
            Math.max(10, breakawayGapSeconds - 5),
          ),
        ),
      ),
    );
  }

  if (chase.length > 0 && hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "chase",
        "Chasse-patate",
        chase,
        Math.round(Math.max(6, breakawayGapSeconds * 0.58)),
      ),
    );
  }

  if (peloton.length > 0) {
    groups.push(
      toGroupSnapshot(
        "peloton",
        "Peloton",
        peloton,
        hasBreakaway ? Math.max(0, Math.round(breakawayGapSeconds)) : 0,
      ),
    );
  }

  if (delayed.length > 0) {
    const pelotonTime = average(
      peloton.map((state) => state.elapsedTimeSeconds),
    );
    const delayedGapBehindPeloton =
      peloton.length > 0
        ? average(delayed.map((state) => state.elapsedTimeSeconds)) -
          pelotonTime
        : average(delayed.map((state) => state.lostTimeSeconds));
    const crosswindRiderIds = new Set(
      incidents
        .filter((incident) => incident.type === "crosswind")
        .flatMap((incident) => incident.riderIds),
    );
    const isCurrentCrosswindGroup = delayed.some((state) =>
      crosswindRiderIds.has(state.rider.id),
    );

    groups.push(
      toGroupSnapshot(
        "dropped",
        isCurrentCrosswindGroup
          ? "Groupe pi\u00e9g\u00e9 par la bordure"
          : "Groupe retard\u00e9",
        delayed,
        Math.round(
          (hasBreakaway ? Math.max(0, breakawayGapSeconds) : 0) +
            Math.max(1, delayedGapBehindPeloton),
        ),
      ),
    );
  }

  if (chase.length > 0 && !hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "chase",
        "Groupe de chasse",
        chase,
        Math.round(
          Math.max(5, average(chase.map((state) => state.lostTimeSeconds))),
        ),
      ),
    );
  }

  if (secondaryBreakaway.length > 0 && !hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "chase",
        "Intercalés",
        secondaryBreakaway,
        Math.round(
          Math.max(
            8,
            average(secondaryBreakaway.map((state) => state.lostTimeSeconds)),
          ),
        ),
      ),
    );
  }

  if (dropped.length > 0) {
    const baseGap = hasBreakaway ? Math.max(0, breakawayGapSeconds) : 0;
    splitDroppedGroups(dropped).forEach((droppedGroup, index) => {
      groups.push(
        toGroupSnapshot(
          "dropped",
          index === 0 ? "Groupe attardé" : `Groupe attardé ${index + 1}`,
          droppedGroup,
          Math.round(
            baseGap +
              average(droppedGroup.map((state) => state.lostTimeSeconds)),
          ),
        ),
      );
    });
  }

  return {
    segmentNumber,
    completedDistanceKm: round(completedDistanceKm, 1),
    groups: accumulateRaceGroupGapsFromLeader(groups),
    incidents,
    abandonments: [...abandonments],
    commentary:
      commentary.length > 0
        ? commentary.slice(0, 4)
        : [
            `Le rythme se stabilise après ${formatDistance(completedDistanceKm)} km.`,
          ],
  };
}

export function accumulateRaceGroupGapsFromLeader(
  groups: RaceGroupSnapshot[],
): RaceGroupSnapshot[] {
  let previousGapSeconds = 0;

  return groups.map((group, index) => {
    const gapToLeaderSeconds =
      index === 0
        ? 0
        : Math.max(previousGapSeconds, Math.max(0, group.gapToLeaderSeconds));
    previousGapSeconds = gapToLeaderSeconds;

    return {
      ...group,
      gapToLeaderSeconds,
    };
  });
}

function toGroupSnapshot(
  type: "breakaway" | "chase" | "peloton" | "dropped",
  label: string,
  states: RiderState[],
  gapToLeaderSeconds: number,
): RaceGroupSnapshot {
  return {
    id: `${type}-${states
      .map((state) => state.rider.id)
      .sort()
      .join("-")}`,
    label,
    type,
    riderIds: states.map((state) => state.rider.id),
    gapToLeaderSeconds,
    averageEnergy: round(average(states.map((state) => state.energy)), 1),
  };
}

export function getRaceObjectiveControllingTeamIds({
  baseControllingTeamIds,
  teamStrategies,
  likelyMassSprint,
}: {
  baseControllingTeamIds: Set<string>;
  teamStrategies: RaceTeamStrategy[];
  likelyMassSprint: boolean;
}) {
  const controllingTeamIds = new Set(baseControllingTeamIds);

  for (const strategy of teamStrategies) {
    if (
      strategy.objective === "stage_win" &&
      !stageWinTargetsBreakaway(strategy, likelyMassSprint)
    ) {
      controllingTeamIds.add(strategy.teamId);
      continue;
    }
    if (
      strategy.objective === "mountain_points" ||
      (strategy.objective === "stage_win" &&
        stageWinTargetsBreakaway(strategy, likelyMassSprint))
    ) {
      controllingTeamIds.delete(strategy.teamId);
    }
  }

  return controllingTeamIds;
}

function stageWinTargetsBreakaway(
  strategy: RaceTeamStrategy,
  likelyMassSprint: boolean,
) {
  return (
    !likelyMassSprint ||
    strategy.breakawayPolicy === "target" ||
    strategy.breakawayRiderId !== null
  );
}

function getStrategyChaseModifier({
  states,
  teamStrategies,
  breakawayThreat,
  raceProgress,
  generalClassificationLeaderId,
  likelyMassSprint,
}: {
  states: Map<string, RiderState>;
  teamStrategies: RaceTeamStrategy[];
  breakawayThreat: number;
  raceProgress: number;
  generalClassificationLeaderId: string | null;
  likelyMassSprint: boolean;
}) {
  if (teamStrategies.length === 0) return 0;

  const generalLeaderTeamId = generalClassificationLeaderId
    ? states.get(generalClassificationLeaderId)?.rider.teamId
    : null;
  const modifiers = teamStrategies.map((strategy) => {
    const activeTeamStates = [...states.values()].filter(
      (state) =>
        state.rider.teamId === strategy.teamId &&
        state.group === "peloton" &&
        state.energy >= 12,
    );
    if (activeTeamStates.length === 0) return 0;

    const dangerPacerIsAvailable = activeTeamStates.some(
      (state) => state.rider.id === strategy.dangerPacerRiderId,
    );
    const teamLeaderIsPresent = activeTeamStates.some(
      (state) => state.rider.role === "leader",
    );
    const teamRiderIsAhead = [...states.values()].some(
      (state) =>
        state.rider.teamId === strategy.teamId &&
        (state.group === "breakaway" ||
          state.group === "breakaway_2" ||
          state.group === "chase"),
    );
    const mountainTargetIsAhead = [...states.values()].some(
      (state) =>
        state.rider.teamId === strategy.teamId &&
        state.rider.mountainPointsTarget &&
        (state.group === "breakaway" ||
          state.group === "breakaway_2" ||
          state.group === "chase"),
    );
    let modifier =
      strategy.collectivePosture === "aggressive"
        ? 0.035
        : strategy.collectivePosture === "conservative"
          ? -0.035
          : 0;

    if (strategy.chasePolicy === "never") {
      modifier -= 0.08;
    } else if (strategy.chasePolicy === "always") {
      modifier += 0.11;
    } else if (
      strategy.chasePolicy === "dangerous_breakaway" &&
      breakawayThreat >= 0.35
    ) {
      modifier += 0.08;
    } else if (
      strategy.chasePolicy === "protect_lead" &&
      breakawayThreat >= 0.3 &&
      (generalLeaderTeamId === strategy.teamId || teamLeaderIsPresent)
    ) {
      modifier += 0.09;
    }

    if (
      dangerPacerIsAvailable &&
      strategy.chasePolicy !== "never" &&
      breakawayThreat >= 0.32
    ) {
      modifier += 0.07;
    }
    if (
      strategy.objective === "stage_win" &&
      !stageWinTargetsBreakaway(strategy, likelyMassSprint) &&
      raceProgress >= 0.4
    ) {
      modifier += 0.075;
    } else if (
      strategy.objective === "stage_win" &&
      stageWinTargetsBreakaway(strategy, likelyMassSprint) &&
      teamRiderIsAhead
    ) {
      modifier -= 0.1;
    } else if (strategy.objective === "mountain_points") {
      modifier -= mountainTargetIsAhead ? 0.1 : 0.035;
    } else if (strategy.objective === "sprint" && raceProgress >= 0.48) {
      modifier += 0.055;
    } else if (
      strategy.objective === "general_classification" &&
      breakawayThreat >= 0.42
    ) {
      modifier += 0.04;
    } else if (strategy.objective === "breakaway") {
      modifier -= 0.035;
    }

    return modifier;
  });
  const strongestPositive = Math.max(0, ...modifiers);
  const strongestNegative = Math.min(0, ...modifiers);
  return clamp(strongestPositive + strongestNegative, -0.1, 0.24);
}

function getPelotonChaseWorkers(
  peloton: RiderState[],
  controllingTeamIds: Set<string>,
) {
  return peloton.filter(
    (state) =>
      controllingTeamIds.has(state.rider.teamId) &&
      (state.rider.role === "domestique" || state.rider.role === "leadout") &&
      state.energy >= 10,
  );
}

function getPelotonChaseCapacity(
  peloton: RiderState[],
  segment: RaceStageSegment,
  controllingTeamIds: Set<string>,
) {
  if (peloton.length === 0 || controllingTeamIds.size === 0) {
    return 0.08;
  }

  const workers = getPelotonChaseWorkers(peloton, controllingTeamIds);
  if (workers.length === 0) return 0.12;

  const workerStrength = average(
    workers.map(
      (state) =>
        getStateTerrainRating(state, segment) * 0.64 +
        state.rider.ratings.endurance * 0.2 +
        state.energy * 0.16,
    ),
  );
  const expectedWorkers = Math.max(2, controllingTeamIds.size * 1.7);
  const workerCoverage = clamp(workers.length / expectedWorkers, 0, 1);
  const representedTeams =
    new Set(workers.map((state) => state.rider.teamId)).size /
    controllingTeamIds.size;

  return clamp(
    workerCoverage * 0.42 +
      representedTeams * 0.24 +
      clamp((workerStrength - 48) / 30, 0, 1) * 0.34,
    0.08,
    1,
  );
}

function getPelotonChasePressure(
  peloton: RiderState[],
  segment: RaceStageSegment,
  progress: number,
  hasBreakaway: boolean,
  breakawayThreat: number,
  breakawayGapSeconds: number,
  controllingTeamIds: Set<string>,
) {
  const chaseCapacity = getPelotonChaseCapacity(
    peloton,
    segment,
    controllingTeamIds,
  );
  const terrainFactor =
    segment.terrain === "flat" ? 0.04 : segment.terrain === "climb" ? -0.03 : 0;
  const gapUrgency = hasBreakaway
    ? clamp((breakawayGapSeconds - 90) / 330, 0, 0.22)
    : 0;
  const dangerUrgency = hasBreakaway ? breakawayThreat : 0;

  if (progress < 0.3) {
    return clamp(
      0.1 +
        chaseCapacity * 0.2 +
        terrainFactor +
        dangerUrgency * 0.3 +
        gapUrgency,
      0.06,
      0.62,
    );
  }

  if (progress < 0.62) {
    return clamp(
      0.18 +
        chaseCapacity * 0.42 +
        terrainFactor +
        dangerUrgency * 0.34 +
        gapUrgency,
      0.12,
      0.9,
    );
  }

  const finalUrgency = (progress - 0.62) * 0.82;
  return clamp(
    0.31 +
      chaseCapacity * 0.46 +
      terrainFactor +
      finalUrgency +
      dangerUrgency * 0.31 +
      gapUrgency,
    0.28,
    1,
  );
}
function getTerrainRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment,
) {
  let rating: number;

  if (segment.terrain === "climb") {
    const gradient = Math.abs(segment.averageGradientPct);
    const mountainWeight = clamp(
      0.18 +
        Math.max(0, gradient - 3) * 0.07 +
        Math.max(0, segment.distanceKm - 5) * 0.025,
      0.18,
      0.82,
    );
    rating =
      rider.ratings.mountain * mountainWeight +
      rider.ratings.hills * (1 - mountainWeight);
  } else if (segment.terrain === "descent") {
    rating = rider.ratings.downhill * 0.72 + rider.ratings.resistance * 0.28;
  } else {
    rating = rider.ratings.flat;
  }

  if (segment.surface === "cobbles") {
    rating = rating * 0.36 + rider.ratings.cobbles * 0.64;
  }

  return rating + getRaceDayBonus(rider);
}

export function getHillyClimbSelectionRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment,
  accumulatedClimbLoad: number,
) {
  const baseRating = getTerrainRating(rider, segment);
  const gradient = Math.abs(segment.averageGradientPct);
  if (segment.terrain !== "climb" || gradient >= 6) {
    return baseRating;
  }

  const mountainAdvantage = Math.max(
    0,
    rider.ratings.mountain - rider.ratings.hills,
  );
  const freshMountainSupport =
    mountainAdvantage * 0.32 * clamp(1 - accumulatedClimbLoad / 54, 0, 1);
  const repetitionPenalty =
    Math.max(0, accumulatedClimbLoad - 28) * (mountainAdvantage / 25) * 0.3;

  return baseRating + freshMountainSupport - repetitionPenalty;
}

export function getNextHillyClimbLoad(
  currentLoad: number,
  segment: RaceStageSegment,
  profileType: RaceProfileType,
) {
  if (profileType !== "hilly") return 0;

  const gradient = Math.abs(segment.averageGradientPct);
  if (segment.terrain === "climb") {
    const gradientFactor = gradient < 6 ? 0.55 + gradient / 12 : 0.38;
    return currentLoad + segment.distanceKm * gradientFactor;
  }

  const recoveryPerKm = segment.terrain === "descent" ? 0.04 : 0.02;
  return Math.max(0, currentLoad - segment.distanceKm * recoveryPerKm);
}

function getSegmentSelectionDifficulty(
  segment: RaceStageSegment,
  profileType: RaceProfileType,
  hillyClimbLoad: number,
) {
  if (segment.surface === "cobbles") {
    return clamp(
      0.65 +
        segment.distanceKm / 30 +
        Math.abs(segment.averageGradientPct) / 15,
      0.65,
      1.35,
    );
  }
  if (segment.terrain !== "climb") return 0;

  const gradient = Math.abs(segment.averageGradientPct);
  const intrinsicDifficulty =
    (gradient / 8) * 0.55 + (Math.min(20, segment.distanceKm) / 20) * 0.45;
  const repetitionDifficulty =
    profileType === "hilly" ? clamp((hillyClimbLoad - 12) / 35, 0, 0.55) : 0;

  return clamp(intrinsicDifficulty + repetitionDifficulty, 0, 1.4);
}
function getSelectionTerrainRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment,
  profileType: RaceProfileType,
  hillyClimbLoad: number,
) {
  if (profileType !== "hilly") {
    return getTerrainRating(rider, segment);
  }

  return getHillyClimbSelectionRating(rider, segment, hillyClimbLoad);
}

function getStateTerrainRating(
  state: RiderState,
  segment: RaceStageSegment,
) {
  return (
    getTerrainRating(state.rider, segment) +
    state.raceDayExecutionBonus * 0.65 -
    state.injuryPerformancePenalty
  );
}

function getStateSelectionTerrainRating(
  state: RiderState,
  segment: RaceStageSegment,
  profileType: RaceProfileType,
  hillyClimbLoad: number,
) {
  return (
    getSelectionTerrainRating(
      state.rider,
      segment,
      profileType,
      hillyClimbLoad,
    ) +
    state.raceDayExecutionBonus * 0.65 -
    state.injuryPerformancePenalty
  );
}

function splitDroppedGroups(states: RiderState[]) {
  const ordered = [...states].sort(
    (first, second) => first.lostTimeSeconds - second.lostTimeSeconds,
  );
  const groups: RiderState[][] = [];

  for (const state of ordered) {
    const current = groups.at(-1);
    if (
      !current ||
      state.lostTimeSeconds -
        average(current.map((member) => member.lostTimeSeconds)) >
        45
    ) {
      groups.push([state]);
    } else {
      current.push(state);
    }
  }

  return groups;
}

function getDecisiveRoadFinishRating(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[],
) {
  const decisiveSegments = segments.slice(-4);
  let weightedRating = 0;
  let totalWeight = 0;

  decisiveSegments.forEach((segment, index) => {
    const recency =
      0.85 + (index / Math.max(1, decisiveSegments.length - 1)) * 0.3;
    const selectivity =
      segment.terrain === "climb"
        ? 1.45
        : segment.surface === "cobbles"
          ? 1.3
          : segment.terrain === "descent"
            ? 0.45
            : 1;
    const weight = Math.max(1, segment.distanceKm) * recency * selectivity;
    weightedRating += getTerrainRating(rider, segment) * weight;
    totalWeight += weight;
  });

  return totalWeight > 0
    ? weightedRating / totalWeight
    : getTerrainRating(rider, segments.at(-1)!);
}

function getTimeTrialSegmentRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment,
  stageType: SimulationStageType,
) {
  const clockRating =
    stageType === "prologue" ? rider.ratings.prologue : rider.ratings.timeTrial;
  return (
    clockRating * 0.58 +
    getTerrainRating(rider, segment) * 0.27 +
    rider.ratings.endurance * 0.1 +
    rider.form * 0.05 +
    getRaceDayBonus(rider) * 0.73
  );
}

function getStageSuitability(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[],
) {
  const distance = Math.max(
    1,
    segments.reduce((total, segment) => total + segment.distanceKm, 0),
  );
  const terrainScore = segments.reduce(
    (total, segment) =>
      total + getTerrainRating(rider, segment) * segment.distanceKm,
    0,
  );
  return (
    (terrainScore / distance) * 0.75 +
    rider.ratings.endurance * 0.15 +
    rider.form * 0.1 +
    getRaceDayBonus(rider) * 0.25
  );
}

function getAutomaticLeaderScore(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[],
  profileType: RaceProfileType,
) {
  if (profileType === "hilly") {
    return (
      rider.ratings.hills * 0.5 +
      rider.ratings.acceleration * 0.22 +
      rider.ratings.resistance * 0.1 +
      rider.ratings.endurance * 0.08 +
      rider.form * 0.1 +
      getRaceDayBonus(rider)
    );
  }

  if (profileType === "mountain") {
    return (
      rider.ratings.mountain * 0.5 +
      rider.ratings.hills * 0.14 +
      rider.ratings.endurance * 0.12 +
      rider.ratings.recovery * 0.12 +
      rider.form * 0.12 +
      getRaceDayBonus(rider)
    );
  }

  if (profileType === "cobbles") {
    return (
      rider.ratings.cobbles * 0.46 +
      rider.ratings.flat * 0.16 +
      rider.ratings.resistance * 0.14 +
      rider.ratings.endurance * 0.12 +
      rider.form * 0.12 +
      getRaceDayBonus(rider)
    );
  }

  return getStageSuitability(rider, segments);
}

function isBreakawaySpecialist(rider: RiderSimulationInput) {
  const competingProfileRating = Math.max(
    rider.ratings.mountain,
    rider.ratings.hills,
    rider.ratings.sprint,
    rider.ratings.cobbles,
    rider.ratings.flat,
    rider.ratings.timeTrial,
  );
  return rider.ratings.breakaway > competingProfileRating;
}

function applyPerformancePreparationBonuses(
  ratings: RiderSimulationRatings,
  preparations: RiderSimulationInput["performancePreparations"],
  gameDayIndex: number | undefined,
): RiderSimulationRatings {
  if (gameDayIndex === undefined || !preparations?.length) return ratings;
  const activePreparations = preparations.filter(
    (preparation) =>
      gameDayIndex >= preparation.bonusStartGameDay &&
      gameDayIndex <= preparation.bonusEndGameDay,
  );
  if (!activePreparations.length) return ratings;
  const next = { ...ratings };
  for (const preparation of activePreparations) {
    if (preparation.type === "indoor_track") {
      next.sprint = Math.min(100, next.sprint + preparation.ratingBonus);
      next.acceleration = Math.min(
        100,
        next.acceleration + preparation.ratingBonus,
      );
    } else {
      next.timeTrial = Math.min(
        100,
        next.timeTrial + preparation.ratingBonus,
      );
      next.prologue = Math.min(100, next.prologue + preparation.ratingBonus);
      next.endurance = Math.min(
        100,
        next.endurance + preparation.ratingBonus,
      );
    }
  }
  return next;
}

function getRaceDayBonus(rider: RiderSimulationInput) {
  return (
    (rider.localRaceBonus ?? 0) +
    getRiderExperienceRaceBonus(rider.careerRaceDays ?? 0)
  );
}

function getRiderRaceDayExecutionBonus(
  input: StageSimulationInput,
  rider: RiderSimulationInput,
) {
  const random = createSeededRandom(
    `${input.id}:${input.seed}:race-execution:${rider.id}`,
  );

  return getControlledRaceDayExecutionSwing({
    firstRoll: random(),
    secondRoll: random(),
    experienceRaceBonus: getRiderExperienceRaceBonus(
      rider.careerRaceDays ?? 0,
    ),
  });
}

function getBaseSpeed(segment: RaceStageSegment) {
  if (segment.terrain === "climb") {
    return Math.max(13, 30 - Math.abs(segment.averageGradientPct) * 1.55);
  }
  if (segment.terrain === "descent") return 54;
  if (segment.surface === "cobbles") return 36;
  return 43;
}

function getDroppedRiderLoss(
  state: RiderState,
  segment: RaceStageSegment,
  frontTerrainRating: number,
  profileType: RaceProfileType,
  hillyClimbLoad: number,
  random: () => number,
) {
  const terrainDeficit = Math.max(
    0,
    frontTerrainRating -
      getStateSelectionTerrainRating(
        state,
        segment,
        profileType,
        hillyClimbLoad,
      ),
  );

  if (segment.terrain === "climb") {
    const difficulty = getSegmentSelectionDifficulty(
      segment,
      profileType,
      hillyClimbLoad,
    );
    return (
      2 +
      difficulty * 8 +
      terrainDeficit * (1.4 + difficulty * 2.6) +
      random() * (2 + difficulty * 4)
    );
  }

  if (segment.terrain === "descent") {
    const descentDeficit = Math.max(
      0,
      frontTerrainRating - getStateTerrainRating(state, segment),
    );
    return 0.5 + descentDeficit * 0.4 + random() * 1.5;
  }

  // Une fois distancé, le coureur ne continue pas à perdre des dizaines de
  // secondes sur chaque portion roulante : le gruppetto limite les dégâts.
  return 1 + terrainDeficit * 0.25 + random() * 2;
}

function getFrontTerrainRating(
  states: RiderState[],
  segment: RaceStageSegment,
  profileType: RaceProfileType,
  hillyClimbLoad: number,
) {
  if (states.length === 0) return 60;
  return average(
    getGroupPaceSetters(states, segment, 0.2).map((state) =>
      getStateSelectionTerrainRating(
        state,
        segment,
        profileType,
        hillyClimbLoad,
      ),
    ),
  );
}

function isLikelyMassSprint(segments: RaceStageSegment[]) {
  const finalSegments = segments.slice(-3);
  return (
    finalSegments.length > 0 &&
    finalSegments.filter((segment) => segment.terrain === "flat").length >=
      Math.ceil(finalSegments.length * 0.66)
  );
}

function setBestAutomaticRole(
  riders: RiderSimulationInput[],
  role: RaceRole,
  score: (rider: RiderSimulationInput) => number,
) {
  const best = [...riders].sort(
    (first, second) => score(second) - score(first),
  )[0];
  if (best) best.role = role;
}

function validateSimulationInput(input: StageSimulationInput) {
  if (input.riders.length < 1) {
    throw new Error("Une simulation requiert au moins un coureur.");
  }
  if (input.segments.length === 0) {
    throw new Error("Une simulation requiert au moins un tronçon.");
  }
  if (
    new Set(input.riders.map((rider) => rider.id)).size !== input.riders.length
  ) {
    throw new Error("Chaque coureur doit posséder un identifiant unique.");
  }
  validateExplicitRoles(input.riders);
  validateTeamStrategies(input);
}

function validateTimeTrialPlans(input: StageSimulationInput) {
  const plans = input.timeTrialPlans ?? {};
  if (Object.keys(plans).length === 0) return;
  if (
    input.stageType !== "individual_time_trial" &&
    input.stageType !== "team_time_trial" &&
    input.stageType !== "prologue"
  ) {
    throw new Error(
      "Une préparation chrono ne peut viser qu’un contre-la-montre.",
    );
  }

  const ridersById = new Map(input.riders.map((rider) => [rider.id, rider]));
  for (const [riderId, plan] of Object.entries(plans)) {
    if (!ridersById.has(riderId) || !isTimeTrialEffortMode(plan.effortMode)) {
      throw new Error(
        "Une consigne chrono vise un coureur ou un effort invalide.",
      );
    }
    if (
      plan.relaySharePct !== null &&
      (!Number.isFinite(plan.relaySharePct) ||
        plan.relaySharePct < 0 ||
        plan.relaySharePct > 100)
    ) {
      throw new Error("Un pourcentage de relais est invalide.");
    }
  }

  const teams = groupBy(input.riders, (rider) => rider.teamId);
  for (const riders of teams.values()) {
    const plannedRiders = riders.filter((rider) => plans[rider.id]);
    if (plannedRiders.length === 0) continue;
    if (plannedRiders.length !== riders.length) {
      throw new Error(
        "Une préparation chrono doit couvrir toute l’équipe engagée.",
      );
    }
    if (input.stageType !== "team_time_trial") continue;

    const relayTotal = plannedRiders.reduce(
      (total, rider) => total + (plans[rider.id].relaySharePct ?? 0),
      0,
    );
    if (
      plannedRiders.some((rider) => plans[rider.id].relaySharePct === null) ||
      Math.abs(relayTotal - 100) > 0.001
    ) {
      throw new Error(
        "La répartition des relais d’une équipe doit totaliser exactement 100 %.",
      );
    }
  }
}
function validateTeamStrategies(input: StageSimulationInput) {
  const strategies = input.teamStrategies ?? [];
  const ridersById = new Map(input.riders.map((rider) => [rider.id, rider]));
  const segmentNumbers = new Set(
    input.segments.map((segment) => segment.segmentNumber),
  );

  if (
    new Set(strategies.map((strategy) => strategy.teamId)).size !==
    strategies.length
  ) {
    throw new Error(
      "Une \u00e9quipe ne peut transmettre qu\u2019une strat\u00e9gie par \u00e9tape.",
    );
  }

  for (const strategy of strategies) {
    const dutyRiderIds = [
      strategy.lieutenantRiderId,
      strategy.dangerPacerRiderId,
      strategy.protectorRiderId,
      strategy.breakawayRiderId,
    ].filter((riderId): riderId is string => Boolean(riderId));
    if (new Set(dutyRiderIds).size !== dutyRiderIds.length) {
      throw new Error(
        "Un m\u00eame coureur ne peut pas cumuler deux missions tactiques.",
      );
    }
    if (
      dutyRiderIds.some(
        (riderId) => ridersById.get(riderId)?.teamId !== strategy.teamId,
      )
    ) {
      throw new Error(
        "Une mission tactique vise un coureur hors de l\u2019\u00e9quipe.",
      );
    }
    if (strategy.attackOrders.length > MAX_RACE_ATTACK_ORDERS) {
      throw new Error(
        `Une \u00e9quipe ne peut pr\u00e9parer que ${MAX_RACE_ATTACK_ORDERS} attaques par \u00e9tape.`,
      );
    }
    if (
      strategy.attackOrders.some(
        (order) =>
          ridersById.get(order.riderId)?.teamId !== strategy.teamId ||
          !segmentNumbers.has(order.segmentNumber),
      )
    ) {
      throw new Error(
        "Un ordre d\u2019attaque vise un coureur ou un tron\u00e7on invalide.",
      );
    }
  }
}

function validateExplicitRoles(riders: RiderSimulationInput[]) {
  const teams = groupBy(riders, (rider) => rider.teamId);

  for (const teamRiders of teams.values()) {
    for (const uniqueRole of ["leader", "sprinter"] satisfies RaceRole[]) {
      if (teamRiders.filter((rider) => rider.role === uniqueRole).length > 1) {
        throw new Error(
          `Une équipe ne peut désigner qu’un seul ${RACE_ROLE_LABELS[uniqueRole].toLowerCase()}.`,
        );
      }
    }
  }
}

function getStatesInGroup(
  states: Map<string, RiderState>,
  group: RiderState["group"],
) {
  return [...states.values()].filter((state) => state.group === group);
}

function formatRiderList(states: RiderState[]) {
  const names = states.slice(0, 3).map((state) => state.rider.name);
  return states.length > 3
    ? `${names.join(", ")} et ${states.length - 3} autres`
    : names.join(", ");
}

function formatGap(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0
    ? `${minutes}’${String(remainingSeconds).padStart(2, "0")}”`
    : `${remainingSeconds}”`;
}

function formatDistance(distance: number) {
  return Number.isInteger(distance) ? String(distance) : distance.toFixed(1);
}

function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const itemKey = key(item);
    groups.set(itemKey, [...(groups.get(itemKey) ?? []), item]);
  }
  return groups;
}

function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function createSeededRandom(seed: string | number) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string | number) {
  const value = String(seed);
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
