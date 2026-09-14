import { describe, expect, it } from "vitest";

import {
  buildFederationRaceCreationScore,
  getFederationRaceCost,
  getFederationRaceScheduledSlot,
  getFederationRaceStageDistance,
} from "@/lib/game/federation-race-creation";

describe("federation race creation", () => {
  it("rewards results and objectives while penalizing a dense home calendar", () => {
    expect(buildFederationRaceCreationScore({
      nationRank: 1,
      completedObjectiveCount: 4,
      existingRaceCount: 4,
    })).toMatchObject({
      rankingPoints: 40,
      objectivePoints: 60,
      calendarPenalty: 40,
      total: 60,
      eligible: true,
    });
    expect(buildFederationRaceCreationScore({
      nationRank: 25,
      completedObjectiveCount: 3,
      existingRaceCount: 2,
    }).eligible).toBe(false);
  });

  it("schedules tours through the two daily waves without exceeding J28", () => {
    expect(getFederationRaceScheduledSlot({
      startDay: 12,
      startSlot: "late",
      stageIndex: 0,
    })).toEqual({ dayNumber: 12, daySlot: "late" });
    expect(getFederationRaceScheduledSlot({
      startDay: 12,
      startSlot: "late",
      stageIndex: 3,
    })).toEqual({ dayNumber: 14, daySlot: "early" });
  });

  it("derives the official stage distance from its segments", () => {
    expect(getFederationRaceStageDistance({
      name: "Étape 1",
      stageType: "road",
      profileType: "hilly",
      segments: [
        { distanceKm: 75, terrainType: "flat", surfaceType: "asphalt", averageGradientPct: 0 },
        { distanceKm: 42.5, terrainType: "climb", surfaceType: "cobbles", averageGradientPct: 5.5 },
      ],
    })).toBe(117.5);
  });
});

describe("federation race costs", () => {
  it("makes category the main cost driver", () => {
    const regional = getFederationRaceCost({ categoryCode: "regional", stageCount: 1 });
    const national = getFederationRaceCost({ categoryCode: "national", stageCount: 1 });
    const continental = getFederationRaceCost({ categoryCode: "continental", stageCount: 1 });

    expect(national.creationMoney).toBeGreaterThanOrEqual(regional.creationMoney * 3);
    expect(continental.creationMoney).toBeGreaterThanOrEqual(national.creationMoney * 3);
    expect(continental.creationReputation).toBeGreaterThan(national.creationReputation);
    expect(continental.annualMaintenance).toBeGreaterThan(national.annualMaintenance);
  });

  it("adds a meaningful charge for every additional stage", () => {
    const oneDay = getFederationRaceCost({ categoryCode: "national", stageCount: 1 });
    const stageRace = getFederationRaceCost({ categoryCode: "national", stageCount: 5 });

    expect(stageRace.creationMoney - oneDay.creationMoney).toBe(1_000_000);
    expect(stageRace.creationMoney).toBe(1_900_000);
    expect(stageRace.creationReputation).toBe(82);
    expect(stageRace.annualMaintenance).toBe(600_000);
  });
});
