import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
import {
  createCalendarSimulationInput,
} from "./race-simulation-demo";
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
    daySlot: 1,
    stageNumber: 1,
    name: slug,
    stageType: "road",
    status: "planned",
    profileType: "hilly",
    distanceKm: 174,
    departureAt: null,
    segments: [],
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
