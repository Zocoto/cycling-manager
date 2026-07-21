import type {
  RaceSegmentPrime,
  RaceStageSegment,
} from "./race-profiles";
import {
  applyEquipmentRatingBonuses,
  type EquipmentEffects,
} from "./equipment";
import {
  hasSpecialAbility,
  type RiderSpecialAbility,
} from "./special-abilities";

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
  | "road"
  | "individual_time_trial"
  | "team_time_trial"
  | "prologue";

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

export type RiderSimulationInput = {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  age: number;
  form: number;
  role: RaceRole;
  specialAbility?: RiderSpecialAbility | null;
  specialAbilities?: RiderSpecialAbility[];
  ratings: RiderSimulationRatings;
  equipmentEffects?: EquipmentEffects;
};

export type StageSimulationInput = {
  id: string;
  name: string;
  stageType: SimulationStageType;
  isStageRace: boolean;
  seed: string | number;
  segments: RaceStageSegment[];
  riders: RiderSimulationInput[];
  unavailableRiderIds?: string[];
};

export type RaceGroupSnapshot = {
  id: string;
  label: string;
  type: "breakaway" | "chase" | "peloton" | "dropped" | "time_trial";
  riderIds: string[];
  gapToLeaderSeconds: number;
  averageEnergy: number;
};

export const RACE_INCIDENT_TYPES = [
  "puncture",
  "crosswind",
  "crash_individual",
  "crash_mass",
] as const;

export type RaceIncidentType =
  (typeof RACE_INCIDENT_TYPES)[number];

export type RaceIncident = {
  id: string;
  type: RaceIncidentType;
  riderIds: string[];
  abandonedRiderIds: string[];
  label: string;
};

export const RACE_INJURY_SEVERITIES = [
  "minor",
  "moderate",
  "serious",
] as const;

export type RaceInjurySeverity =
  (typeof RACE_INJURY_SEVERITIES)[number];

export type RaceAbandonment = {
  riderId: string;
  segmentNumber: number;
  reason: "crash";
  injury: {
    type: "abrasions" | "contusion" | "concussion" | "fracture";
    label: string;
    severity: RaceInjurySeverity;
    recoveryDays: number;
  };
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
    status: "finished" | "did_not_finish";
    elapsedTimeSeconds: number;
    gapToWinnerSeconds: number;
    energyAfter: number;
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
  simulation: StageSimulationResult
): StageAttackParticipant[] {
  const participantByRiderId = new Map<string, StageAttackParticipant>();

  for (const snapshot of simulation.timeline) {
    for (const group of snapshot.groups) {
      if (group.type !== "breakaway" && group.type !== "chase") continue;

      for (const riderId of group.riderIds) {
        const existing = participantByRiderId.get(riderId);
        const participationType =
          existing?.participationType === "breakaway" || group.type === "breakaway"
            ? "breakaway"
            : "chase";
        participantByRiderId.set(riderId, {
          riderId,
          participationType,
          firstSegmentNumber: Math.min(
            existing?.firstSegmentNumber ?? snapshot.segmentNumber,
            snapshot.segmentNumber
          ),
        });
      }
    }
  }

  return [...participantByRiderId.values()].sort(
    (left, right) =>
      left.firstSegmentNumber - right.firstSegmentNumber ||
      left.riderId.localeCompare(right.riderId)
  );
}

export type StageRaceStandings = {
  mountain: Array<{ riderId: string; points: number }>;
  sprint: Array<{ riderId: string; points: number }>;
  youth: Array<{ riderId: string; elapsedTimeSeconds: number }>;
  teams: Array<{
    teamId: string;
    teamName: string;
    elapsedTimeSeconds: number;
  }>;
};

export type FinalBattleScenario = {
  contenderIds: string[];
  entryLeaderIds: string[];
  entryGroupLabel: string;
  lateJoiners: Array<{
    riderId: string;
    fromGroupLabel: string;
    gapToLeaderSeconds: number;
  }>;
};

export function getFinalBattleRiderIds(
  simulation: StageSimulationResult
) {
  const finalSnapshot = simulation.timeline.at(-1);
  if (!finalSnapshot) return [];

  const finishers = new Set(
    simulation.results
      .filter((result) => result.status === "finished")
      .map((result) => result.riderId)
  );
  const eligibleGroups = finalSnapshot.groups.filter(
    (group) =>
      group.type !== "dropped" &&
      group.type !== "time_trial" &&
      group.riderIds.some((riderId) => finishers.has(riderId))
  );

  if (eligibleGroups.length === 0) {
    return simulation.results
      .filter((result) => result.status === "finished")
      .slice(0, 8)
      .map((result) => result.riderId);
  }

  const leadingGap = Math.min(
    ...eligibleGroups.map((group) => group.gapToLeaderSeconds)
  );

  return [
    ...new Set(
      eligibleGroups
        .filter((group) => group.gapToLeaderSeconds === leadingGap)
        .flatMap((group) => group.riderIds)
        .filter((riderId) => finishers.has(riderId))
    ),
  ];
}

export function getFinalBattleScenario(
  simulation: StageSimulationResult
): FinalBattleScenario {
  const contenderIds = getFinalBattleRiderIds(simulation);
  const finalSnapshot = simulation.timeline.at(-1);
  const entrySnapshot = simulation.timeline.at(-2) ?? finalSnapshot;

  if (!entrySnapshot || contenderIds.length === 0) {
    return {
      contenderIds,
      entryLeaderIds: contenderIds,
      entryGroupLabel: "Groupe de tête",
      lateJoiners: [],
    };
  }

  const eligibleEntryGroups = entrySnapshot.groups.filter(
    (group) => group.type !== "dropped" && group.type !== "time_trial"
  );
  const leadingGap =
    eligibleEntryGroups.length > 0
      ? Math.min(
          ...eligibleEntryGroups.map((group) => group.gapToLeaderSeconds)
        )
      : 0;
  const leadingGroups = eligibleEntryGroups.filter(
    (group) => group.gapToLeaderSeconds === leadingGap
  );
  const entryLeaderSet = new Set(
    leadingGroups.flatMap((group) => group.riderIds)
  );
  const entryLeaderIds = contenderIds.filter((riderId) =>
    entryLeaderSet.has(riderId)
  );
  const lateJoiners = contenderIds
    .filter((riderId) => !entryLeaderSet.has(riderId))
    .map((riderId) => {
      const origin = eligibleEntryGroups.find((group) =>
        group.riderIds.includes(riderId)
      );

      return {
        riderId,
        fromGroupLabel: origin?.label ?? "Groupe intercalé",
        gapToLeaderSeconds: origin?.gapToLeaderSeconds ?? 0,
      };
    });

  return {
    contenderIds,
    entryLeaderIds,
    entryGroupLabel: leadingGroups[0]?.label ?? "Groupe de tête",
    lateJoiners,
  };
}

type RiderState = {
  rider: RiderSimulationInput;
  energy: number;
  elapsedTimeSeconds: number;
  group:
    | "breakaway"
    | "breakaway_2"
    | "chase"
    | "peloton"
    | "dropped"
    | "abandoned";
  groupSinceSegment: number;
  lostTimeSeconds: number;
};

const SCORE_NOISE = 3.2;

/**
 * Moteur V1 : déterministe, sans dépendance à React ou Supabase. Cette
 * séparation permet de le tester, le rejouer et, plus tard, de l'exécuter
 * côté serveur au moment du départ officiel.
 */
export function simulateRaceStage(
  input: StageSimulationInput
): StageSimulationResult {
  const unavailableRiderIds = new Set(input.unavailableRiderIds ?? []);
  const eligibleInput = {
    ...input,
    riders: input.riders
      .filter((rider) => !unavailableRiderIds.has(rider.id))
      .map((rider) => ({
        ...rider,
        ratings: rider.equipmentEffects
          ? applyEquipmentRatingBonuses(rider.ratings, rider.equipmentEffects, {
              isTimeTrial:
                input.stageType === "individual_time_trial" ||
                input.stageType === "team_time_trial" ||
                input.stageType === "prologue",
            })
          : rider.ratings,
      })),
  };
  validateSimulationInput(eligibleInput);
  const resolvedRiders = assignAutomaticRaceRoles(
    eligibleInput.riders,
    eligibleInput.segments
  );
  const normalizedInput = { ...eligibleInput, riders: resolvedRiders };

  if (
    input.stageType === "individual_time_trial" ||
    input.stageType === "prologue"
  ) {
    return simulateIndividualTimeTrial(normalizedInput);
  }

  if (input.stageType === "team_time_trial") {
    return simulateTeamTimeTrial(normalizedInput);
  }

  return simulateRoadStage(normalizedInput);
}

export function assignAutomaticRaceRoles(
  riders: RiderSimulationInput[],
  segments: RaceStageSegment[]
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
      setBestAutomaticRole(automatic(), "sprinter", (rider) =>
        rider.ratings.sprint * 0.62 +
        rider.ratings.acceleration * 0.25 +
        rider.ratings.flat * 0.13
      );
    }

    if (!hasRole("leader")) {
      setBestAutomaticRole(automatic(), "leader", (rider) =>
        getStageSuitability(rider, segments)
      );
    }

    if (likelySprint && !hasRole("leadout")) {
      setBestAutomaticRole(automatic(), "leadout", (rider) =>
        rider.ratings.flat * 0.34 +
        rider.ratings.sprint * 0.25 +
        rider.ratings.acceleration * 0.2 +
        rider.ratings.resistance * 0.21
      );
    }

    if (!hasRole("free_agent")) {
      setBestAutomaticRole(automatic(), "free_agent", (rider) =>
        rider.ratings.breakaway * 0.56 +
        rider.ratings.acceleration * 0.24 +
        rider.ratings.endurance * 0.2
      );
    }

    for (const rider of automatic()) {
      rider.role = "domestique";
    }
  }

  return resolved;
}

function simulateRoadStage(
  input: StageSimulationInput
): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:road`);
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ])
  );
  const plannedBreakawayIds = selectInitialBreakaway(
    input.riders,
    input.segments,
    random
  );
  const timeline: RaceTimelineSnapshot[] = [];
  const abandonments: RaceAbandonment[] = [];
  const primes: RacePrimeResult[] = [];
  const mountainPoints: Record<string, number> = {};
  const sprintPoints: Record<string, number> = {};
  const breakawayRiders = [...plannedBreakawayIds]
    .map((riderId) => input.riders.find((rider) => rider.id === riderId))
    .filter((rider): rider is RiderSimulationInput => Boolean(rider));
  const selectiveTerrainShare =
    input.segments.filter(
      (segment) => segment.terrain !== "flat" || segment.surface === "cobbles"
    ).length / input.segments.length;
  const likelyMassSprint = isLikelyMassSprint(input.segments);
  const breakawayQuality = average(
    breakawayRiders.map(
      (rider) =>
        rider.ratings.breakaway * 0.46 +
        rider.ratings.endurance * 0.34 +
        rider.form * 0.2
    )
  );
  const breakawayChaseResistance = clamp(
    breakawayQuality * 0.003 +
      selectiveTerrainShare * 0.45 +
      random() * 0.35 -
      (likelyMassSprint ? 0.32 : 0.08),
    0,
    0.72
  );
  const breakawaySuccessChance = clamp(
    0.025 +
      selectiveTerrainShare * 0.3 +
      Math.max(0, breakawayQuality - 72) * 0.007 -
      (likelyMassSprint ? 0.035 : 0),
    0.02,
    0.42
  );
  const breakawayHasWinningDay = random() < breakawaySuccessChance;
  let breakawayGapSeconds = 0;
  let completedDistanceKm = 0;
  let breakawayWasCaught = false;
  const breakawayTargetGapSeconds = Math.round(250 + random() * 150);

  input.segments.forEach((segment, segmentIndex) => {
    const commentary: string[] = [];
    const incidents: RaceIncident[] = [];
    const peloton = getStatesInGroup(states, "peloton");
    const breakaway = getStatesInGroup(states, "breakaway");
    const secondaryBreakaway = getStatesInGroup(states, "breakaway_2");
    const chase = getStatesInGroup(states, "chase");
    const dropped = getStatesInGroup(states, "dropped");
    const raceProgress = segmentIndex / Math.max(1, input.segments.length - 1);
    const chasePressure =
      getPelotonChasePressure(peloton, segment, segmentIndex, input.segments) *
      (breakawayHasWinningDay && raceProgress > 0.52 ? 0.5 : 1);
    const pelotonSeconds = getGroupSegmentTime(
      peloton,
      segment,
      "peloton",
      chasePressure,
      random
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

    if (breakaway.length > 0 && breakawayHasWinningDay && raceProgress > 0.45) {
      breakawaySeconds *= 0.955 + (1 - breakawayChaseResistance) * 0.012;
    }

    if (segmentIndex === 0) {
      commentary.push(
        "Le départ est donné : le peloton reste groupé tandis que les premières offensives se préparent."
      );
    } else if (segmentIndex === 1 && breakaway.length > 0) {
      breakawayGapSeconds = Math.round(24 + random() * 24);
      commentary.push(
        `${formatRiderList(breakaway)} passent à l’attaque et ouvrent un premier écart de ${formatGap(breakawayGapSeconds)}.`
      );
    } else if (breakaway.length > 0) {
      const naturalGap = breakawayGapSeconds + pelotonSeconds - breakawaySeconds;

      if (raceProgress < 0.3) {
        const allowedGap = Math.min(
          breakawayTargetGapSeconds,
          95 + segmentIndex * 58
        );
        breakawayGapSeconds = clamp(
          Math.max(
            naturalGap,
            breakawayGapSeconds + Math.max(8, (allowedGap - breakawayGapSeconds) * 0.48)
          ),
          0,
          540
        );
      } else if (raceProgress < 0.62) {
        const controlledFloor = breakawayTargetGapSeconds * 0.72;
        breakawayGapSeconds = clamp(
          Math.max(controlledFloor, naturalGap),
          0,
          540
        );
      } else {
        const chaseClosingSeconds =
          (raceProgress - 0.58) *
          (likelyMassSprint ? 115 : 72) *
          (1 - breakawayChaseResistance) *
          (breakawayHasWinningDay ? 0.18 : 1);
        breakawayGapSeconds = clamp(
          naturalGap - chaseClosingSeconds,
          -30,
          540
        );
      }
    }

    if (breakaway.length > 0 && raceProgress > 0.12 && raceProgress < 0.58 && commentary.length < 3) {
      commentary.push(
        `Le peloton contrôle l’écart autour de ${formatGap(breakawayGapSeconds)} sans lancer la poursuite.`
      );
    }

    for (const state of states.values()) {
      if (state.group === "abandoned") continue;

      if (state.group === "breakaway") {
        state.elapsedTimeSeconds += breakawaySeconds;
      } else if (state.group === "breakaway_2") {
        state.elapsedTimeSeconds += secondaryBreakawaySeconds;
        state.lostTimeSeconds += Math.max(
          0,
          secondaryBreakawaySeconds - breakawaySeconds
        );
      } else if (state.group === "chase") {
        state.elapsedTimeSeconds += chaseSeconds;
      } else if (state.group === "peloton") {
        state.elapsedTimeSeconds += pelotonSeconds;
      } else {
        const extraLoss = getDroppedRiderLoss(state, segment, random);
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
            : state.group === "peloton"
              ? Math.max(1, peloton.length)
              : Math.max(1, dropped.length),
        chasePressure,
        hasBottleCarrierSupport: hasTeammateBottleCarrier(state, states),
      });
    }

    maybeLaunchCounterAttack({
      states,
      segmentIndex,
      breakawayGapSeconds,
      random,
      commentary,
    });

    resolveExistingChasers({
      states,
      segmentIndex,
      breakawayGapSeconds,
      random,
      commentary,
    });

    dropStrugglingRiders({
      states,
      segment,
      segmentIndex,
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
      random,
    });
    if (incident) {
      incidents.push(incident.incident);
      abandonments.push(...incident.abandonments);
      commentary.unshift(incident.commentary);
    }

    const exhaustedBreakaway = getStatesInGroup(states, "breakaway").filter(
      (state) => state.energy < 9
    );
    for (const state of exhaustedBreakaway) {
      state.group = "breakaway_2";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 12;
      commentary.push(
        `${state.rider.name} lâche l’échappée principale et tente de résister dans un deuxième groupe.`
      );
    }

    promoteSecondaryBreakawayWhenNeeded(states, segmentIndex);

    if (
      getStatesInGroup(states, "breakaway").length > 0 &&
      breakawayGapSeconds <= 0
    ) {
      const pelotonTime = average(
        getStatesInGroup(states, "peloton").map(
          (item) => item.elapsedTimeSeconds
        )
      );
      for (const state of [...states.values()].filter(
        (candidate) =>
          candidate.group === "breakaway" ||
          candidate.group === "breakaway_2" ||
          candidate.group === "chase"
      )) {
        state.group = "peloton";
        state.groupSinceSegment = segmentIndex;
        state.elapsedTimeSeconds = pelotonTime;
      }
      breakawayGapSeconds = 0;
      breakawayWasCaught = true;
      commentary.push("L’échappée est reprise : le peloton est de nouveau groupé.");
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
          `${winner.name} passe en tête ${segment.prime.type === "mountain" ? "du GPM" : "du sprint intermédiaire"}.`
        );
      }
    }

    if (
      segmentIndex > input.segments.length * 0.62 &&
      getStatesInGroup(states, "breakaway").length > 0 &&
      chasePressure > 0.7
    ) {
      commentary.push("Les équipes de sprinteurs organisent la poursuite en tête de peloton.");
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
      })
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
    random,
    finalCommentary
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
      input.segments
    ),
    energyAfter: round(state.energy, 1),
  }));
  rawResults.sort(
    (first, second) =>
      first.elapsedTimeSeconds - second.elapsedTimeSeconds || second.score - first.score
  );
  const winnerTime = rawResults[0].elapsedTimeSeconds;
  const results: StageSimulationResult["results"] = rawResults.map((result, index) => ({
    riderId: result.riderId,
    rank: index + 1,
    status: "finished" as const,
    elapsedTimeSeconds: Math.round(result.elapsedTimeSeconds),
    gapToWinnerSeconds: Math.max(0, Math.round(result.elapsedTimeSeconds - winnerTime)),
    energyAfter: result.energyAfter,
    abandonment: null,
  }));

  for (const abandonment of abandonments) {
    const state = states.get(abandonment.riderId)!;
    results.push({
      riderId: abandonment.riderId,
      rank: null,
      status: "did_not_finish",
      elapsedTimeSeconds: Math.round(state.elapsedTimeSeconds),
      gapToWinnerSeconds: 0,
      energyAfter: round(state.energy, 1),
      abandonment,
    });
  }

  awardFinishClassificationPoints({
    results,
    segments: input.segments,
    mountainPoints,
    sprintPoints,
  });

  if (finalCommentary.length === 0) {
    finalCommentary.push(
      breakawayWasCaught
        ? "Le regroupement conduit le peloton vers l’explication finale."
        : "Les meilleurs coureurs se départagent dans le dernier kilomètre."
    );
  }

  if (
    getStatesInGroup(states, "breakaway").length > 0 &&
    breakawayGapSeconds > 0
  ) {
    finalCommentary.push(
      `L’échappée résiste jusqu’à la ligne avec ${formatGap(breakawayGapSeconds)} d’avance : le peloton a trop attendu.`
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

function simulateIndividualTimeTrial(
  input: StageSimulationInput
): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:itt`);
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ])
  );
  const timeline: RaceTimelineSnapshot[] = [];
  let completedDistanceKm = 0;

  input.segments.forEach((segment, segmentIndex) => {
    for (const state of states.values()) {
      const rating = getTimeTrialSegmentRating(
        state.rider,
        segment,
        input.stageType
      );
      const baseSpeed = getBaseSpeed(segment);
      const fatiguePenalty = Math.max(0, 28 - state.energy) * 0.0045;
      const speed = Math.max(
        8,
        baseSpeed *
          (0.82 + rating * 0.0041 - fatiguePenalty + (random() - 0.5) * 0.014)
      );
      state.elapsedTimeSeconds += (segment.distanceKm / speed) * 3_600;
      state.energy = updateRiderEnergy({
        state,
        segment,
        segmentIndex,
        segmentCount: input.segments.length,
        groupSize: 1,
        chasePressure: 1,
        hasBottleCarrierSupport: false,
        timeTrial: true,
      });
    }

    completedDistanceKm += segment.distanceKm;
    const ordered = [...states.values()].sort(
      (first, second) => first.elapsedTimeSeconds - second.elapsedTimeSeconds
    );
    const leaderTime = ordered[0].elapsedTimeSeconds;
    timeline.push({
      segmentNumber: segment.segmentNumber,
      completedDistanceKm: round(completedDistanceKm, 1),
      groups: ordered.slice(0, 10).map((state, index) => ({
        id: `chrono-${state.rider.id}`,
        label: index === 0 ? "Meilleur temps provisoire" : `Chrono n°${index + 1}`,
        type: "time_trial",
        riderIds: [state.rider.id],
        gapToLeaderSeconds: Math.max(
          0,
          Math.round(state.elapsedTimeSeconds - leaderTime)
        ),
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
  input: StageSimulationInput
): StageSimulationResult {
  const random = createSeededRandom(`${input.id}:${input.seed}:ttt`);
  const teams = groupBy(input.riders, (rider) => rider.teamId);
  const teamTimes = new Map<string, number>();
  const states = new Map<string, RiderState>(
    input.riders.map((rider) => [
      rider.id,
      {
        rider,
        energy: clamp(rider.form, 5, 100),
        elapsedTimeSeconds: 0,
        group: "peloton",
        groupSinceSegment: 0,
        lostTimeSeconds: 0,
      },
    ])
  );
  const timeline: RaceTimelineSnapshot[] = [];
  let completedDistanceKm = 0;

  input.segments.forEach((segment, segmentIndex) => {
    for (const [teamId, riders] of teams) {
      const activeRatings = riders
        .map((rider) => getTimeTrialSegmentRating(rider, segment, "team_time_trial"))
        .sort((first, second) => second - first);
      const scoringCount = Math.min(4, activeRatings.length);
      const teamRating = average(activeRatings.slice(0, scoringCount));
      const speed = Math.max(
        8,
        getBaseSpeed(segment) *
          (0.87 + teamRating * 0.0038 + Math.log2(riders.length + 1) * 0.012 + (random() - 0.5) * 0.01)
      );
      const segmentSeconds = (segment.distanceKm / speed) * 3_600;
      teamTimes.set(teamId, (teamTimes.get(teamId) ?? 0) + segmentSeconds);

      for (const rider of riders) {
        const state = states.get(rider.id)!;
        state.elapsedTimeSeconds = teamTimes.get(teamId)!;
        state.energy = updateRiderEnergy({
          state,
          segment,
          segmentIndex,
          segmentCount: input.segments.length,
          groupSize: riders.length,
          chasePressure: 0.82,
          hasBottleCarrierSupport: riders.some(
            (teammate) =>
              teammate.id !== rider.id &&
              hasSpecialAbility(teammate, "bottle_carrier")
          ),
          timeTrial: true,
        });
      }
    }

    completedDistanceKm += segment.distanceKm;
    const orderedTeams = [...teamTimes.entries()].sort(
      (first, second) => first[1] - second[1]
    );
    const leaderTime = orderedTeams[0][1];
    timeline.push({
      segmentNumber: segment.segmentNumber,
      completedDistanceKm: round(completedDistanceKm, 1),
      groups: orderedTeams.map(([teamId, time], index) => ({
        id: `team-chrono-${teamId}`,
        label: index === 0 ? "Équipe en tête" : `Équipe n°${index + 1}`,
        type: "time_trial",
        riderIds: teams.get(teamId)!.map((rider) => rider.id),
        gapToLeaderSeconds: Math.max(0, Math.round(time - leaderTime)),
        averageEnergy: round(
          average(teams.get(teamId)!.map((rider) => states.get(rider.id)!.energy)),
          1
        ),
      })),
      incidents: [],
      abandonments: [],
      commentary: [
        `${teams.get(orderedTeams[0][0])![0].teamName} signe le meilleur temps intermédiaire.`,
      ],
    });
  });

  return buildTimedResult(input, states, timeline);
}

function buildTimedResult(
  input: StageSimulationInput,
  states: Map<string, RiderState>,
  timeline: RaceTimelineSnapshot[]
): StageSimulationResult {
  const ordered = [...states.values()].sort(
    (first, second) => first.elapsedTimeSeconds - second.elapsedTimeSeconds
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
        Math.round(state.elapsedTimeSeconds - winnerTime)
      ),
      energyAfter: round(state.energy, 1),
      abandonment: null,
    })),
    primes: [],
    mountainPoints: {},
    sprintPoints: {},
  };
}

function selectInitialBreakaway(
  riders: RiderSimulationInput[],
  segments: RaceStageSegment[],
  random: () => number
) {
  const fieldAverage = average(
    riders.map((rider) => getStageSuitability(rider, segments))
  );
  const rankedCandidates = riders
    .filter((rider) => rider.role !== "leader" && rider.role !== "sprinter")
    .map((rider) => {
      const roleBonus =
        rider.role === "free_agent"
          ? 16
          : rider.role === "mountain_classification"
            ? 9
            : 0;
      const abilityBonus = hasSpecialAbility(rider, "panache") ? 12 : 0;
      const score =
        rider.ratings.breakaway * 0.55 +
        rider.ratings.acceleration * 0.2 +
        rider.ratings.endurance * 0.15 +
        rider.form * 0.1 +
        roleBonus +
        abilityBonus +
        random() * 18;
      return { rider, score };
    })
    .sort((first, second) => second.score - first.score);
  const candidates = rankedCandidates.filter(({ rider, score }) => {
      const threat = getStageSuitability(rider, segments) - fieldAverage;
      return score > 63 + Math.max(0, threat * 0.7);
    });
  const maximum = Math.max(2, Math.min(8, Math.ceil(riders.length / 4)));
  const selected = candidates.slice(0, maximum).map(({ rider }) => rider.id);

  if (selected.length === 0) {
    selected.push(
      ...rankedCandidates
        .slice(0, Math.min(2, rankedCandidates.length))
        .map(({ rider }) => rider.id)
    );
  }

  return new Set(selected);
}

function getGroupSegmentTime(
  states: RiderState[],
  segment: RaceStageSegment,
  group: "breakaway" | "peloton",
  chasePressure: number,
  random: () => number
) {
  if (states.length === 0) return 0;
  const ratings = states
    .map((state) => getTerrainRating(state.rider, segment))
    .sort((first, second) => second - first);
  const scoringShare = group === "peloton" ? 0.42 : 0.72;
  const scoringCount = Math.max(1, Math.ceil(ratings.length * scoringShare));
  const groupRating = average(ratings.slice(0, scoringCount));
  const averageEnergy = average(states.map((state) => state.energy));
  const draftingBonus =
    group === "peloton"
      ? Math.min(0.095, Math.log2(states.length + 1) * 0.018)
      : Math.min(0.055, Math.log2(states.length + 1) * 0.013);
  const chaseBonus = group === "peloton" ? chasePressure * 0.055 : 0.018;
  const fatiguePenalty = Math.max(0, 30 - averageEnergy) * 0.0035;
  const speed = Math.max(
    8,
    getBaseSpeed(segment) *
      (0.69 + groupRating * 0.0029 + draftingBonus + chaseBonus - fatiguePenalty + (random() - 0.5) * 0.012)
  );

  return (segment.distanceKm / speed) * 3_600;
}

function updateRiderEnergy({
  state,
  segment,
  segmentIndex,
  segmentCount,
  groupSize,
  chasePressure,
  hasBottleCarrierSupport,
  timeTrial = false,
}: {
  state: RiderState;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  groupSize: number;
  chasePressure: number;
  hasBottleCarrierSupport: boolean;
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
    ((rider.role === "domestique" || rider.role === "leadout") &&
      segmentIndex < segmentCount - 2 &&
      chasePressure > 0.45);
  const groupShelter = timeTrial
    ? 1
    : state.group === "peloton"
      ? Math.max(0.55, 0.77 - Math.log2(groupSize + 1) * 0.035)
      : state.group === "breakaway" ||
          state.group === "breakaway_2" ||
          state.group === "chase"
        ? Math.max(0.74, 0.93 - Math.log2(groupSize + 1) * 0.035)
        : 0.88;
  const workFactor =
    state.group === "breakaway" ||
    state.group === "breakaway_2" ||
    state.group === "chase"
      ? 1.48
      : isWorking
        ? 1.2
        : 0.86;
  const enduranceFactor = 1.2 - rider.ratings.endurance / 300;
  const longEffortFactor = 1 + (segmentIndex / Math.max(1, segmentCount - 1)) * 0.22;
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
    enduranceFactor *
    longEffortFactor *
    abilityFactor *
    teamSupport;

  return clamp(state.energy - loss, 0, 100);
}

function hasTeammateBottleCarrier(
  state: RiderState,
  states: Map<string, RiderState>
) {
  return [...states.values()].some(
    (teammate) =>
      teammate.rider.id !== state.rider.id &&
      teammate.rider.teamId === state.rider.teamId &&
      teammate.group === state.group &&
      hasSpecialAbility(teammate.rider, "bottle_carrier")
  );
}

function dropStrugglingRiders({
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
  if (segmentIndex === 0 || segment.terrain === "descent") return;
  const peloton = getStatesInGroup(states, "peloton");
  if (peloton.length < 4) return;
  const pace = average(peloton.map((state) => getTerrainRating(state.rider, segment)));

  for (const state of peloton) {
    const holdingScore =
      getTerrainRating(state.rider, segment) * 0.62 +
      state.rider.ratings.resistance * 0.18 +
      state.energy * 0.2 +
      random() * SCORE_NOISE;
    const difficulty =
      segment.terrain === "climb"
        ? Math.abs(segment.averageGradientPct) * 0.72
        : segment.surface === "cobbles"
          ? 4.5
          : 0;

    if (state.energy < 4 || holdingScore + 12 < pace + difficulty) {
      state.group = "dropped";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 12 + difficulty * 2;
      if (commentary.length < 4) {
        commentary.push(`${state.rider.name} ne tient plus le rythme et bascule parmi les attardés.`);
      }
    }
  }
}

function maybeLaunchCounterAttack({
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
  if (segmentIndex < 1 || segmentIndex > 3 || breakawayGapSeconds < 35) return;
  const candidate = getStatesInGroup(states, "peloton")
    .filter(
      (state) =>
        hasSpecialAbility(state.rider, "chase_potato") ||
        (hasSpecialAbility(state.rider, "panache") && state.rider.role === "free_agent")
    )
    .sort(
      (first, second) =>
        second.rider.ratings.acceleration + second.rider.ratings.breakaway -
        first.rider.ratings.acceleration - first.rider.ratings.breakaway
    )[0];

  if (candidate && random() > 0.46) {
    candidate.group = "chase";
    candidate.groupSinceSegment = segmentIndex;
    candidate.elapsedTimeSeconds -= Math.min(18, breakawayGapSeconds * 0.18);
    commentary.push(
      `${candidate.rider.name} sort seul du peloton : le voilà en chasse-patate entre les deux groupes.`
    );
  }
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
  const pelotonTime = average(
    peloton.map((state) => state.elapsedTimeSeconds)
  );

  for (const state of getStatesInGroup(states, "chase")) {
    if (state.groupSinceSegment >= segmentIndex) continue;

    const bridgeScore =
      state.rider.ratings.breakaway * 0.42 +
      state.rider.ratings.acceleration * 0.34 +
      state.energy * 0.24 +
      random() * 12;

    if (
      breakawayGapSeconds > 0 &&
      breakawayGapSeconds < 150 &&
      bridgeScore > 77
    ) {
      state.group = "breakaway_2";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 8;
      commentary.push(
        `${state.rider.name} se rapproche de l’échappée, mais reste dans un groupe intercalé.`
      );
    } else if (random() < 0.66) {
      state.group = "peloton";
      state.groupSinceSegment = segmentIndex;
      state.elapsedTimeSeconds = Math.max(
        state.elapsedTimeSeconds,
        pelotonTime
      );
    } else {
      state.group = "dropped";
      state.groupSinceSegment = segmentIndex;
      state.lostTimeSeconds += 10 + random() * 12;
    }
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
    segment.terrain === "climb" ||
    segment.surface === "cobbles";
  const tiredRiders = breakaway.filter(
    (state) => state.energy < 24
  );

  if (
    tiredRiders.length === 0 &&
    (!selectiveTerrain || random() > 0.42)
  ) {
    return;
  }

  const splitCount = Math.min(
    2,
    Math.max(1, Math.floor(breakaway.length / 3))
  );
  const detached = [...breakaway]
    .sort(
      (first, second) =>
        first.energy +
        getTerrainRating(first.rider, segment) * 0.45 -
        (second.energy +
          getTerrainRating(second.rider, segment) * 0.45)
    )
    .slice(0, splitCount);

  for (const state of detached) {
    state.group = "breakaway_2";
    state.groupSinceSegment = segmentIndex;
    state.lostTimeSeconds += 10 + random() * 14;
  }

  commentary.push(
    `${formatRiderList(detached)} lâchent prise : l’échappée se scinde en deux groupes.`
  );
}

function promoteSecondaryBreakawayWhenNeeded(
  states: Map<string, RiderState>,
  segmentIndex: number
) {
  if (getStatesInGroup(states, "breakaway").length > 0) {
    return;
  }

  const secondary = getStatesInGroup(
    states,
    "breakaway_2"
  ).sort((first, second) => second.energy - first.energy);
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
  random,
}: {
  states: Map<string, RiderState>;
  segment: RaceStageSegment;
  segmentIndex: number;
  segmentCount: number;
  random: () => number;
}): {
  incident: RaceIncident;
  abandonments: RaceAbandonment[];
  commentary: string;
} | null {
  if (
    segmentIndex < 2 ||
    segmentIndex >= segmentCount - 1
  ) {
    return null;
  }

  const activeStates = [...states.values()].filter(
    (state) =>
      state.group !== "dropped" &&
      state.group !== "abandoned"
  );
  if (activeStates.length === 0) return null;

  const incidentRoll = random();
  const punctureThreshold =
    segment.surface === "cobbles" ? 0.105 : 0.065;
  const individualCrashThreshold =
    punctureThreshold + 0.045;
  const massCrashThreshold =
    individualCrashThreshold + 0.028;
  const crosswindThreshold =
    massCrashThreshold +
    (segment.terrain === "flat" ? 0.065 : 0.018);

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
  let affected: RiderState[];

  if (type === "crash_mass" || type === "crosswind") {
    const candidates =
      peloton.length >= 4 ? peloton : activeStates;
    const affectedCount = Math.min(
      candidates.length,
      type === "crash_mass"
        ? 3 + Math.floor(random() * 4)
        : 2 + Math.floor(random() * 4)
    );

    affected = [...candidates]
      .sort((first, second) => {
        const firstHolding =
          first.rider.ratings.flat * 0.55 +
          first.rider.ratings.resistance * 0.45 +
          random() * 10;
        const secondHolding =
          second.rider.ratings.flat * 0.55 +
          second.rider.ratings.resistance * 0.45 +
          random() * 10;
        return firstHolding - secondHolding;
      })
      .slice(0, affectedCount);
  } else {
    affected = [
      activeStates[
        Math.floor(random() * activeStates.length)
      ],
    ];
  }

  const abandonments: RaceAbandonment[] = [];

  for (const state of affected) {
    if (type === "puncture") {
      state.energy = clamp(state.energy - 1.5, 0, 100);
      state.lostTimeSeconds += 12 + random() * 12;
    } else if (type === "crosswind") {
      state.energy = clamp(state.energy - 2.5, 0, 100);
      state.lostTimeSeconds += 9 + random() * 10;
    } else {
      state.energy = clamp(
        state.energy -
          (type === "crash_mass" ? 6 : 4),
        0,
        100
      );
      state.lostTimeSeconds +=
        (type === "crash_mass" ? 18 : 14) +
        random() * 16;
    }

    const crashAbandonment =
      type === "crash_individual" || type === "crash_mass"
        ? maybeCreateCrashAbandonment(
            state,
            segmentIndex,
            type,
            random
          )
        : null;

    if (crashAbandonment) {
      abandonments.push(crashAbandonment);
      state.group = "abandoned";
      state.energy = 0;
    } else if (state.group === "breakaway") {
      state.group = "breakaway_2";
    } else if (state.group !== "breakaway_2") {
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
  } satisfies Record<
    RaceIncidentType,
    { label: string; commentary: string }
  >;

  return {
    incident: {
      id: `${segmentIndex + 1}-${type}-${affected
        .map((state) => state.rider.id)
        .join("-")}`,
      type,
      riderIds: affected.map((state) => state.rider.id),
      abandonedRiderIds: abandonments.map(
        (abandonment) => abandonment.riderId
      ),
      label: abandonments.length
        ? `${details[type].label} · ${abandonments.length} abandon${
            abandonments.length > 1 ? "s" : ""
          }`
        : details[type].label,
    },
    abandonments,
    commentary: abandonments.length
      ? `${details[type].commentary} ${formatRiderList(
          abandonments.map(
            (abandonment) => states.get(abandonment.riderId)!
          )
        )} ${abandonments.length > 1 ? "abandonnent" : "abandonne"}, sur blessure.`
      : details[type].commentary,
  };
}

function maybeCreateCrashAbandonment(
  state: RiderState,
  segmentIndex: number,
  crashType: "crash_individual" | "crash_mass",
  random: () => number
): RaceAbandonment | null {
  const vulnerability =
    Math.max(0, 72 - state.rider.ratings.resistance) * 0.004 +
    Math.max(0, 45 - state.energy) * 0.004;
  const protectionFactor =
    1 -
    clamp(
      state.rider.equipmentEffects?.injuryRiskReductionPct ?? 0,
      0,
      45
    ) /
      100;
  const abandonmentChance = clamp(
    ((crashType === "crash_individual" ? 0.2 : 0.11) + vulnerability) *
      protectionFactor,
    0.04,
    0.42
  );

  if (random() >= abandonmentChance) return null;

  const severityRoll = random();
  const injury =
    severityRoll < 0.58
      ? {
          type: "abrasions" as const,
          label: "Plaies et contusions",
          severity: "minor" as const,
          recoveryDays: 2 + Math.floor(random() * 5),
        }
      : severityRoll < 0.88
        ? {
            type: "concussion" as const,
            label: "Commotion",
            severity: "moderate" as const,
            recoveryDays: 8 + Math.floor(random() * 13),
          }
        : {
            type: "fracture" as const,
            label: "Fracture",
            severity: "serious" as const,
            recoveryDays: 28 + Math.floor(random() * 29),
          };

  return {
    riderId: state.rider.id,
    segmentNumber: segmentIndex + 1,
    reason: "crash",
    injury,
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
  const finishers = results.filter(
    (result) => result.status === "finished"
  );
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
      if (riderId) mountainPoints[riderId] = (mountainPoints[riderId] ?? 0) + points;
    });
  }

  const flatFinish =
    finalSegment.terrain === "flat" &&
    segments.slice(-3).filter((segment) => segment.terrain === "flat")
      .length >= 2;
  if (flatFinish) {
    [50, 35, 25, 20, 16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2].forEach(
      (points, index) => {
        const riderId = finishers[index]?.riderId;
        if (riderId) sprintPoints[riderId] = (sprintPoints[riderId] ?? 0) + points;
      }
    );
  }
}

export function buildStageRaceStandings(
  stageResults: StageSimulationResult[]
): StageRaceStandings {
  const riderById = new Map(
    stageResults.flatMap((stage) => stage.resolvedRiders).map((rider) => [rider.id, rider])
  );
  const abandonedRiderIds = new Set(
    stageResults.flatMap((stage) =>
      stage.results
        .filter((result) => result.status === "did_not_finish")
        .map((result) => result.riderId)
    )
  );
  const riderTimes = new Map<string, number>();
  const teamTimes = new Map<string, number>();
  const mountainPoints = new Map<string, number>();
  const sprintPoints = new Map<string, number>();

  for (const stage of stageResults) {
    for (const result of stage.results) {
      if (result.status !== "finished") continue;
      const rider = riderById.get(result.riderId);
      if (!rider) continue;
      riderTimes.set(
        rider.id,
        (riderTimes.get(rider.id) ?? 0) + result.elapsedTimeSeconds
      );
      teamTimes.set(
        rider.teamId,
        (teamTimes.get(rider.teamId) ?? 0) + result.elapsedTimeSeconds
      );
    }

    for (const [riderId, points] of Object.entries(stage.mountainPoints)) {
      mountainPoints.set(riderId, (mountainPoints.get(riderId) ?? 0) + points);
    }
    for (const [riderId, points] of Object.entries(stage.sprintPoints)) {
      sprintPoints.set(riderId, (sprintPoints.get(riderId) ?? 0) + points);
    }
  }

  const activeRider = ([riderId]: [string, number]) =>
    !abandonedRiderIds.has(riderId);
  const byPoints = (first: [string, number], second: [string, number]) =>
    second[1] - first[1];

  return {
    mountain: [...mountainPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    sprint: [...sprintPoints.entries()]
      .filter(activeRider)
      .sort(byPoints)
      .map(([riderId, points]) => ({ riderId, points })),
    youth: [...riderTimes.entries()]
      .filter(
        ([riderId]) =>
          !abandonedRiderIds.has(riderId) &&
          (riderById.get(riderId)?.age ?? 99) < 25
      )
      .sort((first, second) => first[1] - second[1])
      .map(([riderId, elapsedTimeSeconds]) => ({
        riderId,
        elapsedTimeSeconds,
      })),
    teams: [...teamTimes.entries()]
      .sort((first, second) => first[1] - second[1])
      .map(([teamId, elapsedTimeSeconds]) => ({
        teamId,
        teamName:
          [...riderById.values()].find((rider) => rider.teamId === teamId)
            ?.teamName ?? teamId,
        elapsedTimeSeconds,
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
    classification: ordered.slice(0, prime.pointsScale.length).map((state, index) => ({
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
  random: () => number
) {
  const roleBonus =
    prime.type === "mountain" && state.rider.role === "mountain_classification"
      ? 16
      : prime.type === "intermediate_sprint" && state.rider.role === "sprinter"
        ? 10
        : state.rider.role === "leader"
          ? -4
          : 0;
  return (
    (prime.type === "mountain"
      ? getTerrainRating(state.rider, segment) * 0.68 +
        state.rider.ratings.acceleration * 0.2
      : state.rider.ratings.sprint * 0.58 +
        state.rider.ratings.acceleration * 0.3) +
    state.energy * 0.12 +
    roleBonus +
    random() * SCORE_NOISE
  );
}

function getRoadFinishScores(
  states: Map<string, RiderState>,
  segments: RaceStageSegment[],
  random: () => number,
  commentary: string[]
) {
  const scores = new Map<string, number>();
  const sprintFinish = isLikelyMassSprint(segments);
  const peloton = getStatesInGroup(states, "peloton");
  const trainScores = getSprintTrainScores(peloton);
  const positionedTeams = [...trainScores.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([teamId]) => teamId);

  if (sprintFinish && peloton.length > 3) {
    const bestTrain = positionedTeams[0];
    if (bestTrain) {
      const teamName = peloton.find((state) => state.rider.teamId === bestTrain)?.rider.teamName;
      if (teamName) commentary.push(`${teamName} prend la tête de la mise en place du sprint.`);
    }
  }

  for (const state of states.values()) {
    const rider = state.rider;
    const lastSegment = segments.at(-1)!;
    let score: number;

    if (sprintFinish && state.group === "peloton") {
      const trainRank = positionedTeams.indexOf(rider.teamId);
      const trainBonus =
        trainRank === 0 ? 11 : trainRank === 1 ? 7 : trainRank < 4 ? 3 : -2;
      const roleFactor =
        rider.role === "sprinter" ? 15 : rider.role === "leadout" ? -6 : 0;
      const lostWheelPenalty = trainRank > 2 && random() < 0.2 ? 8 : 0;
      score =
        rider.ratings.sprint * 0.48 +
        rider.ratings.acceleration * 0.3 +
        rider.ratings.resistance * 0.1 +
        state.energy * 0.12 +
        trainBonus +
        roleFactor -
        lostWheelPenalty;
    } else {
      const attackBonus = hasSpecialAbility(rider, "giclette") ? 6 : 0;
      const roleBonus = rider.role === "leader" ? 8 : rider.role === "free_agent" ? 3 : 0;
      score =
        getTerrainRating(rider, lastSegment) * 0.5 +
        rider.ratings.acceleration * 0.24 +
        rider.ratings.resistance * 0.14 +
        state.energy * 0.12 +
        attackBonus +
        roleBonus;
    }

    scores.set(rider.id, score + random() * SCORE_NOISE);
  }

  return scores;
}

function getRoadFinishTime(
  state: RiderState,
  states: Map<string, RiderState>,
  scores: Map<string, number>,
  segments: RaceStageSegment[]
) {
  const ownScore = scores.get(state.rider.id) ?? 0;
  const peers = [...states.values()]
    .filter((peer) => peer.group === state.group)
    .map((peer) => scores.get(peer.rider.id) ?? 0);
  const bestScore = Math.max(...peers);
  const sprintFinish = isLikelyMassSprint(segments) && state.group === "peloton";

  if (sprintFinish) {
    // La photo-finish ordonne les coureurs, mais un peloton qui franchit la
    // ligne groupé reçoit un seul temps officiel. Les écarts ne viennent que
    // des cassures entre groupes, jamais de la longueur d'un vélo.
    return average(
      [...states.values()]
        .filter((peer) => peer.group === "peloton")
        .map((peer) => peer.elapsedTimeSeconds)
    );
  }

  const finishGap = Math.max(0, bestScore - ownScore) * 0.72;
  return state.elapsedTimeSeconds + finishGap;
}

function getSprintTrainScores(states: RiderState[]) {
  const teams = groupBy(states, (state) => state.rider.teamId);
  const result = new Map<string, number>();

  for (const [teamId, teamStates] of teams) {
    const leadouts = teamStates.filter((state) => state.rider.role === "leadout");
    const domestiques = teamStates.filter((state) => state.rider.role === "domestique");
    const helpers = leadouts.length > 0 ? leadouts : domestiques.slice(0, 2);
    const score = helpers.length
      ? average(
          helpers.map(
            (state) =>
              state.rider.ratings.flat * 0.33 +
              state.rider.ratings.sprint * 0.24 +
              state.rider.ratings.acceleration * 0.18 +
              state.energy * 0.25
          )
        ) + helpers.length * 2.5
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
  const secondaryBreakaway = getStatesInGroup(
    states,
    "breakaway_2"
  );
  const chase = getStatesInGroup(states, "chase");
  const peloton = getStatesInGroup(states, "peloton");
  const dropped = getStatesInGroup(states, "dropped");
  const groups: RaceGroupSnapshot[] = [];
  const hasBreakaway =
    breakaway.length > 0 && breakawayGapSeconds > 0;

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
            average(
              secondaryBreakaway.map(
                (state) => state.lostTimeSeconds
              )
            ),
            8,
            Math.max(10, breakawayGapSeconds - 5)
          )
        )
      )
    );
  }

  if (chase.length > 0 && hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "chase",
        "Chasse-patate",
        chase,
        Math.round(
          Math.max(6, breakawayGapSeconds * 0.58)
        )
      )
    );
  }

  if (peloton.length > 0) {
    groups.push(
      toGroupSnapshot(
        "peloton",
        "Peloton",
        peloton,
        hasBreakaway
          ? Math.max(0, Math.round(breakawayGapSeconds))
          : 0
      )
    );
  }

  if (chase.length > 0 && !hasBreakaway) {
    groups.push(
      toGroupSnapshot(
        "chase",
        "Groupe de chasse",
        chase,
        Math.round(
          Math.max(
            5,
            average(
              chase.map(
                (state) => state.lostTimeSeconds
              )
            )
          )
        )
      )
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
            average(
              secondaryBreakaway.map(
                (state) => state.lostTimeSeconds
              )
            )
          )
        )
      )
    );
  }

  if (dropped.length > 0) {
    const baseGap = hasBreakaway
      ? Math.max(0, breakawayGapSeconds)
      : 0;
    groups.push(
      toGroupSnapshot(
        "dropped",
        "Attardés",
        dropped,
        Math.round(baseGap + average(dropped.map((state) => state.lostTimeSeconds)))
      )
    );
  }

  return {
    segmentNumber,
    completedDistanceKm: round(completedDistanceKm, 1),
    groups,
    incidents,
    abandonments: [...abandonments],
    commentary:
      commentary.length > 0
        ? commentary.slice(0, 4)
        : [`Le rythme se stabilise après ${formatDistance(completedDistanceKm)} km.`],
  };
}

function toGroupSnapshot(
  type: "breakaway" | "chase" | "peloton" | "dropped",
  label: string,
  states: RiderState[],
  gapToLeaderSeconds: number
): RaceGroupSnapshot {
  return {
    id: `${type}-${states.map((state) => state.rider.id).sort().join("-")}`,
    label,
    type,
    riderIds: states.map((state) => state.rider.id),
    gapToLeaderSeconds,
    averageEnergy: round(average(states.map((state) => state.energy)), 1),
  };
}

function getPelotonChasePressure(
  peloton: RiderState[],
  segment: RaceStageSegment,
  segmentIndex: number,
  segments: RaceStageSegment[]
) {
  const progress = segmentIndex / Math.max(1, segments.length - 1);
  const sprintTeams = new Set(
    peloton
      .filter((state) => state.rider.role === "sprinter")
      .map((state) => state.rider.teamId)
  ).size;
  const terrainFactor =
    segment.terrain === "flat" ? 0.06 : segment.terrain === "climb" ? -0.07 : 0;

  if (progress < 0.3) {
    return clamp(0.16 + sprintTeams * 0.018 + terrainFactor, 0.12, 0.32);
  }

  if (progress < 0.62) {
    return clamp(0.3 + sprintTeams * 0.035 + terrainFactor, 0.28, 0.56);
  }

  const finalUrgency = (progress - 0.62) * 1.2;
  return clamp(0.52 + sprintTeams * 0.075 + terrainFactor + finalUrgency, 0.48, 1);
}

function getTerrainRating(rider: RiderSimulationInput, segment: RaceStageSegment) {
  let rating: number;

  if (segment.terrain === "climb") {
    const longSteepClimb = Math.abs(segment.averageGradientPct) >= 6;
    rating = longSteepClimb
      ? rider.ratings.mountain * 0.72 + rider.ratings.hills * 0.28
      : rider.ratings.hills * 0.62 + rider.ratings.mountain * 0.38;
  } else if (segment.terrain === "descent") {
    rating = rider.ratings.downhill * 0.72 + rider.ratings.resistance * 0.28;
  } else {
    rating = rider.ratings.flat;
  }

  if (segment.surface === "cobbles") {
    rating = rating * 0.36 + rider.ratings.cobbles * 0.64;
  }

  return rating;
}

function getTimeTrialSegmentRating(
  rider: RiderSimulationInput,
  segment: RaceStageSegment,
  stageType: SimulationStageType
) {
  const clockRating =
    stageType === "prologue" ? rider.ratings.prologue : rider.ratings.timeTrial;
  return (
    clockRating * 0.58 +
    getTerrainRating(rider, segment) * 0.27 +
    rider.ratings.endurance * 0.1 +
    rider.form * 0.05
  );
}

function getStageSuitability(
  rider: RiderSimulationInput,
  segments: RaceStageSegment[]
) {
  const distance = Math.max(1, segments.reduce((total, segment) => total + segment.distanceKm, 0));
  const terrainScore = segments.reduce(
    (total, segment) => total + getTerrainRating(rider, segment) * segment.distanceKm,
    0
  );
  return terrainScore / distance * 0.75 + rider.ratings.endurance * 0.15 + rider.form * 0.1;
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
  random: () => number
) {
  const weakness = Math.max(0, 65 - getTerrainRating(state.rider, segment));
  return 4 + weakness * 0.24 + random() * 5;
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
  score: (rider: RiderSimulationInput) => number
) {
  const best = [...riders].sort((first, second) => score(second) - score(first))[0];
  if (best) best.role = role;
}

function validateSimulationInput(input: StageSimulationInput) {
  if (input.riders.length < 2) {
    throw new Error("Une simulation requiert au moins deux coureurs.");
  }
  if (input.segments.length === 0) {
    throw new Error("Une simulation requiert au moins un tronçon.");
  }
  if (new Set(input.riders.map((rider) => rider.id)).size !== input.riders.length) {
    throw new Error("Chaque coureur doit posséder un identifiant unique.");
  }
  validateExplicitRoles(input.riders);
}

function validateExplicitRoles(riders: RiderSimulationInput[]) {
  const teams = groupBy(riders, (rider) => rider.teamId);

  for (const teamRiders of teams.values()) {
    for (const uniqueRole of ["leader", "sprinter"] satisfies RaceRole[]) {
      if (teamRiders.filter((rider) => rider.role === uniqueRole).length > 1) {
        throw new Error(
          `Une équipe ne peut désigner qu’un seul ${RACE_ROLE_LABELS[uniqueRole].toLowerCase()}.`
        );
      }
    }
  }
}

function getStatesInGroup(
  states: Map<string, RiderState>,
  group: RiderState["group"]
) {
  return [...states.values()].filter((state) => state.group === group);
}

function formatRiderList(states: RiderState[]) {
  const names = states.slice(0, 3).map((state) => state.rider.name);
  return states.length > 3 ? `${names.join(", ")} et ${states.length - 3} autres` : names.join(", ");
}

function formatGap(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return minutes > 0 ? `${minutes}’${String(remainingSeconds).padStart(2, "0")}”` : `${remainingSeconds}”`;
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
