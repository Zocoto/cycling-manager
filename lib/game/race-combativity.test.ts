import { describe, expect, it } from "vitest";

import {
  calculateStageCombativityRanking,
  calculateTourCombativityRanking,
} from "@/lib/game/race-combativity";
import type { StageSimulationResult } from "@/lib/game/race-simulation";

function createSimulation({
  stageId,
  relayRiderIds = ["attacker"],
  breakawayRiderIds = ["attacker", "passenger"],
}: {
  stageId: string;
  relayRiderIds?: string[];
  breakawayRiderIds?: string[];
}): StageSimulationResult {
  const allRiderIds = [...new Set([...breakawayRiderIds, "peloton-rider"])] as string[];
  return {
    stageId,
    seed: "combativity-test",
    resolvedRiders: [],
    timeline: [],
    visualTimeline: [20, 50, 80].map((completedDistanceKm, index) => ({
      segmentNumber: index + 1,
      completedDistanceKm,
      sourceTimelineIndex: index,
      groups: [
        {
          id: "breakaway",
          label: "Échappée",
          type: "breakaway" as const,
          riderIds: breakawayRiderIds,
          gapToLeaderSeconds: 0,
          averageEnergy: 75,
        },
        {
          id: "peloton",
          label: "Peloton",
          type: "peloton" as const,
          riderIds: ["peloton-rider"],
          gapToLeaderSeconds: 180 + index * 30,
          averageEnergy: 80,
        },
      ],
      frontDynamics: {
        breakawayCooperation: 0.7,
        activeRelayRiderIds: relayRiderIds,
        chasePressure: 0.4,
      },
    })),
    results: allRiderIds.map((riderId, index) => ({
      riderId,
      rank: index + 1,
      status: "finished" as const,
      elapsedTimeSeconds: 14_000 + index,
      gapToWinnerSeconds: index,
      energyAfter: 40,
      injury: null,
      abandonment: null,
    })),
    primes: [],
    mountainPoints: {},
    sprintPoints: {},
  };
}

describe("race combativity", () => {
  it("récompense les relais réellement assumés plutôt qu'un simple passager de l'échappée", () => {
    const ranking = calculateStageCombativityRanking(
      createSimulation({ stageId: "stage-1" }),
    );

    expect(ranking[0]?.riderId).toBe("attacker");
    expect(ranking[0]?.breakdown.activeRelayDistanceKm).toBe(80);
    expect(ranking[1]?.riderId).toBe("passenger");
    expect(ranking[1]?.breakdown.activeRelayDistanceKm).toBe(0);
  });

  it("n'attribue aucun trophée lorsqu'aucun fait offensif n'est enregistré", () => {
    const simulation = createSimulation({
      stageId: "stage-calm",
      relayRiderIds: [],
      breakawayRiderIds: [],
    });

    expect(calculateStageCombativityRanking(simulation)).toEqual([]);
  });

  it("cumule toutes les étapes pour le super-combatif et respecte l'éligibilité finale", () => {
    const simulations = [
      createSimulation({ stageId: "stage-1", relayRiderIds: ["attacker"] }),
      createSimulation({ stageId: "stage-2", relayRiderIds: ["attacker"] }),
    ];

    const fullRanking = calculateTourCombativityRanking({ simulations });
    const eligibleRanking = calculateTourCombativityRanking({
      simulations,
      eligibleRiderIds: new Set(["passenger"]),
    });

    expect(fullRanking[0]?.riderId).toBe("attacker");
    expect(fullRanking[0]?.breakdown.distanceAtFrontKm).toBe(160);
    expect(eligibleRanking.map((entry) => entry.riderId)).toEqual([
      "passenger",
    ]);
  });
});
