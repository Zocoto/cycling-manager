import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  accumulateRaceGroupGapsFromLeader,
  applyStageTimeLimit,
  areFinishersInSameTimeGroup,
  assignAutomaticRaceRoles,
  buildStageRaceStandings,
  getStageAttackParticipants,
  getFinalBattleRiderIds,
  getFinalBattleScenario,
  getHillyClimbSelectionRating,
  getLargeBreakawayDynamics,
  getLeadingFinishGroupRiderIds,
  getStageTimeLimitAllowanceSeconds,
  getNextHillyClimbLoad,
  isMassGroupFinish,
  reduceMechanicalIncidentTimeLoss,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";
import type { RaceStageSegment } from "./race-profiles";

describe("areFinishersInSameTimeGroup", () => {
  it("conserve les écarts de 1, 2 ou 3 secondes en MT et casse à 4 secondes", () => {
    expect(areFinishersInSameTimeGroup(100, 101)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 102)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 103)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 104)).toBe(false);
  });
});

describe("accumulateRaceGroupGapsFromLeader", () => {
  it("exprime chaque écart successif depuis le groupe de tête", () => {
    const groups = [0, 8, 10, 8].map((gapToLeaderSeconds, index) => ({
      id: `group-${index}`,
      label: `Groupe ${index}`,
      type: index === 0 ? ("peloton" as const) : ("dropped" as const),
      riderIds: [`rider-${index}`],
      gapToLeaderSeconds,
      averageEnergy: 50,
    }));

    expect(
      accumulateRaceGroupGapsFromLeader(groups).map(
        (group) => group.gapToLeaderSeconds
      )
    ).toEqual([0, 8, 10, 10]);
  });
});

describe("reduceMechanicalIncidentTimeLoss", () => {
  it("réduit uniquement le temps d’avarie dans la limite de 80 %", () => {
    expect(reduceMechanicalIncidentTimeLoss(20, 35)).toBe(13);
    expect(reduceMechanicalIncidentTimeLoss(20, 120)).toBeCloseTo(4);
    expect(reduceMechanicalIncidentTimeLoss(20, -10)).toBe(20);
  });
});

describe("getLargeBreakawayDynamics", () => {
  it("active le cout double uniquement au-dela de dix echappes", () => {
    expect(getLargeBreakawayDynamics(10)).toEqual({
      effortMultiplier: 1,
      pacePenalty: 0,
    });
    expect(getLargeBreakawayDynamics(11)).toEqual({
      effortMultiplier: 2,
      pacePenalty: 0.004,
    });
    expect(getLargeBreakawayDynamics(100)).toEqual({
      effortMultiplier: 2,
      pacePenalty: 0.035,
    });
  });
});
describe("stage time limit", () => {
  it("keeps time limits generous and profile-dependent", () => {
    expect(
      getStageTimeLimitAllowanceSeconds({
        winnerElapsedTimeSeconds: 10_000,
        profileType: "flat",
        stageType: "road",
      })
    ).toBe(1_200);
    expect(
      getStageTimeLimitAllowanceSeconds({
        winnerElapsedTimeSeconds: 10_000,
        profileType: "mountain",
        stageType: "road",
      })
    ).toBe(2_200);
  });

  it("marks an over-limit rider HT and removes them from tour standings", () => {
    const input = createDemoSimulationInput("sprint-littoral", 91);
    const simulation = simulateRaceStage(input);
    const winner = simulation.results.find(
      (result) => result.status === "finished" && result.rank === 1
    )!;
    const slowRider = simulation.results
      .filter((result) => result.status === "finished")
      .at(-1)!;
    const allowanceSeconds = getStageTimeLimitAllowanceSeconds({
      winnerElapsedTimeSeconds: winner.elapsedTimeSeconds,
      profileType: input.profileType,
      stageType: input.stageType,
    });
    const forcedSimulation = {
      ...simulation,
      results: simulation.results.map((result) =>
        result.riderId === slowRider.riderId
          ? {
              ...result,
              status: "finished" as const,
              elapsedTimeSeconds:
                winner.elapsedTimeSeconds + allowanceSeconds + 1,
              gapToWinnerSeconds: allowanceSeconds + 1,
            }
          : result
      ),
    };

    const limited = applyStageTimeLimit(forcedSimulation, input);
    const limitedRider = limited.results.find(
      (result) => result.riderId === slowRider.riderId
    )!;

    expect(limitedRider).toMatchObject({
      status: "outside_time_limit",
      rank: null,
    });
    expect(
      limited.timeline.at(-1)?.groups.some(
        (group) =>
          group.label === "Hors délais" &&
          group.riderIds.includes(slowRider.riderId)
      )
    ).toBe(true);
    expect(
      buildStageRaceStandings([limited]).general.some(
        (row) => row.riderId === slowRider.riderId
      )
    ).toBe(false);
    expect(limited.sprintPoints[slowRider.riderId] ?? 0).toBe(0);
  });
});

describe("simulateRaceStage", () => {
  it("rejoue exactement la même course avec la même graine", () => {
    const input = createDemoSimulationInput("sprint-littoral", 12);

    expect(simulateRaceStage(input)).toEqual(simulateRaceStage(input));
  });

  it("double la depense des grandes echappees et de la poursuite", () => {
    const base = createDemoSimulationInput("sprint-littoral", 12);
    const segments: RaceStageSegment[] = Array.from(
      { length: 4 },
      (_, index) => ({
        segmentNumber: index + 1,
        distanceKm: 20,
        terrain: "flat" as const,
        averageGradientPct: 0,
        surface: "asphalt" as const,
        prime: null,
      })
    );
    const runWithAttackers = (attackerCount: number) =>
      simulateRaceStage({
        ...base,
        id: "large-breakaway-effort-test",
        seed: "large-breakaway-effort-test",
        profileType: "flat",
        segments,
        riders: Array.from({ length: 48 }, (_, index) => {
          const isAttacker = index < attackerCount;
          return {
            ...createSelectionTestRider(
              `large-breakaway-${index}`,
              isAttacker
                ? {
                    flat: 78,
                    acceleration: 88,
                    endurance: 84,
                    resistance: 80,
                    breakaway: 92,
                  }
                : {
                    flat: 75,
                    acceleration: 40,
                    endurance: 70,
                    resistance: 70,
                    breakaway: 20,
                  }
            ),
            form: 80,
            role: isAttacker
              ? ("free_agent" as const)
              : index === 47
                ? ("domestique" as const)
                : ("leader" as const),
          };
        }),
      });

    const regularSimulation = runWithAttackers(10);
    const largeSimulation = runWithAttackers(12);
    const regularBreakaway = regularSimulation.timeline[1]?.groups.find(
      (group) => group.type === "breakaway"
    );
    const largeBreakaway = largeSimulation.timeline[1]?.groups.find(
      (group) => group.type === "breakaway"
    );

    expect(regularBreakaway?.riderIds).toHaveLength(10);
    expect(largeBreakaway?.riderIds).toHaveLength(12);
    const regularChaser = regularSimulation.results.find(
      (result) => result.riderId === "large-breakaway-47"
    );
    const largeBreakawayChaser = largeSimulation.results.find(
      (result) => result.riderId === "large-breakaway-47"
    );

    expect(largeBreakaway!.averageEnergy).toBeLessThan(
      regularBreakaway!.averageEnergy - 4
    );
    expect(largeBreakawayChaser!.energyAfter).toBeLessThan(
      regularChaser!.energyAfter - 2
    );
  });
  it("simule un contre-la-montre avec un seul engagé (championnat national)", () => {
    const base = createDemoSimulationInput("sprint-littoral", 7);
    const result = simulateRaceStage({
      ...base,
      stageType: "individual_time_trial",
      riders: base.riders.slice(0, 1),
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].rank).toBe(1);
    expect(result.results[0].status).toBe("finished");
  });

  it("simule une course en ligne avec un seul engagé", () => {
    const base = createDemoSimulationInput("collines-ardennes", 3);
    const result = simulateRaceStage({
      ...base,
      riders: base.riders.slice(0, 1),
    });

    expect(result.results).toHaveLength(1);
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it("refuse une simulation sans aucun coureur", () => {
    const base = createDemoSimulationInput("sprint-littoral", 7);

    expect(() =>
      simulateRaceStage({ ...base, riders: [] })
    ).toThrowError("Une simulation requiert au moins un coureur.");
  });

  it("produit un classement complet avec des rangs uniques", () => {
    const input = createDemoSimulationInput("collines-ardennes", 3);
    const result = simulateRaceStage(input);

    expect(result.results).toHaveLength(input.riders.length);
    const finishers = result.results.filter(
      (item) => item.status === "finished"
    );
    expect(finishers.map((item) => item.rank)).toEqual(
      Array.from({ length: finishers.length }, (_, index) => index + 1)
    );
    expect(
      result.results
        .filter((item) => item.status === "did_not_finish")
        .every((item) => item.rank === null)
    ).toBe(true);
    expect(result.results[0].gapToWinnerSeconds).toBe(0);
    expect(result.timeline).toHaveLength(input.segments.length);
  });

  it("conserve des écarts monotones, calculés depuis la tête, sans cassure de 1 à 3 secondes", () => {
    for (const profile of [
      "sprint-littoral",
      "collines-ardennes",
      "haute-montagne",
    ] as const) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const simulation = simulateRaceStage(
          createDemoSimulationInput(profile, seed)
        );
        const finishers = simulation.results.filter(
          (result) => result.status === "finished"
        );
        const winnerTime = finishers[0].elapsedTimeSeconds;

        finishers.forEach((result, index) => {
          const previous = finishers[index - 1];
          expect(result.gapToWinnerSeconds).toBe(
            result.elapsedTimeSeconds - winnerTime
          );
          expect(result.gapToWinnerSeconds).toBeGreaterThanOrEqual(
            previous?.gapToWinnerSeconds ?? 0
          );
          expect(
            result.gapToWinnerSeconds === 0 ||
              result.gapToWinnerSeconds > 3
          ).toBe(true);
        });
      }
    }
  });

  it("commence avec un peloton groupé avant de laisser partir l’échappée", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );

    expect(
      result.timeline[0].groups.map((group) => group.type)
    ).toEqual(["peloton"]);
    expect(
      result.timeline[1].groups.some(
        (group) => group.type === "breakaway"
      )
    ).toBe(true);
    expect(result.timeline[1].commentary.join(" ")).toContain(
      "attaque"
    );
  });

  it("restitue une seule fois chaque attaquant avec son premier tronçon", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );
    const participants = getStageAttackParticipants(result);
    const participantIds = participants.map((participant) => participant.riderId);

    expect(participants.length).toBeGreaterThan(0);
    expect(new Set(participantIds).size).toBe(participantIds.length);
    for (const participant of participants) {
      const firstSnapshot = result.timeline.find((snapshot) =>
        snapshot.groups.some(
          (group) =>
            (group.type === "breakaway" || group.type === "chase") &&
            group.riderIds.includes(participant.riderId)
        )
      );
      expect(participant.firstSegmentNumber).toBe(firstSnapshot?.segmentNumber);
    }
  });

  it("détermine le format du final avec la taille du groupe qui joue la victoire", () => {
    const massFinish = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 3)
    );
    const selectiveFinish = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );

    expect(getFinalBattleRiderIds(massFinish).length).toBeGreaterThan(10);
    expect(getFinalBattleRiderIds(selectiveFinish).length).toBeLessThanOrEqual(10);
    expect(isMassGroupFinish(massFinish)).toBe(true);
    expect(isMassGroupFinish(selectiveFinish)).toBe(false);
  });

  it("conserve la vue latérale si une attaque mène encore à l'entrée du dernier tronçon", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 3)
    );
    const entrySnapshot = simulation.timeline.at(-2)!;
    const leadingGap = Math.min(
      ...entrySnapshot.groups.map((group) => group.gapToLeaderSeconds)
    );
    for (const group of entrySnapshot.groups) {
      if (group.gapToLeaderSeconds === leadingGap) {
        group.type = "breakaway";
      }
    }

    expect(isMassGroupFinish(simulation)).toBe(false);
  });

  it("conserve la vue latérale lorsque seuls cinq coureurs jouent encore la victoire", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 3)
    );
    const finalSnapshot = simulation.timeline.at(-1)!;
    const leadingRiderIds = getLeadingFinishGroupRiderIds(simulation);
    const leadingGroup = finalSnapshot.groups.find(
      (group) => group.gapToLeaderSeconds === 0
    )!;

    finalSnapshot.groups = [
      {
        ...leadingGroup,
        riderIds: leadingRiderIds.slice(0, 5),
      },
      ...finalSnapshot.groups.filter(
        (group) => group.gapToLeaderSeconds > 0
      ),
    ];

    expect(getLeadingFinishGroupRiderIds(simulation)).toHaveLength(5);
    expect(isMassGroupFinish(simulation)).toBe(false);
  });

  it("explique l’origine de chaque coureur présent dans un final sélectif", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );
    const scenario = getFinalBattleScenario(simulation);
    const explainedRiderIds = new Set([
      ...scenario.entryLeaderIds,
      ...scenario.lateJoiners.map((lateJoiner) => lateJoiner.riderId),
    ]);

    expect(explainedRiderIds).toEqual(new Set(scenario.contenderIds));
    expect(
      scenario.lateJoiners.every(
        (lateJoiner) => lateJoiner.fromGroupLabel.length > 0
      )
    ).toBe(true);
  });

  it("conserve le groupe de neuf et révèle le futur vainqueur s'il revient de la chasse", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );
    const rankedFinisherIds = simulation.results
      .filter(
        (result) => result.status === "finished" && result.rank !== null
      )
      .sort((first, second) => first.rank! - second.rank!)
      .map((result) => result.riderId);
    const officialWinnerId = rankedFinisherIds[0];
    const entryLeaderIds = rankedFinisherIds.slice(1, 10);
    const entrySnapshot = simulation.timeline.at(-2)!;
    entrySnapshot.groups = [
      {
        id: "final-group-of-nine",
        label: "Groupe de 9",
        type: "breakaway",
        riderIds: entryLeaderIds,
        gapToLeaderSeconds: 0,
        averageEnergy: 54,
      },
      {
        id: "winner-chasing",
        label: "Chasse",
        type: "chase",
        riderIds: [officialWinnerId],
        gapToLeaderSeconds: 8,
        averageEnergy: 58,
      },
    ];

    const scenario = getFinalBattleScenario(simulation);

    expect(scenario.entryLeaderIds).toEqual(entryLeaderIds);
    expect(scenario.contenderIds).toContain(officialWinnerId);
    expect(scenario.decisiveContenderIds).toContain(officialWinnerId);
    expect(scenario.lateJoiners).toContainEqual({
      riderId: officialWinnerId,
      fromGroupLabel: "Chasse",
      gapToLeaderSeconds: 8,
    });
  });

  it("fait payer davantage d’énergie à une petite échappée", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );
    const comparableSnapshot = result.timeline
      .slice(2)
      .find(
        (snapshot) =>
          snapshot.groups.some((group) => group.type === "breakaway") &&
          snapshot.groups.some((group) => group.type === "peloton")
      );

    expect(comparableSnapshot).toBeDefined();
    const breakaway = comparableSnapshot!.groups.find((group) => group.type === "breakaway")!;
    const peloton = comparableSnapshot!.groups.find((group) => group.type === "peloton")!;
    expect(breakaway.averageEnergy).toBeLessThan(peloton.averageEnergy);
  });

  it("preserve most of the peloton on early climbs while dropping clear non-climbers", () => {
    const baseInput = createDemoSimulationInput("haute-montagne", 41);
    const strongRiders = Array.from({ length: 16 }, (_, index) => ({
      ...createSelectionTestRider(`early-strong-${index}`, {
        hills: 68,
        mountain: 68,
        endurance: 67,
        resistance: 67,
      }),
      form: 78,
    }));
    const weakRiders = Array.from({ length: 4 }, (_, index) => ({
      ...createSelectionTestRider(`early-weak-${index}`, {
        hills: 25,
        mountain: 25,
        endurance: 42,
        resistance: 40,
      }),
      form: 62,
    }));
    const segments: RaceStageSegment[] = [
      {
        segmentNumber: 1,
        distanceKm: 12,
        terrain: "climb",
        averageGradientPct: 8,
        surface: "asphalt",
        prime: null,
      },
      {
        segmentNumber: 2,
        distanceKm: 12,
        terrain: "climb",
        averageGradientPct: 8,
        surface: "asphalt",
        prime: null,
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        segmentNumber: index + 3,
        distanceKm: 20,
        terrain: "flat" as const,
        averageGradientPct: 0,
        surface: "asphalt" as const,
        prime: null,
      })),
    ];
    const result = simulateRaceStage({
      ...baseInput,
      id: "early-peloton-cohesion-test",
      profileType: "mountain",
      segments,
      riders: [...strongRiders, ...weakRiders],
    });
    const earlySnapshot = result.timeline[1];
    const pelotonIds =
      earlySnapshot.groups.find((group) => group.type === "peloton")?.riderIds ?? [];
    const droppedIds = new Set(
      earlySnapshot.groups
        .filter((group) => group.type === "dropped")
        .flatMap((group) => group.riderIds)
    );

    expect(pelotonIds.length).toBeGreaterThanOrEqual(15);
    expect(
      weakRiders.some((rider) => droppedIds.has(rider.id))
    ).toBe(true);
  });

  it("keeps riders in reserve for a mid-race attack on very long stages", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const riders = Array.from({ length: 24 }, (_, index) => ({
      ...createSelectionTestRider(`long-stage-${index}`, {
        flat: 64 + (index % 5),
        acceleration: 66 + (index % 4),
        endurance: 72 + (index % 6),
        resistance: 68 + (index % 5),
        breakaway: 70 + (index % 7),
      }),
      role: "free_agent" as const,
      form: 76,
    }));
    const segments: RaceStageSegment[] = Array.from(
      { length: 10 },
      (_, index) => ({
        segmentNumber: index + 1,
        distanceKm: 22,
        terrain: "flat" as const,
        averageGradientPct: 0,
        surface: "asphalt" as const,
        prime: null,
      })
    );
    const result = simulateRaceStage({
      ...baseInput,
      id: "danger-check-1",
      segments,
      riders,
    });
    const participants = getStageAttackParticipants(result);

    expect(
      participants.some(
        (participant) =>
          participant.firstSegmentNumber >= 5 &&
          participant.firstSegmentNumber <= 7
      )
    ).toBe(true);
    expect(
      result.timeline.flatMap((snapshot) => snapshot.commentary).join(" ")
    ).toContain("jug\u00e9 dangereux");
  });

  it("restores a limited amount of race energy on a descent", () => {
    const baseInput = createDemoSimulationInput("haute-montagne", 19);
    const riders = Array.from({ length: 12 }, (_, index) =>
      createSelectionTestRider(`descent-recovery-${index}`, {
        mountain: 65,
        downhill: 68,
        endurance: 65,
        resistance: 65,
        recovery: 66,
      })
    );
    const segments: RaceStageSegment[] = [
      {
        segmentNumber: 1,
        distanceKm: 20,
        terrain: "climb",
        averageGradientPct: 6,
        surface: "asphalt",
        prime: null,
      },
      {
        segmentNumber: 2,
        distanceKm: 20,
        terrain: "descent",
        averageGradientPct: -6,
        surface: "asphalt",
        prime: null,
      },
    ];
    const result = simulateRaceStage({
      ...baseInput,
      id: "descent-energy-recovery-test",
      profileType: "mountain",
      segments,
      riders,
    });
    const riderId = riders[0].id;
    const energyAfterClimb = result.timeline[0].groups.find((group) =>
      group.riderIds.includes(riderId)
    )!.averageEnergy;
    const energyAfterDescent = result.timeline[1].groups.find((group) =>
      group.riderIds.includes(riderId)
    )!.averageEnergy;

    expect(energyAfterDescent).toBeGreaterThan(energyAfterClimb);
    expect(energyAfterDescent).toBeLessThanOrEqual(riders[0].form);
  });

  it("conserve l’énergie de chaque coureur sans faire ralentir le groupe par un équipier épuisé", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const riders = baseInput.riders.slice(0, 6).map((rider, index) => ({
      ...rider,
      id: `reserve-${index}`,
      teamId: `reserve-team-${index}`,
      teamName: `Reserve team ${index}`,
      role: "leader" as const,
      form: index === 0 ? 10 : 90,
      ratings: {
        ...rider.ratings,
        flat: index === 0 ? 40 : 70,
        endurance: index === 0 ? 45 : 70,
      },
    }));
    const segment = {
      ...baseInput.segments[0],
      terrain: "flat" as const,
      surface: "asphalt" as const,
      averageGradientPct: 0,
    };
    const tiredRiderSimulation = simulateRaceStage({
      ...baseInput,
      id: "individual-energy-test",
      segments: [segment],
      riders,
    });
    const freshRiderSimulation = simulateRaceStage({
      ...baseInput,
      id: "individual-energy-test",
      segments: [segment],
      riders: riders.map((rider, index) => ({
        ...rider,
        form: index === 0 ? 90 : rider.form,
      })),
    });
    const tiredRiderResult = tiredRiderSimulation.results.find(
      (result) => result.riderId === "reserve-0"
    )!;
    const freshRiderResult = freshRiderSimulation.results.find(
      (result) => result.riderId === "reserve-0"
    )!;
    const protectedTeammateResult = tiredRiderSimulation.results.find(
      (result) => result.riderId === "reserve-1"
    )!;

    expect(tiredRiderResult.energyAfter).toBeLessThan(
      protectedTeammateResult.energyAfter
    );
    expect(tiredRiderResult.energyAfter).toBeLessThan(
      freshRiderResult.energyAfter
    );
    expect(tiredRiderSimulation.results[0].elapsedTimeSeconds).toBe(
      freshRiderSimulation.results[0].elapsedTimeSeconds
    );
  });

  it("makes domestiques spend energy to protect their leader", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 13);
    const leaderRatings = {
      flat: 64,
      hills: 58,
      mountain: 62,
      endurance: 66,
      resistance: 66,
    };
    const protectedLeader = {
      ...createSelectionTestRider("protected-leader", leaderRatings),
      teamId: "protected-team",
    };
    const isolatedLeader = {
      ...createSelectionTestRider("isolated-leader", leaderRatings),
      teamId: "isolated-team",
    };
    const helpers = Array.from({ length: 2 }, (_, index) => ({
      ...createSelectionTestRider(`helper-${index}`, leaderRatings),
      teamId: "protected-team",
      role: "domestique" as const,
    }));
    const fillers = Array.from({ length: 2 }, (_, index) => ({
      ...createSelectionTestRider(`filler-${index}`, leaderRatings),
      teamId: `filler-team-${index}`,
    }));
    const segments: RaceStageSegment[] = [
      {
        segmentNumber: 1,
        distanceKm: 18,
        terrain: "climb",
        averageGradientPct: 3.5,
        surface: "asphalt",
        prime: null,
      },
      {
        segmentNumber: 2,
        distanceKm: 12,
        terrain: "flat",
        averageGradientPct: 0,
        surface: "asphalt",
        prime: null,
      },
    ];
    const result = simulateRaceStage({
      ...baseInput,
      id: "leader-protection-test",
      profileType: "hilly",
      segments,
      riders: [protectedLeader, isolatedLeader, ...helpers, ...fillers],
    });
    const resultByRiderId = new Map(
      result.results.map((row) => [row.riderId, row])
    );

    expect(
      resultByRiderId.get(protectedLeader.id)!.energyAfter
    ).toBeGreaterThan(
      resultByRiderId.get(isolatedLeader.id)!.energyAfter
    );
    expect(
      Math.min(
        ...helpers.map(
          (helper) => resultByRiderId.get(helper.id)!.energyAfter
        )
      )
    ).toBeLessThan(
      resultByRiderId.get(protectedLeader.id)!.energyAfter
    );
  });

  it("ne lâche pas un coureur épuisé sur une portion plate", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const riders = baseInput.riders.slice(0, 8).map((rider, index) => ({
      ...rider,
      id: `pace-${index}`,
      teamId: `pace-team-${index}`,
      teamName: `Pace team ${index}`,
      role: "leader" as const,
      form: index === 0 ? 10 : 90,
      ratings: {
        ...rider.ratings,
        flat: index === 0 ? 42 : 72,
        endurance: index === 0 ? 45 : 72,
        resistance: index === 0 ? 45 : 72,
      },
    }));
    const flatSegments = baseInput.segments.slice(0, 3).map((segment) => ({
      ...segment,
      terrain: "flat" as const,
      surface: "asphalt" as const,
      averageGradientPct: 0,
    }));
    const result = simulateRaceStage({
      ...baseInput,
      id: "individual-drop-test",
      segments: flatSegments,
      riders,
    });
    const finalSnapshot = result.timeline.at(-1)!;
    const tiredRiderGroup = finalSnapshot.groups.find((group) =>
      group.riderIds.includes("pace-0")
    );
    const freshRiderGroup = finalSnapshot.groups.find((group) =>
      group.riderIds.includes("pace-1")
    );

    expect(tiredRiderGroup?.type).toBe("peloton");
    expect(freshRiderGroup?.type).toBe("peloton");
  });

  it("conserve le peloton sur une étape vallonnée tant que la sélection reste supportable", () => {
    const input = createDemoSimulationInput(
      "collines-ardennes",
      32
    );
    const result = simulateRaceStage(input);
    const firstSnapshotWithoutPeloton = result.timeline.findIndex(
      (snapshot, index) =>
        index < result.timeline.length - 1 &&
        !snapshot.groups.some(
          (group) => group.type === "peloton"
        ) &&
        snapshot.groups.some(
          (group) => group.type === "breakaway"
        )
    );
    const finishers = result.results.filter(
      (resultRow) => resultRow.status === "finished"
    );
    const winnerTime = finishers[0].elapsedTimeSeconds;
    const maximumGap = Math.max(
      ...finishers.map(
        (resultRow) => resultRow.gapToWinnerSeconds
      )
    );
    const maximumTimelineGap = Math.max(
      ...result.timeline.flatMap((snapshot) =>
        snapshot.groups.map(
          (group) => group.gapToLeaderSeconds
        )
      )
    );

    expect(firstSnapshotWithoutPeloton).toBe(-1);
    expect(winnerTime).toBeGreaterThan(0);
    expect(maximumGap).toBeLessThan(winnerTime);
    expect(maximumTimelineGap).toBeLessThan(3_600);
  });

  it("réduit l'avantage de l'aspiration lorsque la pente devient forte", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const getAverageEnergyAfter = (
      terrain: "flat" | "climb",
      riderCount: number
    ) => {
      const riders = Array.from({ length: riderCount }, (_, index) =>
        createSelectionTestRider(`${terrain}-${riderCount}-${index}`, {})
      );
      const result = simulateRaceStage({
        ...baseInput,
        profileType: terrain === "climb" ? "mountain" : "flat",
        segments: [
          {
            segmentNumber: 1,
            distanceKm: 30,
            terrain,
            averageGradientPct: terrain === "climb" ? 8 : 0,
            surface: "asphalt",
            prime: null,
          },
        ],
        riders,
      });

      return (
        result.results.reduce(
          (total, resultRow) => total + resultRow.energyAfter,
          0
        ) / result.results.length
      );
    };
    const flatDraftingBenefit =
      getAverageEnergyAfter("flat", 12) - getAverageEnergyAfter("flat", 2);
    const uphillDraftingBenefit =
      getAverageEnergyAfter("climb", 12) - getAverageEnergyAfter("climb", 2);

    expect(flatDraftingBenefit).toBeGreaterThan(uphillDraftingBenefit);
  });

  it("attribue les points des GPM et sprints intermédiaires", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 2)
    );

    expect(result.primes.some((prime) => prime.prime.type === "mountain")).toBe(true);
    expect(Object.values(result.mountainPoints).some((points) => points > 0)).toBe(true);
    expect(Object.values(result.sprintPoints).some((points) => points > 0)).toBe(true);
  });

  it("favorise un spécialiste du chrono sur un contre-la-montre", () => {
    const input = createDemoSimulationInput("chrono-algarve", 9);
    const result = simulateRaceStage(input);
    const winner = result.resolvedRiders.find(
      (rider) => rider.id === result.results[0].riderId
    )!;

    expect(winner.ratings.timeTrial).toBeGreaterThanOrEqual(78);
    expect(result.timeline.at(-1)?.groups[0].riderIds).toContain(winner.id);
  });

  it("attribue le même temps aux coureurs d'un sprint massif restés dans le peloton", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 12)
    );
    const finalPelotonIds = new Set(
      result.timeline.at(-1)?.groups.find((group) => group.type === "peloton")?.riderIds ?? []
    );
    const pelotonResults = result.results.filter((resultRow) =>
      finalPelotonIds.has(resultRow.riderId)
    );

    expect(pelotonResults.length).toBeGreaterThan(1);
    expect(new Set(pelotonResults.map((resultRow) => resultRow.elapsedTimeSeconds)).size).toBe(1);
  });

  it("conserve le temps commun d'un groupe sur une étape classée montagne", () => {
    const mountainInput = createDemoSimulationInput("haute-montagne", 1);
    const result = simulateRaceStage({
      ...mountainInput,
      segments: mountainInput.segments.map((segment) => ({
        ...segment,
        terrain: "flat" as const,
        averageGradientPct: 0,
        prime: null,
      })),
    });
    const resultByRiderId = new Map(
      result.results.map((resultRow) => [resultRow.riderId, resultRow])
    );
    const groupedArrivals = (result.timeline.at(-1)?.groups ?? [])
      .map((group) =>
        group.riderIds.flatMap((riderId) => {
          const resultRow = resultByRiderId.get(riderId);
          return resultRow?.status === "finished" ? [resultRow] : [];
        })
      )
      .filter((group) => group.length > 1);

    expect(groupedArrivals.length).toBeGreaterThan(0);
    expect(
      groupedArrivals.every(
        (group) =>
          new Set(group.map((resultRow) => resultRow.elapsedTimeSeconds)).size === 1
      )
    ).toBe(true);
  });

  it("donne la priorité aux grimpeurs sur une longue ascension finale", () => {
    const baseInput = createDemoSimulationInput("haute-montagne", 1);
    const longSummitSegments = baseInput.segments.map((segment, index) =>
      index >= baseInput.segments.length - 3
        ? {
            ...segment,
            terrain: "climb" as const,
            averageGradientPct: 8,
            surface: "asphalt" as const,
          }
        : segment
    );
    const climbers = Array.from({ length: 3 }, (_, index) =>
      createSelectionTestRider(`grimpeur-${index}`, {
        mountain: 80,
        hills: 65,
        acceleration: 55,
        endurance: 58,
        resistance: 58,
        breakaway: 45,
      })
    );
    const secondarySpecialists = Array.from({ length: 6 }, (_, index) =>
      createSelectionTestRider(`secondaire-${index}`, {
        mountain: 50,
        hills: 55,
        acceleration: 90,
        endurance: 90,
        resistance: 90,
        breakaway: 85,
      })
    );

    const simulations = Array.from({ length: 30 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        segments: longSummitSegments,
        riders: [...climbers, ...secondarySpecialists],
      })
    );

    const secondaryRidersAheadOfAFinishingClimber = simulations.flatMap(
      (simulation) => {
        const bestFinishingClimberRank = Math.min(
          ...simulation.results
            .filter(
              (resultRow) =>
                resultRow.status === "finished" &&
                resultRow.riderId.startsWith("grimpeur-")
            )
            .map((resultRow) => resultRow.rank ?? Number.POSITIVE_INFINITY)
        );

        return simulation.results.filter(
          (resultRow) =>
            resultRow.status === "finished" &&
            resultRow.riderId.startsWith("secondaire-") &&
            (resultRow.rank ?? Number.POSITIVE_INFINITY) < bestFinishingClimberRank
        );
      }
    ).length;
    const completeClimberFinishes = simulations.filter(
      (simulation) =>
        simulation.results.filter(
          (resultRow) =>
            resultRow.status === "finished" &&
            resultRow.riderId.startsWith("grimpeur-")
        ).length === climbers.length
    );

    expect(secondaryRidersAheadOfAFinishingClimber).toBe(0);
    expect(
      completeClimberFinishes.every((simulation) =>
        simulation.results
          .filter((resultRow) => resultRow.status === "finished")
          .slice(0, climbers.length)
          .every((resultRow) => resultRow.riderId.startsWith("grimpeur-"))
      )
    ).toBe(true);
  });

  it("laisse certaines échappées aller au bout sans rendre ce résultat systématique", () => {
    const outcomes = Array.from({ length: 100 }, (_, index) =>
      simulateRaceStage(createDemoSimulationInput("collines-ardennes", index + 1))
    ).map((result) =>
      result.timeline.at(-1)?.commentary.some((message) =>
        message.includes("ligne avec")
      ) ?? false
    );

    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it("favorise nettement les puncheurs face aux baroudeurs sur une étape vallonnée", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const riders = [
      ...Array.from({ length: 4 }, (_, index) =>
        createHillyTestRider("puncheur", index)
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        createHillyTestRider("baroudeur", index)
      ),
    ];
    const winners = Array.from({ length: 120 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        riders,
      }).results[0].riderId
    );
    const puncherWins = winners.filter((riderId) =>
      riderId.startsWith("puncheur-")
    ).length;

    expect(puncherWins).toBeGreaterThanOrEqual(84);
  });

  it("protège d'abord le grimpeur dans les côtes courtes puis use cet avantage par répétition", () => {
    const climber = createSelectionTestRider("grimpeur-vallons", {
      mountain: 70,
      hills: 45,
      endurance: 75,
      resistance: 75,
    });
    const puncher = createSelectionTestRider("puncheur-vallons", {
      mountain: 58,
      hills: 65,
      endurance: 62,
      resistance: 62,
    });
    const shallowClimb: RaceStageSegment = {
      segmentNumber: 2,
      distanceKm: 10,
      terrain: "climb",
      averageGradientPct: 4,
      surface: "asphalt",
      prime: null,
    };
    const freshClimberRating = getHillyClimbSelectionRating(
      climber,
      shallowClimb,
      0
    );
    const tiredClimberRating = getHillyClimbSelectionRating(
      climber,
      shallowClimb,
      42
    );
    const freshPuncherRating = getHillyClimbSelectionRating(
      puncher,
      shallowClimb,
      0
    );
    const tiredPuncherRating = getHillyClimbSelectionRating(
      puncher,
      shallowClimb,
      42
    );

    expect(freshClimberRating).toBeGreaterThan(tiredClimberRating + 10);
    expect(freshClimberRating).toBeCloseTo(freshPuncherRating, 0);
    expect(tiredPuncherRating).toBeCloseTo(freshPuncherRating, 5);
  });

  it("fait céder tardivement un grimpeur peu puncheur sans lui infliger un gouffre", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 37);
    const flat = (segmentNumber: number, distanceKm = 10): RaceStageSegment => ({
      segmentNumber,
      distanceKm,
      terrain: "flat",
      averageGradientPct: 0,
      surface: "asphalt",
      prime: null,
    });
    const climb = (segmentNumber: number): RaceStageSegment => ({
      segmentNumber,
      distanceKm: 10,
      terrain: "climb",
      averageGradientPct: 4,
      surface: "asphalt",
      prime: null,
    });
    const descent = (segmentNumber: number): RaceStageSegment => ({
      segmentNumber,
      distanceKm: 5,
      terrain: "descent",
      averageGradientPct: -4,
      surface: "asphalt",
      prime: null,
    });
    const segments = [
      flat(1),
      climb(2),
      descent(3),
      climb(4),
      descent(5),
      climb(6),
      descent(7),
      climb(8),
      descent(9),
      climb(10),
      flat(11),
    ];
    const climber = createSelectionTestRider("grimpeur-resistant", {
      mountain: 70,
      hills: 45,
      endurance: 75,
      resistance: 75,
      acceleration: 55,
    });
    const punchers = Array.from({ length: 6 }, (_, index) => ({
      ...createSelectionTestRider(`puncheur-reference-${index}`, {
        mountain: 58,
        hills: 65,
        endurance: 62,
        resistance: 62,
        acceleration: 68,
      }),
      teamId: `puncheur-team-${index}`,
    }));
    const result = simulateRaceStage({
      ...baseInput,
      seed: 37,
      segments,
      riders: [climber, ...punchers],
    });
    const firstDropIndex = result.timeline.findIndex((snapshot) =>
      snapshot.groups.some(
        (group) =>
          group.type === "dropped" &&
          group.riderIds.includes(climber.id)
      )
    );
    const climberResult = result.results.find(
      (row) => row.riderId === climber.id
    )!;

    expect(firstDropIndex).toBeGreaterThan(1);
    expect(climberResult.rank).not.toBe(1);
    expect(climberResult.gapToWinnerSeconds).toBeGreaterThan(0);
    expect(climberResult.gapToWinnerSeconds).toBeLessThan(240);

    const loadAfterOneClimb = getNextHillyClimbLoad(
      0,
      climb(2),
      "hilly"
    );
    expect(
      getNextHillyClimbLoad(
        loadAfterOneClimb,
        descent(3),
        "hilly"
      )
    ).toBeGreaterThan(0);
  });

  it("écarte durablement les coureurs très inférieurs dans la statistique clé", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const strongRiders = Array.from({ length: 2 }, (_, index) =>
      createSelectionTestRider(`fort-${index}`, {
        hills: 70,
        mountain: 62,
        acceleration: 68,
      })
    );
    const weakRiders = Array.from({ length: 4 }, (_, index) =>
      createSelectionTestRider(`faible-${index}`, {
        hills: 45,
        mountain: 47,
        acceleration: 52,
      })
    );
    const result = simulateRaceStage({
      ...baseInput,
      riders: [...strongRiders, ...weakRiders],
    });
    const weakIds = new Set(weakRiders.map((rider) => rider.id));
    const firstDropIndex = result.timeline.findIndex((snapshot) =>
      snapshot.groups.some(
        (group) =>
          group.type === "dropped" &&
          group.riderIds.some((riderId) => weakIds.has(riderId))
      )
    );

    expect(firstDropIndex).toBeGreaterThan(0);
    const permanentlyDroppedWeakIds = result.timeline.at(-2)!.groups
      .filter((group) => group.label.startsWith("Groupe attardé"))
      .flatMap((group) => group.riderIds)
      .filter((riderId) => weakIds.has(riderId));
    expect(permanentlyDroppedWeakIds.length).toBeGreaterThan(0);
    expect(
      Math.min(
        ...result.results
          .filter((row) =>
            permanentlyDroppedWeakIds.includes(row.riderId)
          )
          .map((row) => row.gapToWinnerSeconds)
      )
    ).toBeGreaterThan(120);
  });

  it("fait de la note sprint le facteur décisif d'un final plat", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const pureSprinter = createSelectionTestRider("pur-sprinteur", {
      sprint: 84,
      acceleration: 74,
      flat: 70,
    });
    const explosiveRider = createSelectionTestRider("explosif", {
      sprint: 66,
      acceleration: 94,
      flat: 80,
    });
    const simulations = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        riders: [pureSprinter, explosiveRider],
      })
    );
    const groupedFinishes = simulations.filter((result) => {
      const pureResult = result.results.find((row) => row.riderId === pureSprinter.id);
      const explosiveResult = result.results.find((row) => row.riderId === explosiveRider.id);

      return (
        pureResult?.status === "finished" &&
        explosiveResult?.status === "finished" &&
        pureResult.gapToWinnerSeconds === 0 &&
        explosiveResult.gapToWinnerSeconds === 0
      );
    });

    expect(groupedFinishes.length).toBeGreaterThanOrEqual(20);
    const pureSprinterWinRate =
      groupedFinishes.filter(
        (result) => result.results[0].riderId === pureSprinter.id
      ).length / groupedFinishes.length;
    expect(pureSprinterWinRate).toBeGreaterThanOrEqual(0.9);
  });

  it("permet au vécu de course de départager deux coureurs très proches sans remplacer les notes", () => {
    const youngerRider = {
      ...createSelectionTestRider("jeune-plus-fort", { flat: 65 }),
      age: 22,
      careerRaceDays: 0,
    };
    const experiencedRider = {
      ...createSelectionTestRider("veteran-experimente", { flat: 64 }),
      age: 32,
      careerRaceDays: 360,
    };
    const flatSegment: RaceStageSegment = {
      segmentNumber: 1,
      distanceKm: 20,
      terrain: "flat",
      averageGradientPct: 0,
      surface: "asphalt",
      prime: null,
    };

    expect(experiencedRider.ratings.flat).toBeLessThan(
      youngerRider.ratings.flat,
    );
    expect(
      getHillyClimbSelectionRating(experiencedRider, flatSegment, 0),
    ).toBeGreaterThan(
      getHillyClimbSelectionRating(youngerRider, flatSegment, 0),
    );
    expect(experiencedRider.ratings.flat).toBe(64);
  });

  it("applique le bonus local de +2 sans modifier les notes permanentes", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const local = {
      ...createSelectionTestRider("local", { hills: 64 }),
      countryCode: "BE",
    };
    const visitor = {
      ...createSelectionTestRider("visiteur", { hills: 64 }),
      countryCode: "FR",
    };
    const result = simulateRaceStage({
      ...baseInput,
      raceCountryCode: "BE",
      riders: [local, visitor],
    });
    const resolvedLocal = result.resolvedRiders.find(
      (rider) => rider.id === local.id
    )!;
    const resolvedVisitor = result.resolvedRiders.find(
      (rider) => rider.id === visitor.id
    )!;

    expect(resolvedLocal.localRaceBonus).toBe(2);
    expect(resolvedVisitor.localRaceBonus).toBe(0);
    expect(resolvedLocal.ratings).toEqual(local.ratings);
  });

  it("applique le bonus de reconnaissance aux treize notes pour la seule étape ciblée", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const rider = {
      ...createSelectionTestRider("reconnaissance", { hills: 64 }),
      reconnaissanceBonus: 2.3,
    };
    const result = simulateRaceStage({
      ...baseInput,
      riders: [
        rider,
        createSelectionTestRider("sans-reconnaissance", { hills: 64 }),
      ],
    });
    const resolved = result.resolvedRiders.find(
      (candidate) => candidate.id === rider.id,
    )!;

    expect(resolved.ratings.hills).toBeCloseTo(66.3);
    expect(resolved.ratings.mountain).toBeCloseTo(rider.ratings.mountain + 2.3);
    expect(resolved.ratings.breakaway).toBeCloseTo(rider.ratings.breakaway + 2.3);
    expect(rider.ratings.hills).toBe(64);
  });

  it("génère de manière déterministe crevaisons, bordures et chutes", () => {
    const incidentTypes = new Set(
      Array.from({ length: 60 }, (_, index) =>
        simulateRaceStage(
          createDemoSimulationInput(
            "collines-ardennes",
            index + 1
          )
        ).timeline.flatMap((snapshot) =>
          snapshot.incidents.map((incident) => incident.type)
        )
      ).flat()
    );

    expect(incidentTypes).toEqual(
      new Set([
        "puncture",
        "crosswind",
        "crash_individual",
        "crash_mass",
      ])
    );
  });

  it("place les coureurs piégés par une bordure derrière le peloton", () => {
    const crosswindCase = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    )
      .flatMap((result) => result.timeline)
      .map((snapshot) => ({
        snapshot,
        incident: snapshot.incidents.find(
          (incident) => incident.type === "crosswind"
        ),
      }))
      .find(({ snapshot, incident }) => {
        const peloton = snapshot.groups.find(
          (group) => group.type === "peloton"
        );
        const affectedGroup = incident
          ? snapshot.groups.find((group) =>
              incident.riderIds.every((riderId) =>
                group.riderIds.includes(riderId)
              )
            )
          : null;
        return Boolean(incident && peloton && affectedGroup);
      });

    expect(crosswindCase).toBeDefined();
    const { snapshot, incident } = crosswindCase!;
    const pelotonIndex = snapshot.groups.findIndex(
      (group) => group.type === "peloton"
    );
    const affectedGroupIndex = snapshot.groups.findIndex((group) =>
      incident!.riderIds.every((riderId) =>
        group.riderIds.includes(riderId)
      )
    );
    const peloton = snapshot.groups[pelotonIndex];
    const affectedGroup = snapshot.groups[affectedGroupIndex];

    expect(affectedGroupIndex).toBeGreaterThan(pelotonIndex);
    expect(affectedGroup.type).toBe("dropped");
    expect(affectedGroup.gapToLeaderSeconds).toBeGreaterThan(
      peloton.gapToLeaderSeconds
    );
    expect(affectedGroup.label).toContain("bordure");
  });

  it("peut scinder une échappée en plusieurs groupes", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );

    expect(
      result.timeline.some(
        (snapshot) =>
          snapshot.groups.filter(
            (group) => group.type === "breakaway"
          ).length > 1
      )
    ).toBe(true);
  });
  it("place un abandon sur chute en fin de classement et exclut le coureur de l'étape suivante", () => {
    const firstStage = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    ).find((result) =>
      result.results.some(
        (row) => row.status === "did_not_finish"
      )
    );

    expect(firstStage).toBeDefined();
    const abandoned = firstStage!.results.at(-1)!;
    expect(abandoned.status).toBe("did_not_finish");
    expect(abandoned.rank).toBeNull();
    expect(abandoned.abandonment?.injury.recoveryDays).toBeGreaterThan(0);

    const nextInput = createDemoSimulationInput("collines-ardennes", 999);
    const nextStage = simulateRaceStage({
      ...nextInput,
      unavailableRiderIds: [abandoned.riderId],
    });
    expect(
      nextStage.resolvedRiders.some(
        (rider) => rider.id === abandoned.riderId
      )
    ).toBe(false);
  });

  it("peut diagnostiquer une blessure sans retirer le coureur du classement de l’étape", () => {
    const stage = Array.from({ length: 160 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    ).find((result) =>
      result.results.some(
        (row) => row.status === "finished" && row.injury !== null
      )
    );

    expect(stage).toBeDefined();
    const injuredFinisher = stage!.results.find(
      (row) => row.status === "finished" && row.injury !== null
    )!;
    expect(injuredFinisher.rank).not.toBeNull();
    expect(injuredFinisher.abandonment).toBeNull();
    expect(injuredFinisher.injury?.recoveryHours).toBeGreaterThanOrEqual(72);
  });

  it("cumule les classements montagne, points, jeunes et équipes d'un tour", () => {
    const stages = [
      simulateRaceStage(createDemoSimulationInput("sprint-littoral", 12)),
      simulateRaceStage(createDemoSimulationInput("haute-montagne", 2)),
    ];
    const standings = buildStageRaceStandings(stages);

    expect(standings.general.length).toBeGreaterThan(1);
    expect(standings.general[0].elapsedTimeSeconds).toBeLessThanOrEqual(
      standings.general[1].elapsedTimeSeconds
    );
    expect(standings.mountain[0]?.points).toBeGreaterThan(0);
    expect(standings.sprint[0]?.points).toBeGreaterThan(0);
    expect(
      stages
        .flatMap((stage) => stage.resolvedRiders)
        .find((rider) => rider.id === standings.youth[0]?.riderId)?.age
    ).toBeLessThan(25);
    expect(standings.teams.length).toBeGreaterThan(1);
    expect(standings.teams[0].elapsedTimeSeconds).toBeLessThanOrEqual(
      standings.teams[1].elapsedTimeSeconds
    );
  });

  it("pondère le classement par équipes selon le nombre de coureurs engagés", () => {
    const stage = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 12)
    );
    const ridersByTeam = Map.groupBy(
      stage.resolvedRiders,
      (rider) => rider.teamId
    );
    const [smallTeam, largeTeam] = [...ridersByTeam.entries()].filter(
      ([, riders]) => riders.length >= 4
    );

    expect(smallTeam).toBeDefined();
    expect(largeTeam).toBeDefined();

    const smallTeamRiders = smallTeam[1].slice(0, 2);
    const largeTeamRiders = largeTeam[1].slice(0, 4);
    const selectedRiders = [...smallTeamRiders, ...largeTeamRiders];
    const resultByRiderId = new Map(
      stage.results.map((result) => [result.riderId, result])
    );
    const selectedResults = selectedRiders.map((rider, index) => {
      const original = resultByRiderId.get(rider.id)!;
      const isSmallTeam = rider.teamId === smallTeam[0];
      const teamIndex = isSmallTeam ? index : index - smallTeamRiders.length;
      const elapsedTimeSeconds =
        (isSmallTeam ? 2_000 : 1_000) + teamIndex * 10;
      return {
        ...original,
        status: "finished" as const,
        rank: index + 1,
        elapsedTimeSeconds,
        gapToWinnerSeconds: Math.max(0, elapsedTimeSeconds - 1_000),
        abandonment: null,
      };
    });
    const standings = buildStageRaceStandings([
      {
        ...stage,
        resolvedRiders: selectedRiders,
        results: selectedResults,
      },
    ]);

    expect(standings.teams[0]).toMatchObject({
      teamId: largeTeam[0],
      elapsedTimeSeconds: 1_015,
    });
    expect(standings.teams[1]).toMatchObject({
      teamId: smallTeam[0],
      elapsedTimeSeconds: 2_005,
    });
  });
});

function createHillyTestRider(
  archetype: "puncheur" | "baroudeur",
  index: number
): RiderSimulationInput {
  const isPuncher = archetype === "puncheur";
  return {
    id: `${archetype}-${index}`,
    name: `${archetype} ${index}`,
    teamId: `hilly-team-${index}`,
    teamName: `hilly team ${index}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 75,
    role: "auto",
    ratings: {
      flat: isPuncher ? 49 : 55,
      mountain: isPuncher ? 56 : 52,
      hills: isPuncher ? 64 : 57,
      cobbles: isPuncher ? 43 : 50,
      downhill: isPuncher ? 54 : 56,
      sprint: isPuncher ? 54 : 50,
      acceleration: isPuncher ? 62 : 54,
      timeTrial: isPuncher ? 46 : 52,
      prologue: isPuncher ? 48 : 50,
      endurance: isPuncher ? 56 : 61,
      resistance: isPuncher ? 55 : 59,
      recovery: isPuncher ? 55 : 56,
      breakaway: isPuncher ? 60 : 65,
    },
  };
}

function createSelectionTestRider(
  id: string,
  overrides: Partial<RiderSimulationInput["ratings"]>
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: `team ${id}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 75,
    role: "leader",
    ratings: {
      flat: 60,
      mountain: 60,
      hills: 60,
      cobbles: 60,
      downhill: 60,
      sprint: 60,
      acceleration: 60,
      timeTrial: 60,
      prologue: 60,
      endurance: 60,
      resistance: 60,
      recovery: 60,
      breakaway: 55,
      ...overrides,
    },
  };
}

describe("assignAutomaticRaceRoles", () => {
  it("désigne automatiquement un leader et un sprinteur sur un profil plat", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const oneTeam = input.riders
      .filter((rider) => rider.teamId === input.riders[0].teamId)
      .map((rider) => ({ ...rider, role: "auto" as const }));
    const resolved = assignAutomaticRaceRoles(oneTeam, input.segments);

    expect(resolved.filter((rider) => rider.role === "leader")).toHaveLength(1);
    expect(resolved.filter((rider) => rider.role === "sprinter")).toHaveLength(1);
  });

  it("refuse deux leaders dans la même équipe", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const riders = input.riders.slice(0, 2).map(
      (rider) => ({ ...rider, role: "leader" }) as RiderSimulationInput
    );

    expect(() => assignAutomaticRaceRoles(riders, input.segments)).toThrow(
      "un seul leader"
    );
  });
});
