import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
import {
  createCalendarSimulationInput,
} from "./race-simulation-demo";
import {
  getOfficialStageSimulationContext,
  isUnavailableForFollowingStage,
  simulateOfficialRaceEdition,
} from "./official-race-simulation";
import type { RiderSimulationInput } from "./race-simulation";

describe("createCalendarSimulationInput", () => {
  it("utilise exclusivement les coureurs de la startlist enregistrée", () => {
    const registeredRiders = [
      createRider("rider-a", "team-a"),
      createRider("rider-b", "team-a"),
      createRider("rider-c", "team-b"),
    ];
    const edition = createEdition({
      slug: "grand-prix-de-bretagne",
      riders: registeredRiders,
    });

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.riders).toEqual(registeredRiders);
    expect(input.riders.map((rider) => rider.id)).toEqual([
      "rider-a",
      "rider-b",
      "rider-c",
    ]);
    expect(new Set(input.riders.map((rider) => rider.teamId))).toEqual(
      new Set(["team-a", "team-b"])
    );
  });

  it("refuse une course ordinaire sans startlist", () => {
    const edition = createEdition({
      slug: "grand-prix-de-bretagne",
      riders: [],
    });

    expect(() =>
      createCalendarSimulationInput({
        edition,
        stage: edition.stages[0],
        seed: "official",
      })
    ).toThrow("sans startlist enregistrée");
  });

  it("conserve le peloton de démonstration uniquement pour Namur", () => {
    const edition = createEdition({
      slug: "criterium-de-namur",
      riders: [],
    });

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "demo",
    });

    expect(input.riders).toHaveLength(24);
    expect(input.riders.every((rider) => !rider.id.startsWith("rider-"))).toBe(
      true
    );
  });

  it("produit le même scénario officiel quel que soit l'ordre reçu de la startlist", () => {
    const riders = [
      createRider("rider-c", "team-b"),
      createRider("rider-a", "team-a"),
      createRider("rider-b", "team-a"),
    ];
    const firstSpectatorEdition = createEdition({
      slug: "course-synchronisee",
      riders,
    });
    const secondSpectatorEdition = createEdition({
      slug: "course-synchronisee",
      riders: [...riders].reverse(),
    });

    expect(
      simulateOfficialRaceEdition(firstSpectatorEdition)[0].simulation
    ).toEqual(
      simulateOfficialRaceEdition(secondSpectatorEdition)[0].simulation
    );
  });

  it("réutilise le scénario verrouillé au lieu de le recalculer pour chaque spectateur", () => {
    const edition = createEdition({
      slug: "course-verrouillee",
      riders: [
        createRider("rider-a", "team-a"),
        createRider("rider-b", "team-b"),
      ],
    });
    const run = simulateOfficialRaceEdition(edition)[0];
    const context = getOfficialStageSimulationContext({
      edition,
      stageId: run.stage.id,
      lockedSimulations: [
        {
          stageId: run.stage.id,
          raceEditionId: edition.id,
          engineVersion: "test",
          seed: String(run.input.seed),
          input: run.input,
          simulation: run.simulation,
        },
      ],
    });

    expect(context.simulation).toBe(run.simulation);
    expect(context.input).toBe(run.input);
  });

  it("écarte aussi des étapes suivantes un coureur blessé qui a terminé", () => {
    const edition = createEdition({
      slug: "course-blessure",
      riders: [
        createRider("rider-a", "team-a"),
        createRider("rider-b", "team-b"),
      ],
    });
    const result = simulateOfficialRaceEdition(edition)[0].simulation.results[0];

    expect(
      isUnavailableForFollowingStage({
        ...result,
        status: "finished",
        injury: {
          riderId: result.riderId,
          segmentNumber: 1,
          type: "fracture",
          diagnosisCode: "wrist_fracture",
          label: "Fracture du poignet",
          severity: "moderate",
          recoveryHours: 96,
          recoveryDays: 4,
        },
      })
    ).toBe(true);
  });
});

function createEdition({
  slug,
  riders,
}: {
  slug: string;
  riders: RiderSimulationInput[];
}): RaceCalendarEdition {
  const stage: RaceCalendarStage = {
    id: `${slug}-stage`,
    dayNumber: 4,
    stageNumber: 1,
    name: slug,
    stageType: "road",
    status: "planned",
    profileType: "hilly",
    distanceKm: 174,
    daySlot: "early",
    departureAt: null,
    segments: [],
    reconnaissanceBonuses: {},
  };

  return {
    id: `${slug}-edition`,
    raceId: `${slug}-race`,
    slug,
    name: slug,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat: "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: 0,
    minimumRosterSize: 5,
    maximumRosterSize: 6,
    engagedRiderCount: riders.length,
    engagedRiders: riders,
    currentTeamRegistration: null,
    stages: [stage],
  };
}

function createRider(id: string, teamId: string): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId,
    teamName: teamId,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 24,
    form: 75,
    role: "auto",
    specialAbility: null,
    ratings: {
      mountain: 65,
      hills: 65,
      flat: 65,
      timeTrial: 65,
      cobbles: 65,
      sprint: 65,
      acceleration: 65,
      downhill: 65,
      endurance: 65,
      resistance: 65,
      recovery: 65,
      breakaway: 65,
      prologue: 65,
    },
  };
}
