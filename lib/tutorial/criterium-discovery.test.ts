import { describe, expect, it } from "vitest";

import {
  CRITERIUM_DISCOVERY_OPPONENT_COUNT,
  CRITERIUM_DISCOVERY_ROSTER_SIZE,
  CRITERIUM_DISCOVERY_SLUG,
  appendCriteriumDiscoveryEdition,
  createCriteriumDiscoveryPreviewEdition,
  createCriteriumDiscoveryRun,
  isValidCriteriumDiscoveryRoster,
} from "@/lib/tutorial/criterium-discovery";
import type { RaceCalendarEdition } from "@/lib/game/race-calendar";
import type { RiderSimulationInput } from "@/lib/game/race-simulation";

describe("Critérium de la découverte", () => {
  it("reprend une édition de course standard de 120 km", () => {
    const edition = createCriteriumDiscoveryPreviewEdition({
      dayNumber: 4,
    });

    expect(edition.slug).toBe(CRITERIUM_DISCOVERY_SLUG);
    expect(edition.competitionType).toBe("standard");
    expect(edition.raceFormat).toBe("one_day");
    expect(edition.stages).toHaveLength(1);
    expect(
      edition.stages[0]?.segments.reduce(
        (total, segment) => total + segment.distanceKm,
        0,
      ),
    ).toBeCloseTo(120, 5);
  });

  it("exige exactement cinq coureurs différents", () => {
    const roster = Array.from(
      {
        length: CRITERIUM_DISCOVERY_ROSTER_SIZE,
      },
      (_, index) => ({
        riderId: `rider-${index}`,
        role: index === 0 ? ("leader" as const) : ("auto" as const),
      }),
    );

    expect(isValidCriteriumDiscoveryRoster(roster)).toBe(true);

    expect(isValidCriteriumDiscoveryRoster(roster.slice(0, 4))).toBe(false);

    expect(
      isValidCriteriumDiscoveryRoster([...roster.slice(0, 4), roster[0]!]),
    ).toBe(false);
  });

  it("refuse deux leaders ou deux sprinteurs", () => {
    const roster = Array.from({ length: 5 }, (_, index) => ({
      riderId: `rider-${index}`,
      role: index < 2 ? ("leader" as const) : ("auto" as const),
    }));

    expect(isValidCriteriumDiscoveryRoster(roster)).toBe(false);
  });

  it("offre une première victoire sans modifier les données sportives du joueur", () => {
    const playerRiders = Array.from(
      {
        length: CRITERIUM_DISCOVERY_ROSTER_SIZE,
      },
      (_, index) => createTutorialPlayerRider(index),
    );

    const initialPlayerSnapshot = structuredClone(playerRiders);

    const roster = playerRiders.map((rider, index) => ({
      riderId: rider.id,
      role:
        index === 0
          ? ("leader" as const)
          : index === 1
            ? ("sprinter" as const)
            : ("auto" as const),
    }));

    const run = createCriteriumDiscoveryRun({
      dayNumber: 3,
      roster,
      playerRiders,
      registeredAt: "2026-07-26T06:00:00.000Z",
    });

    const playerIds = new Set(playerRiders.map((rider) => rider.id));

    const opponents = run.lockedSimulation.input.riders.filter(
      (rider) => !playerIds.has(rider.id),
    );

    const winner = run.lockedSimulation.simulation.results.find(
      (result) => result.rank === 1,
    );

    expect(opponents).toHaveLength(CRITERIUM_DISCOVERY_OPPONENT_COUNT);
    expect(
      opponents.every(
        (rider) =>
          rider.form === 20 &&
          Object.values(rider.ratings).every((rating) => rating === 20),
      ),
    ).toBe(true);
    expect(winner && playerIds.has(winner.riderId)).toBe(true);
    expect(playerRiders).toEqual(initialPlayerSnapshot);
  });

  it("remplace une précédente occurrence dans le calendrier", () => {
    const edition = createCriteriumDiscoveryPreviewEdition({
      dayNumber: 7,
    });

    const existing = {
      ...edition,
      id: "existing-criterion",
    };

    const other = {
      ...edition,
      id: "other-race",
      slug: "autre-course",
    };

    const result = appendCriteriumDiscoveryEdition({
      editions: [existing, other] as RaceCalendarEdition[],
      edition,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(edition.id);
    expect(result[1]?.slug).toBe("autre-course");
  });
});

function createTutorialPlayerRider(index: number): RiderSimulationInput {
  return {
    id: `player-rider-${index}`,
    name: `Coureur ${index + 1}`,
    teamId: "player-team",
    teamName: "Équipe du joueur",
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#F2C94C",
    countryCode: "FR",
    age: 22 + index,
    form: 45,
    role: "auto",
    specialAbility: null,
    specialAbilities: [],
    ratings: {
      flat: 28,
      mountain: 28,
      hills: 28,
      cobbles: 28,
      downhill: 28,
      sprint: 28,
      acceleration: 28,
      timeTrial: 28,
      prologue: 28,
      endurance: 28,
      resistance: 28,
      recovery: 28,
      breakaway: 28,
    },
  };
}
