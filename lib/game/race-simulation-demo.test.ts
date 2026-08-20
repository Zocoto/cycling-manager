import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition, RaceCalendarStage } from "./race-calendar";
import { createCalendarSimulationInput } from "./race-simulation-demo";
import {
  getOfficialStageSimulationContext,
  isUnavailableForFollowingStage,
  simulateOfficialRaceEdition,
} from "./official-race-simulation";
import {
  buildStageRaceStandings,
  type RiderSimulationInput,
} from "./race-simulation";
import {
  assignStageRaceJerseys,
  getStageRaceJerseyByRiderId,
} from "./stage-race-jerseys";

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
      new Set(["team-a", "team-b"]),
    );
  });

  it("applique le rôle propre à l'étape sans modifier le rôle général", () => {
    const riders = [
      { ...createRider("rider-a", "team-a"), role: "domestique" as const },
      { ...createRider("rider-b", "team-a"), role: "leader" as const },
    ];
    const edition = createEdition({
      slug: "tour-roles-par-etape",
      riders,
    });
    edition.raceFormat = "stage_race";
    edition.stages[0].riderRoleOverrides = {
      "rider-a": "sprinter",
      "rider-b": "leadout",
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "roles-stage-1",
    });

    expect(input.riders.map((rider) => [rider.id, rider.role])).toEqual([
      ["rider-a", "sprinter"],
      ["rider-b", "leadout"],
    ]);
    expect(riders.map((rider) => rider.role)).toEqual(["domestique", "leader"]);
  });

  it("utilise le montage propre à l'étape sans l'exposer au moteur", () => {
    const rider = createRider("rider-a", "team-a");
    const edition = createEdition({
      slug: "tour-materiel",
      riders: [rider],
    });
    const permanentEffects = createEquipmentEffects(1);
    const stageEffects = createEquipmentEffects(4);
    edition.engagedRiders[0] = {
      ...rider,
      equipmentEffects: permanentEffects,
      equipmentEffectsByStageId: {
        [edition.stages[0].id]: stageEffects,
      },
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "montage-etape",
    });

    expect(input.riders[0].equipmentEffects).toEqual(stageEffects);
    expect(input.riders[0]).not.toHaveProperty("equipmentEffectsByStageId");
  });

  it("utilise le montage propre à l'étape sans l'exposer au moteur", () => {
    const rider = createRider("rider-a", "team-a");
    const edition = createEdition({
      slug: "tour-materiel",
      riders: [rider],
    });
    const permanentEffects = createEquipmentEffects(1);
    const stageEffects = createEquipmentEffects(4);
    edition.engagedRiders[0] = {
      ...rider,
      equipmentEffects: permanentEffects,
      equipmentEffectsByStageId: {
        [edition.stages[0].id]: stageEffects,
      },
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "montage-etape",
    });

    expect(input.riders[0].equipmentEffects).toEqual(stageEffects);
    expect(input.riders[0]).not.toHaveProperty("equipmentEffectsByStageId");
  });

  it("ecarte les GPM herites du live d'une course d'un jour", () => {
    const edition = createEdition({
      slug: "classique-avec-gpm",
      riders: [createRider("rider-a", "team-a")],
    });
    edition.stages[0].segments = [
      {
        segmentNumber: 1,
        distanceKm: 10,
        terrain: "climb",
        averageGradientPct: 6,
        surface: "asphalt",
        prime: {
          type: "mountain",
          category: "3",
          pointsScale: [2, 1],
        },
      },
    ];

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.segments[0].prime).toBeNull();
    expect(edition.stages[0].segments[0].prime).not.toBeNull();
  });

  it("retire les missions orphelines avant une simulation officielle", () => {
    const riders = [
      createRider("rider-a", "team-a"),
      createRider("rider-b", "team-b"),
    ];
    const edition = createEdition({
      slug: "course-missions-orphelines",
      riders,
    });
    edition.stages[0].segments = [
      {
        segmentNumber: 1,
        distanceKm: 174,
        terrain: "climb",
        averageGradientPct: 2,
        surface: "asphalt",
        prime: null,
      },
    ];
    edition.stages[0].teamStrategies = {
      "team-a": {
        teamId: "team-a",
        objective: "stage_win",
        collectivePosture: "aggressive",
        breakawayPolicy: "target",
        chasePolicy: "always",
        lieutenantRiderId: "rider-a",
        dangerPacerRiderId: "rider-from-old-roster",
        protectorRiderId: "rider-b",
        breakawayRiderId: null,
        attackOrders: [
          {
            riderId: "rider-a",
            segmentNumber: 1,
            intensity: "strong",
            condition: "always",
          },
          {
            riderId: "rider-from-old-roster",
            segmentNumber: 1,
            intensity: "all_in",
            condition: "always",
          },
          {
            riderId: "rider-a",
            segmentNumber: 99,
            intensity: "all_in",
            condition: "always",
          },
        ],
      },
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.teamStrategies).toEqual([
      expect.objectContaining({
        teamId: "team-a",
        lieutenantRiderId: "rider-a",
        dangerPacerRiderId: null,
        protectorRiderId: null,
        attackOrders: [expect.objectContaining({ riderId: "rider-a" })],
      }),
    ]);
    expect(() => simulateOfficialRaceEdition(edition)).not.toThrow();
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
      }),
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
      true,
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
      simulateOfficialRaceEdition(firstSpectatorEdition)[0].simulation,
    ).toEqual(
      simulateOfficialRaceEdition(secondSpectatorEdition)[0].simulation,
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

  it("porte les maillots acquis la veille et laisse le champion national dessous", () => {
    const riders = Array.from({ length: 6 }, (_, index) => ({
      ...createRider(`tour-rider-${index}`, `tour-team-${index}`),
      nationalChampionships: {
        road: {
          countryCode: "FR",
          championshipType: "road" as const,
        },
      },
    }));
    const baseEdition = createEdition({
      slug: "tour-maillots",
      riders,
    });
    const firstStage = baseEdition.stages[0];
    const secondStage = {
      ...firstStage,
      id: `${baseEdition.slug}-stage-2`,
      dayNumber: firstStage.dayNumber + 1,
      stageNumber: 2,
      name: "Étape 2",
    };
    const edition: RaceCalendarEdition = {
      ...baseEdition,
      raceFormat: "stage_race",
      stages: [firstStage, secondStage],
    };
    const runs = simulateOfficialRaceEdition(edition);
    const generalBeforeSecondStage = buildStageRaceStandings([
      runs[0].simulation,
    ]).general;

    expect(runs[0].input.generalClassification).toBeUndefined();
    expect(runs[1].input.generalClassification).toEqual(
      generalBeforeSecondStage,
    );
    const firstStageSimulation = {
      ...runs[0].simulation,
      mountainPoints: {
        [riders[0].id]: 12,
        [riders[1].id]: 8,
        [riders[2].id]: 4,
      },
      sprintPoints: {
        [riders[0].id]: 20,
        [riders[1].id]: 17,
        [riders[2].id]: 15,
      },
    };
    const standingsAfterStageOne = buildStageRaceStandings([
      firstStageSimulation,
    ]);
    const expectedJerseyByRiderId = getStageRaceJerseyByRiderId(
      assignStageRaceJerseys(standingsAfterStageOne),
    );
    const lockedSimulations = [
      {
        stageId: firstStage.id,
        raceEditionId: edition.id,
        engineVersion: "test",
        seed: String(runs[0].input.seed),
        input: runs[0].input,
        simulation: firstStageSimulation,
      },
      {
        stageId: secondStage.id,
        raceEditionId: edition.id,
        engineVersion: "test",
        seed: String(runs[1].input.seed),
        input: runs[1].input,
        simulation: runs[1].simulation,
      },
    ];
    const firstContext = getOfficialStageSimulationContext({
      edition,
      stageId: firstStage.id,
      lockedSimulations,
    });
    const secondContext = getOfficialStageSimulationContext({
      edition,
      stageId: secondStage.id,
      lockedSimulations,
    });

    expect(firstContext.standingsBeforeStage).toBeNull();
    expect(secondContext.standingsBeforeStage).toEqual(
      standingsAfterStageOne,
    );
    expect(
      firstContext.simulation.resolvedRiders.every(
        (rider) =>
          !rider.classificationJersey &&
          rider.activeNationalChampion?.countryCode === "FR",
      ),
    ).toBe(true);
    for (const rider of secondContext.simulation.resolvedRiders) {
      expect(rider.classificationJersey ?? null).toBe(
        expectedJerseyByRiderId.get(rider.id) ?? null,
      );
    }
    expect(secondContext.simulation.resolvedRiders.length).toBeGreaterThan(0);
    expect(
      secondContext.simulation.resolvedRiders.every(
        (rider) =>
          rider.activeNationalChampion?.countryCode === "FR",
      ),
    ).toBe(true);
  });

  it("complète la carnation d'un scénario verrouillé sans recalculer ses résultats", () => {
    const rider = {
      ...createRider("rider-avatar", "team-avatar"),
      avatarProfileKey: "west_africa",
      avatarSeed: 987654,
    };
    const edition = createEdition({
      slug: "course-verrouillee-avatar",
      riders: [rider],
    });
    const run = simulateOfficialRaceEdition(edition)[0];
    const stripAvatar = (candidate: RiderSimulationInput) => {
      const withoutAvatar = { ...candidate };
      delete withoutAvatar.avatarProfileKey;
      delete withoutAvatar.avatarSeed;
      return withoutAvatar;
    };
    const lockedInput = {
      ...run.input,
      riders: run.input.riders.map(stripAvatar),
    };
    const lockedSimulation = {
      ...run.simulation,
      resolvedRiders: run.simulation.resolvedRiders.map(stripAvatar),
    };
    const context = getOfficialStageSimulationContext({
      edition,
      stageId: run.stage.id,
      lockedSimulations: [
        {
          stageId: run.stage.id,
          raceEditionId: edition.id,
          engineVersion: "legacy",
          seed: String(run.input.seed),
          input: lockedInput,
          simulation: lockedSimulation,
        },
      ],
    });

    expect(context.input.riders[0]).toMatchObject({
      avatarProfileKey: "west_africa",
      avatarSeed: 987654,
    });
    expect(context.simulation.resolvedRiders[0]).toMatchObject({
      avatarProfileKey: "west_africa",
      avatarSeed: 987654,
    });
    expect(context.simulation.results).toBe(lockedSimulation.results);
  });

  it("nettoie les GPM d'une ancienne simulation verrouillee", () => {
    const edition = createEdition({
      slug: "course-verrouillee-avec-gpm",
      riders: [
        createRider("rider-a", "team-a"),
        createRider("rider-b", "team-b"),
      ],
    });
    const run = simulateOfficialRaceEdition(edition)[0];
    const prime = {
      type: "mountain" as const,
      category: "3" as const,
      pointsScale: [2, 1],
    };
    const lockedInput = {
      ...run.input,
      segments: [
        {
          ...run.input.segments[0],
          prime,
        },
        ...run.input.segments.slice(1),
      ],
    };
    const lockedSimulation = {
      ...run.simulation,
      primes: [
        {
          segmentNumber: 1,
          prime,
          classification: [
            {
              riderId: "rider-a",
              rank: 1,
              points: 2,
            },
          ],
        },
      ],
      mountainPoints: { "rider-a": 2 },
    };

    const context = getOfficialStageSimulationContext({
      edition,
      stageId: run.stage.id,
      lockedSimulations: [
        {
          stageId: run.stage.id,
          raceEditionId: edition.id,
          engineVersion: "test",
          seed: String(run.input.seed),
          input: lockedInput,
          simulation: lockedSimulation,
        },
      ],
    });

    expect(
      context.input.segments.some(
        (segment) => segment.prime?.type === "mountain",
      ),
    ).toBe(false);
    expect(context.simulation.primes).toEqual([]);
    expect(context.simulation.mountainPoints).toEqual({});
    expect(lockedSimulation.primes).toHaveLength(1);
  });

  it("écarte aussi des étapes suivantes un coureur blessé qui a terminé", () => {
    const edition = createEdition({
      slug: "course-blessure",
      riders: [
        createRider("rider-a", "team-a"),
        createRider("rider-b", "team-b"),
      ],
    });
    const result =
      simulateOfficialRaceEdition(edition)[0].simulation.results[0];

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
      }),
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
    wildcardClosesAt: null,
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

function createEquipmentEffects(mountainBonus: number) {
  return {
    ratingBonuses: { mountain: mountainBonus },
    timeTrialRatingBonuses: {},
    injuryRiskReductionPct: 0,
    breakawayReputationBonus: 0,
    victoryReputationBonus: 0,
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
