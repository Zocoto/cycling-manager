import { describe, expect, it } from "vitest";

import {
  buildFederationRaceCreationScore,
  getFederationRaceScheduledSlot,
  getFederationRaceStageDistance,
} from "@/lib/game/federation-race-creation";

describe("federation race creation", () => {
  it("rewards results and objectives while penalizing a dense home calendar", () => {
    expect(
      buildFederationRaceCreationScore({
        nationRank: 1,
        completedObjectiveCount: 4,
        existingRaceCount: 4,
      }),
    ).toMatchObject({
      rankingPoints: 40,
      objectivePoints: 60,
      calendarPenalty: 40,
      total: 60,
      eligible: true,
    });

    expect(
      buildFederationRaceCreationScore({
        nationRank: 25,
        completedObjectiveCount: 3,
        existingRaceCount: 2,
      }).eligible,
    ).toBe(false);
  });

  it("schedules tours through the two daily waves without exceeding J28", () => {
    expect(
      getFederationRaceScheduledSlot({
        startDay: 12,
        startSlot: "late",
        stageIndex: 0,
      }),
    ).toEqual({ dayNumber: 12, daySlot: "late" });
    expect(
      getFederationRaceScheduledSlot({
        startDay: 12,
        startSlot: "late",
        stageIndex: 3,
      }),
    ).toEqual({ dayNumber: 14, daySlot: "early" });
  });

  it("derives the official stage distance from its segments", () => {
    expect(
      getFederationRaceStageDistance({
        name: "Étape 1",
        stageType: "road",
        profileType: "hilly",
        segments: [
          {
            distanceKm: 75,
            terrainType: "flat",
            surfaceType: "asphalt",
            averageGradientPct: 0,
          },
          {
            distanceKm: 42.5,
            terrainType: "climb",
            surfaceType: "cobbles",
            averageGradientPct: 5.5,
          },
        ],
      }),
    ).toBe(117.5);
  });
});
