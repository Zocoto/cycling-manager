import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition, RaceCalendarStage, RaceProfileType } from "./race-calendar";
import { buildRaceFavorites } from "./race-favorites";
import { buildRaceSegments } from "./race-profiles";
import {
  isRaceLeaderRole,
  isRaceProtectedRiderRole,
  isRaceSprinterRole,
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
  type RiderSimulationRatings,
  type StageSimulationInput,
} from "./race-simulation";
import { createCalendarSimulationInput, createDemoSimulationInput } from "./race-simulation-demo";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";

const MISSIONS = [
  ["lieutenantRiderId", "lieutenant"],
  ["dangerPacerRiderId", "danger_pacer"],
  ["protectorRiderId", "protector"],
  ["breakawayRiderId", "breakaway_candidate"],
] as const;

function rider(id: string, ratings: Partial<RiderSimulationRatings> = {}): RiderSimulationInput {
  return {
    id, name: id, teamId: "cumbre", teamName: "Cumbre",
    teamPrimaryColor: "#1A0A52", teamSecondaryColor: "#FFFDF4",
    age: 25, form: 99, morale: 70, role: "auto",
    specialAbility: null, specialAbilities: [],
    climateProfile: { strength: "rain", weakness: "snow" },
    ratings: {
      mountain: 52, hills: 70, flat: 65, timeTrial: 70, cobbles: 79,
      sprint: 57, acceleration: 60, downhill: 67, endurance: 57,
      resistance: 68, recovery: 67, breakaway: 71, prologue: 62,
      ...ratings,
    },
  };
}

function cobblesRiders() {
  return [
    rider("Olsson"),
    rider("Drame", { cobbles: 75, flat: 80, endurance: 71, resistance: 60, sprint: 56 }),
    rider("helper", { cobbles: 55, flat: 55, resistance: 55, breakaway: 55 }),
  ];
}

function inputFor(
  riders: RiderSimulationInput[],
  profileType: RaceProfileType = "cobbles",
  stageType: StageSimulationInput["stageType"] = "road",
): StageSimulationInput {
  return {
    ...createDemoSimulationInput("paves-zelande", "auto-favorite-leader"),
    id: `favorite-leader-${profileType}-${stageType}`,
    profileType, stageType, isStageRace: false, riders,
    segments: buildRaceSegments({ distanceKm: 80, profileType, seed: "favorite-leader-route" }),
    teamStrategies: [],
  };
}

function stageFor(input: StageSimulationInput): RaceCalendarStage {
  return {
    id: input.id, dayNumber: 1, stageNumber: 1, name: input.name,
    stageType: input.stageType, profileType: input.profileType,
    status: "planned", daySlot: "early", departureAt: null,
    distanceKm: input.segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    segments: input.segments,
  };
}

function favorites(input: StageSimulationInput) {
  return buildRaceFavorites({
    edition: { raceFormat: "one_day", stages: [stageFor(input)], engagedRiders: input.riders },
  });
}

describe.each([
  ["live", simulateRaceStage],
  ["results only", simulateRaceStageResultsOnly],
] as const)("automatic leaders follow public favorites — %s", (_, simulate) => {
  it("protects the leading cobbles favorite instead of demoting him behind a more complete teammate", () => {
    const input = inputFor(cobblesRiders());
    const before = structuredClone(input);
    expect(favorites(input)[0].rider.id).toBe("Olsson");

    const result = simulate(input);

    expect(result.resolvedRiders.find((candidate) => candidate.id === "Olsson")?.role).toBe("leader");
    expect(result.resolvedRiders.filter((candidate) => candidate.role === "leader")).toHaveLength(1);
    expect(input).toEqual(before);
  });

  it("keeps the native favorite when equipment, form and morale favor a teammate", () => {
    const riders = cobblesRiders();
    riders[0] = { ...riders[0], form: 55, morale: 30 };
    riders[1] = {
      ...riders[1], form: 100, morale: 100,
      equipmentEffects: {
        ratingBonuses: { cobbles: 20, flat: 15, endurance: 15, resistance: 15 },
        timeTrialRatingBonuses: {}, injuryRiskReductionPct: 0,
        breakawayReputationBonus: 0, victoryReputationBonus: 0,
      },
    };
    const input = inputFor(riders);
    const before = structuredClone(input);
    expect(favorites(input)[0].rider.id).toBe("Olsson");

    const result = simulate(input);
    const olsson = result.resolvedRiders.find((candidate) => candidate.id === "Olsson")!;
    const drame = result.resolvedRiders.find((candidate) => candidate.id === "Drame")!;

    expect(drame.ratings.cobbles).toBeGreaterThan(olsson.ratings.cobbles);
    expect(olsson.role).toBe("leader");
    expect(input).toEqual(before);
  });

  it("falls back to the best available teammate when the leading favorite cannot start", () => {
    const input = { ...inputFor(cobblesRiders()), unavailableRiderIds: ["Olsson"] };
    const result = simulate(input);

    expect(result.resolvedRiders.some((candidate) => candidate.id === "Olsson")).toBe(false);
    expect(result.resolvedRiders.find((candidate) => candidate.role === "leader")?.id).toBe("Drame");
  });

  it("retains the leader explicitly chosen by the DS even when another rider is the favorite", () => {
    const riders = cobblesRiders();
    riders[1] = { ...riders[1], role: "leader" };
    const input = inputFor(riders);
    expect(favorites(input)[0].rider.id).toBe("Olsson");

    const result = simulate(input);

    expect(result.resolvedRiders.find((candidate) => candidate.id === "Drame")?.role).toBe("leader");
    expect(result.resolvedRiders.find((candidate) => candidate.id === "Olsson")?.role).not.toBe("leader");
  });

  it("does not override any explicit support or protected role assigned to the favorite", () => {
    for (const role of ["domestique", "leadout", "free_agent", "mountain_classification", "protected_rider"] as const) {
      const riders = cobblesRiders();
      riders[0] = { ...riders[0], role };
      const result = simulate(inputFor(riders));

      expect(result.resolvedRiders.find((candidate) => candidate.id === "Olsson")?.role).toBe(role);
      expect(result.resolvedRiders.find((candidate) => candidate.id === "Drame")?.role).toBe("leader");
    }
  });

  it.each(MISSIONS)("preserves the explicit %s mission before automatic favorite promotion", (field) => {
    const input = {
      ...inputFor(cobblesRiders()),
      teamStrategies: [{ ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "cumbre", [field]: "Olsson" }],
    };
    const result = simulate(input);
    const olsson = result.resolvedRiders.find((candidate) => candidate.id === "Olsson")!;

    expect(isRaceLeaderRole(olsson.role) || isRaceSprinterRole(olsson.role) || isRaceProtectedRiderRole(olsson.role)).toBe(false);
    expect(input.teamStrategies[0][field]).toBe("Olsson");
    expect(result.resolvedRiders.find((candidate) => candidate.id === "Drame")?.role).toBe("leader");
  });

  it("uses the same tie break as the public pronostic whatever the roster order", () => {
    for (const ids of [["Zulu", "Alpha", "Beta"], ["Beta", "Zulu", "Alpha"]]) {
      const input = inputFor(ids.map((id) => rider(id)));
      const expected = favorites(input)[0].rider.id;
      expect(expected).toBe("Alpha");
      expect(simulate(input).resolvedRiders.find((candidate) => candidate.role === "leader")?.id).toBe(expected);
    }
  });

  it("keeps the main sprint favorite protected as leader/sprinter", () => {
    const favorite = rider("sprint-favorite", { sprint: 94, acceleration: 70, flat: 60 });
    const challenger = rider("sprint-challenger", { sprint: 80, acceleration: 95, flat: 95 });
    const input = inputFor([favorite, challenger, rider("sprint-helper")], "sprint");
    expect(favorites(input)[0].rider.id).toBe(favorite.id);

    expect(simulate(input).resolvedRiders.find((candidate) => candidate.id === favorite.id)?.role).toBe("leader_sprinter");
  });

  it("chooses a favorite for every team even when that team is outside the displayed top 20", () => {
    const strongRivals = Array.from({ length: 21 }, (_, index) => ({
      ...rider(`rival-${index}`, { cobbles: 95, flat: 95, resistance: 95, endurance: 95, sprint: 95, acceleration: 95 }),
      teamId: "rivals", teamName: "Rivals",
    }));
    const input = inputFor([...strongRivals, ...cobblesRiders()]);
    expect(favorites(input).some((favorite) => favorite.rider.teamId === "cumbre")).toBe(false);

    expect(simulate(input).resolvedRiders.find((candidate) => candidate.id === "Olsson")?.role).toBe("leader");
  });

  it.each(["individual_time_trial", "prologue"] as const)("uses the public %s favorite rather than road attributes", (stageType) => {
    const shortSpecialist = rider("prologue-specialist", { prologue: 95, timeTrial: 66, acceleration: 90, flat: 70 });
    const longSpecialist = rider("time-trial-specialist", { prologue: 45, timeTrial: 94, endurance: 80, resistance: 80 });
    const input = inputFor([shortSpecialist, longSpecialist, rider("chrono-helper")], "time_trial", stageType);
    const expected = favorites(input)[0].rider.id;
    expect(expected).toBe(stageType === "prologue" ? shortSpecialist.id : longSpecialist.id);

    expect(simulate(input).resolvedRiders.find((candidate) => candidate.role === "leader")?.id).toBe(expected);
  });

  it("preserves the established collective time-trial roles and relay results", () => {
    const input: StageSimulationInput = {
      ...inputFor([
        rider("relay-steady", { flat: 90, endurance: 90, resistance: 85, timeTrial: 95 }),
        rider("relay-fast", { sprint: 95, acceleration: 95, flat: 80, endurance: 75, timeTrial: 80 }),
        rider("relay-support"),
      ], "time_trial", "team_time_trial"),
      timeTrialPlans: {
        "relay-steady": { effortMode: "normal", relaySharePct: 60 },
        "relay-fast": { effortMode: "normal", relaySharePct: 25 },
        "relay-support": { effortMode: "conserve", relaySharePct: 15 },
      },
    };
    const expectedRoles = ["leader", "leader_sprinter", "leadout"] as const;
    const previousRolesInput = {
      ...input,
      riders: input.riders.map((candidate, index) => ({ ...candidate, role: expectedRoles[index] })),
    };
    const before = structuredClone(input);
    const automaticResult = simulate(input);

    expect(automaticResult.resolvedRiders.map((candidate) => candidate.role)).toEqual(expectedRoles);
    expect(automaticResult.results).toEqual(simulate(previousRolesInput).results);
    expect(input).toEqual(before);
  });

  it("retains the tour favorite and public tie break across a cobbled stage with another stage favorite", () => {
    const gcRatings = { mountain: 94, hills: 86, timeTrial: 90, recovery: 90, cobbles: 55, sprint: 40 };
    const gcAlpha = rider("Alpha GC", gcRatings);
    const gcZulu = rider("Zulu GC", gcRatings);
    const stageFavorite = rider("cobbles-stage-favorite");
    const source = inputFor([gcZulu, stageFavorite, gcAlpha]);
    const mountain = stageFor(inputFor(source.riders, "mountain"));
    const stages: RaceCalendarStage[] = [
      { ...mountain, id: "tour-mountain-1", stageNumber: 1 },
      { ...mountain, id: "tour-mountain-2", stageNumber: 2 },
      { ...stageFor(source), id: "tour-cobbles", stageNumber: 3 },
    ];
    const edition: RaceCalendarEdition = {
      id: "favorite-tour", raceId: "favorite-tour-race", slug: "favorite-tour", name: "Favorite tour",
      shortName: null, countryName: "France", countryCode: "FR",
      categoryCode: "national", categoryName: "National", prestigeRank: 4,
      raceFormat: "stage_race", competitionType: "standard",
      registrationClosesAt: null, wildcardClosesAt: null, withdrawalClosesAt: null,
      registrationPolicy: "open", minimumReputation: 0, minimumRosterSize: 1, maximumRosterSize: 8,
      engagedRiderCount: source.riders.length, engagedRiders: source.riders,
      currentTeamRegistration: null, stages,
    };
    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(gcAlpha.id);
    expect(favorites(source)[0].rider.id).toBe(stageFavorite.id);

    for (const stage of stages) {
      const input = createCalendarSimulationInput({ edition, stage, seed: "automatic-gc-favorite" });
      expect(simulate(input).resolvedRiders.find((candidate) => candidate.role === "leader")?.id).toBe(gcAlpha.id);
    }
  });
});
