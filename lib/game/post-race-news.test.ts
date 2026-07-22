import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition, RaceCalendarStage } from "./race-calendar";
import { buildPostRaceNewsEvents } from "./post-race-news";
import { createDemoSimulationInput } from "./race-simulation-demo";
import type { StageSimulationResult } from "./race-simulation";

describe("post-race news", () => {
  it("ne publie les faits marquants qu'a partir du resultat complet", () => {
    const input = createDemoSimulationInput("collines-ardennes", "news-test");
    const [leader, abandoned] = input.riders;
    const stage = createStage(input.segments);
    const edition = createEdition(stage, input.riders);
    const simulation: StageSimulationResult = {
      stageId: stage.id,
      seed: "news-test",
      resolvedRiders: input.riders,
      timeline: [
        {
          segmentNumber: 1,
          completedDistanceKm: 10,
          groups: [
            {
              id: "breakaway",
              label: "Échappée",
              type: "breakaway",
              riderIds: [leader.id],
              gapToLeaderSeconds: 0,
              averageEnergy: 80,
            },
          ],
          incidents: [],
          abandonments: [],
          commentary: [`${leader.name} passe à l'attaque.`],
        },
        {
          segmentNumber: 2,
          completedDistanceKm: 20,
          groups: [
            {
              id: "breakaway",
              label: "Échappée",
              type: "breakaway",
              riderIds: [leader.id],
              gapToLeaderSeconds: 0,
              averageEnergy: 65,
            },
          ],
          incidents: [],
          abandonments: [
            {
              riderId: abandoned.id,
              segmentNumber: 2,
              reason: "crash",
              injury: {
                type: "fracture",
                diagnosisCode: "rib_fracture",
                label: "Fracture des côtes",
                severity: "moderate",
                recoveryHours: 72,
                recoveryDays: 3,
              },
            },
          ],
          commentary: [`${abandoned.name} abandonne.`],
        },
      ],
      results: [
        {
          riderId: leader.id,
          rank: 1,
          status: "finished",
          elapsedTimeSeconds: 10_000,
          gapToWinnerSeconds: 0,
          energyAfter: 30,
          injury: null,
          abandonment: null,
        },
        {
          riderId: abandoned.id,
          rank: null,
          status: "did_not_finish",
          elapsedTimeSeconds: 10_100,
          gapToWinnerSeconds: 100,
          energyAfter: 0,
          injury: null,
          abandonment: null,
        },
      ],
      primes: [
        {
          segmentNumber: 1,
          prime: {
            type: "mountain",
            category: "2",
            pointsScale: [5, 3, 1],
          },
          classification: [{ riderId: leader.id, rank: 1, points: 5 }],
        },
      ],
      mountainPoints: { [leader.id]: 5 },
      sprintPoints: {},
    };

    const events = buildPostRaceNewsEvents({ edition, stage, simulation });

    expect(events.map((event) => event.eventKind)).toEqual([
      "breakaway",
      "incident",
      "classification",
    ]);
    expect(events[0]).toMatchObject({
      title: `${leader.name} va au bout de l’échappée`,
      featuredTeamId: leader.teamId,
    });
    expect(events.every((event) => event.happenedAt === "2026-07-22T12:29:00.000Z")).toBe(true);
  });
});

function createStage(
  segments: RaceCalendarStage["segments"]
): RaceCalendarStage {
  return {
    id: "stage-news",
    dayNumber: 1,
    stageNumber: 1,
    name: "Étape test",
    stageType: "road",
    status: "completed",
    profileType: "hilly",
    distanceKm: 171,
    daySlot: "early",
    departureAt: "2026-07-22T12:00:00.000Z",
    segments,
  };
}

function createEdition(
  stage: RaceCalendarStage,
  riders: RaceCalendarEdition["engagedRiders"]
): RaceCalendarEdition {
  return {
    id: "edition-news",
    raceId: "race-news",
    slug: "course-news",
    name: "Course test",
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "Nationale",
    prestigeRank: 4,
    raceFormat: "stage_race",
    registrationClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 1,
    maximumRosterSize: 9,
    engagedRiderCount: riders.length,
    engagedRiders: riders,
    currentTeamRegistration: null,
    stages: [stage],
  };
}
