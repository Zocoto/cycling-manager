import { describe, expect, it } from "vitest";

import type { RaceCalendarEdition, RaceCalendarStage } from "./race-calendar";
import { createCalendarSimulationInput } from "./race-simulation-demo";
import {
  buildOfficialStageRaceStandings,
  getOfficialStageSimulationContext,
  isUnavailableForFollowingStage,
  simulateOfficialRaceEdition,
} from "./official-race-simulation";
import {
  applyNationalTechnicalLabBonus,
  simulateRaceStageResultsOnly,
  type RiderSimulationInput,
} from "./race-simulation";
import {
  assignStageRaceJerseys,
  getStageRaceJerseyByRiderId,
} from "./stage-race-jerseys";

describe("createCalendarSimulationInput", () => {
  it("fige les bonus du montage choisi sans conserver les autres étapes ni réutiliser un ancien reçu", () => {
    const rider = createRider("rider-a", "team-a");
    const edition = createEdition({ slug: "tour-materiel", riders: [rider] });
    const firstStage = edition.stages[0];
    edition.engagedRiders[0] = {
      ...rider,
      equipmentEffects: createEquipmentEffects(1),
      equipmentEffectsByStageId: { [firstStage.id]: createEquipmentEffects(4) },
      stageEquipmentChangesByStageId: { [firstStage.id]: { items: [{ slot: "frame", equipmentItemId: "frame-2", name: "Cadre montagne" }], permanentEffects: createEquipmentEffects(1) } },
    };
    const input = createCalendarSimulationInput({ edition, stage: firstStage, seed: "receipt" });
    expect(input.riders[0].stageEquipmentSnapshot?.ratingBonuses).toEqual({ mountain: 4 });
    expect(input.riders[0].stageEquipmentSnapshot?.ratingChanges).toEqual({ mountain: 3 });
    expect(input.riders[0]).not.toHaveProperty("stageEquipmentChangesByStageId");
    const simulation = simulateRaceStageResultsOnly(input);
    expect(simulation.resolvedRiders[0].stageEquipmentSnapshot).toEqual(input.riders[0].stageEquipmentSnapshot);
    const withoutReceipt = { ...input, riders: input.riders.map(({ stageEquipmentSnapshot: receipt, ...rest }) => { void receipt; return rest; }) };
    expect(simulateRaceStageResultsOnly(withoutReceipt).results).toEqual(simulation.results);
    edition.engagedRiders[0].stageEquipmentSnapshot = input.riders[0].stageEquipmentSnapshot;
    const otherInput = createCalendarSimulationInput({ edition, stage: { ...firstStage, id: "stage-other" }, seed: "other" });
    expect(otherInput.riders[0]).not.toHaveProperty("stageEquipmentSnapshot");
    edition.engagedRiders[0].equipmentEffectsByStageId![firstStage.id].ratingBonuses.mountain = 99;
    edition.engagedRiders[0].stageEquipmentChangesByStageId![firstStage.id].items[0].name = "Autre";
    expect(input.riders[0].stageEquipmentSnapshot?.ratingBonuses.mountain).toBe(4);
    expect(input.riders[0].stageEquipmentSnapshot?.items[0].name).toBe("Cadre montagne");
  });
  it("conserve le bonus de course préférée sur toutes les étapes d'un tour", () => {
    const edition = createEdition({
      slug: "tour-prefere",
      riders: [
        { ...createRider("favorite", "team-a"), favoriteRaceBonus: 2 },
        createRider("other", "team-b"),
      ],
    });
    edition.raceFormat = "stage_race";
    edition.stages.push({
      ...edition.stages[0],
      id: "tour-prefere-stage-2",
      dayNumber: 5,
      stageNumber: 2,
    });

    for (const stage of edition.stages) {
      const input = createCalendarSimulationInput({
        edition,
        stage,
        seed: stage.id,
      });
      expect(
        input.riders.find((rider) => rider.id === "favorite")
          ?.favoriteRaceBonus,
      ).toBe(2);
      expect(
        input.riders.find((rider) => rider.id === "other")
          ?.favoriteRaceBonus,
      ).toBeUndefined();
    }
  });

  it("transmet l’avantage fédéral du pays hôte au moteur", () => {
    const edition = createEdition({
      slug: "federal-home-bonus",
      riders: [createRider("rider-a", "team-a")],
    });
    edition.federationHomeAdvantageBonus = 1;
    edition.federationHomeAdvantageSpecialization = {
      code: "terrain_library",
      infrastructureLevel: 5,
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.federationHomeAdvantageBonus).toBe(1);
    expect(input.federationHomeAdvantageSpecialization).toEqual({
      code: "terrain_library",
      infrastructureLevel: 5,
    });
  });

  it("réserve le laboratoire fédéral aux épreuves chronométrées", () => {
    const ratings = createRider("rider-a", "nation-a").ratings;

    expect(
      applyNationalTechnicalLabBonus(ratings, "individual_time_trial", 1),
    ).toMatchObject({ timeTrial: 65.65, prologue: 65.65 });
    expect(applyNationalTechnicalLabBonus(ratings, "road", 1)).toBe(ratings);
  });
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

  it("déduplique un coureur resté dans deux inscriptions de la même course", () => {
    const staleEntry = createRider("rider-a", "free-agents");
    const currentEntry = createRider("rider-a", "team-a");
    const edition = createEdition({
      slug: "cn-startlist-dedupliquee",
      riders: [staleEntry, currentEntry, createRider("rider-b", "team-b")],
    });

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.riders.map((rider) => rider.id)).toEqual([
      "rider-a",
      "rider-b",
    ]);
    expect(input.riders.find((rider) => rider.id === "rider-a")?.teamId).toBe(
      "team-a",
    );
  });

  it("écarte les anciennes consignes chrono d'un coureur retiré", () => {
    const rider = createRider("rider-a", "team-a");
    const edition = createEdition({
      slug: "cn-plan-chrono-assaini",
      riders: [rider],
    });
    edition.stages[0].stageType = "individual_time_trial";
    edition.stages[0].timeTrialPlans = {
      "rider-a": { effortMode: "all_in", relaySharePct: null },
      "rider-retire": { effortMode: "conserve", relaySharePct: null },
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "official",
    });

    expect(input.timeTrialPlans).toEqual({
      "rider-a": { effortMode: "all_in", relaySharePct: null },
    });
  });

  it("applique les rôles d'étape sans démettre le leader déclaré du tour", () => {
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
      ["rider-b", "leader"],
    ]);
    expect(riders.map((rider) => rider.role)).toEqual(["domestique", "leader"]);
  });

  it("choisit le leader automatique sur l'ensemble du tour et le conserve à chaque étape", () => {
    const allRounder = {
      ...createRider("leader-general", "team-a"),
      ratings: {
        ...createRider("leader-general", "team-a").ratings,
        mountain: 83,
        hills: 85,
        timeTrial: 82,
        prologue: 80,
        endurance: 84,
        resistance: 82,
        recovery: 85,
      },
    };
    const pureClimber = {
      ...createRider("grimpeur-etape", "team-a"),
      ratings: {
        ...createRider("grimpeur-etape", "team-a").ratings,
        mountain: 94,
        hills: 68,
        timeTrial: 50,
        prologue: 48,
        endurance: 75,
        resistance: 68,
        recovery: 64,
      },
    };
    const puncheur = {
      ...createRider("puncheur-etape", "team-a"),
      ratings: {
        ...createRider("puncheur-etape", "team-a").ratings,
        mountain: 65,
        hills: 96,
        acceleration: 90,
        timeTrial: 48,
        prologue: 50,
        endurance: 72,
        resistance: 78,
        recovery: 66,
      },
    };
    const edition = createEdition({
      slug: "tour-leader-auto-stable",
      riders: [allRounder, pureClimber, puncheur],
    });
    edition.raceFormat = "stage_race";
    edition.stages = [
      {
        ...edition.stages[0],
        id: "tour-leader-auto-stable-montagne",
        stageNumber: 1,
        profileType: "mountain",
        distanceKm: 182,
      },
      {
        ...edition.stages[0],
        id: "tour-leader-auto-stable-vallons",
        stageNumber: 2,
        profileType: "hilly",
        distanceKm: 168,
      },
      {
        ...edition.stages[0],
        id: "tour-leader-auto-stable-chrono",
        stageNumber: 3,
        stageType: "individual_time_trial",
        profileType: "time_trial",
        distanceKm: 34,
      },
    ];

    for (const stage of edition.stages) {
      const input = createCalendarSimulationInput({
        edition,
        stage,
        seed: stage.id,
      });
      expect(
        input.riders.find((rider) => rider.role === "leader")?.id,
      ).toBe("leader-general");
    }

    const simulations = simulateOfficialRaceEdition(edition);
    expect(
      simulations.map(
        (run) =>
          run.simulation.resolvedRiders.find(
            (rider) => rider.role === "leader",
          )?.id,
      ),
    ).toEqual([
      "leader-general",
      "leader-general",
      "leader-general",
    ]);
  });

  it("donne priorité au leader explicitement préparé sur le leader automatique du tour", () => {
    const automaticFavorite = {
      ...createRider("favori-automatique", "team-a"),
      ratings: {
        ...createRider("favori-automatique", "team-a").ratings,
        mountain: 92,
        hills: 92,
        timeTrial: 92,
        recovery: 92,
      },
    };
    const preparedLeader = {
      ...createRider("leader-prepare", "team-a"),
      role: "leader_sprinter" as const,
    };
    const edition = createEdition({
      slug: "tour-leader-prepare",
      riders: [automaticFavorite, preparedLeader],
    });
    edition.raceFormat = "stage_race";
    edition.stages[0].riderRoleOverrides = {
      "favori-automatique": "domestique",
      "leader-prepare": "leader",
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "leader-prepare",
    });

    expect(
      input.riders.find((rider) => rider.id === "favori-automatique")?.role,
    ).toBe("domestique");
    expect(
      input.riders.find((rider) => rider.id === "leader-prepare")?.role,
    ).toBe("leader");
  });

  it("promeut le favori général disponible suivant après l'abandon du leader automatique", () => {
    const first = {
      ...createRider("premier-general", "team-a"),
      ratings: {
        ...createRider("premier-general", "team-a").ratings,
        mountain: 88,
        hills: 88,
        timeTrial: 88,
        recovery: 88,
      },
    };
    const second = {
      ...createRider("second-general", "team-a"),
      ratings: {
        ...createRider("second-general", "team-a").ratings,
        mountain: 82,
        hills: 82,
        timeTrial: 82,
        recovery: 82,
      },
    };
    const edition = createEdition({
      slug: "tour-remplacement-leader-auto",
      riders: [first, second, createRider("equipier", "team-a")],
    });
    edition.raceFormat = "stage_race";
    edition.stages.push({
      ...edition.stages[0],
      id: "tour-remplacement-leader-auto-stage-2",
      stageNumber: 2,
      profileType: "mountain",
    });

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[1],
      seed: "leader-indisponible",
      unavailableRiderIds: new Set(["premier-general"]),
    });

    expect(input.riders.find((rider) => rider.role === "leader")?.id).toBe(
      "second-general",
    );
  });

  it("garde une sélection automatique propre au profil sur une course d'un jour", () => {
    const puncheur = {
      ...createRider("puncheur", "team-a"),
      ratings: {
        ...createRider("puncheur", "team-a").ratings,
        hills: 91,
        acceleration: 87,
      },
    };
    const grimpeur = {
      ...createRider("grimpeur", "team-a"),
      ratings: {
        ...createRider("grimpeur", "team-a").ratings,
        mountain: 95,
        hills: 69,
        acceleration: 66,
      },
    };
    const edition = createEdition({
      slug: "classique-vallonnee-leader-auto",
      riders: [puncheur, grimpeur],
    });
    edition.stages[0].profileType = "hilly";

    const [run] = simulateOfficialRaceEdition(edition);

    expect(
      run.simulation.resolvedRiders.find((rider) => rider.role === "leader")
        ?.id,
    ).toBe("puncheur");
  });

  it("assainit les doublons historiques de leaders sans modifier la startlist", () => {
    const riders = [
      {
        ...createRider("leader-faible", "team-a"),
        role: "leader" as const,
        ratings: {
          ...createRider("leader-faible", "team-a").ratings,
          mountain: 61,
        },
      },
      {
        ...createRider("leader-fort", "team-a"),
        role: "leader" as const,
        ratings: {
          ...createRider("leader-fort", "team-a").ratings,
          mountain: 82,
        },
      },
    ];
    const edition = createEdition({ slug: "tour-anciens-leaders", riders });
    edition.stages[0].profileType = "mountain";

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "leaders-assainis",
    });

    expect(input.riders.map((rider) => [rider.id, rider.role])).toEqual([
      ["leader-faible", "auto"],
      ["leader-fort", "leader"],
    ]);
    expect(riders.map((rider) => rider.role)).toEqual(["leader", "leader"]);
  });

  it("partage l’unique place de sprinteur avec le rôle combiné", () => {
    const riders = [
      {
        ...createRider("sprinteur-general", "team-a"),
        role: "sprinter" as const,
        ratings: {
          ...createRider("sprinteur-general", "team-a").ratings,
          sprint: 88,
        },
      },
      createRider("sprinteur-etape", "team-a"),
    ];
    const edition = createEdition({ slug: "tour-anciens-sprinteurs", riders });
    edition.stages[0].riderRoleOverrides = {
      "sprinteur-etape": "leader_sprinter",
    };

    const input = createCalendarSimulationInput({
      edition,
      stage: edition.stages[0],
      seed: "sprinteurs-assainis",
    });

    expect(input.riders.map((rider) => [rider.id, rider.role])).toEqual([
      ["sprinteur-etape", "leader_sprinter"],
      ["sprinteur-general", "auto"],
    ]);
    expect(riders.map((rider) => rider.role)).toEqual(["sprinter", "auto"]);
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

  it("retire une mission devenue incompatible avec le rôle du coureur", () => {
    const leader = {
      ...createRider("leader-a", "team-a"),
      role: "leader" as const,
    };
    const protectedRider = {
      ...createRider("protected-a", "team-a"),
      role: "protected_rider" as const,
    };
    const helper = {
      ...createRider("helper-a", "team-a"),
      role: "domestique" as const,
    };
    const edition = createEdition({
      slug: "course-missions-roles-modifies",
      riders: [leader, protectedRider, helper],
    });
    edition.stages[0].teamStrategies = {
      "team-a": {
        teamId: "team-a",
        objective: "general_classification",
        collectivePosture: "balanced",
        breakawayPolicy: "avoid",
        chasePolicy: "protect_lead",
        lieutenantRiderId: leader.id,
        dangerPacerRiderId: null,
        protectorRiderId: protectedRider.id,
        breakawayRiderId: helper.id,
        attackOrders: [],
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
        lieutenantRiderId: null,
        protectorRiderId: null,
        breakawayRiderId: helper.id,
      }),
    ]);
    expect(input.riders.find((rider) => rider.id === leader.id)?.raceDuty)
      .toBeUndefined();
    expect(
      input.riders.find((rider) => rider.id === protectedRider.id)?.raceDuty,
    ).toBeUndefined();
    expect(input.riders.find((rider) => rider.id === helper.id)?.raceDuty)
      .toBe("breakaway_candidate");
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

    expect(context.simulation.results).toBe(run.simulation.results);
    expect(context.simulation.resolvedRiders).toBe(
      run.simulation.resolvedRiders,
    );
    expect(context.input.seed).toBe(run.input.seed);
  });

  it("réaffiche les rôles préparés dans un ancien scénario verrouillé sans modifier ses résultats", () => {
    const riders = [
      createRider("favori-automatique", "team-a"),
      {
        ...createRider("leader-prepare", "team-a"),
        role: "leader_sprinter" as const,
      },
    ];
    const edition = createEdition({
      slug: "tour-replay-roles-prepares",
      riders,
    });
    edition.raceFormat = "stage_race";
    edition.stages[0].riderRoleOverrides = {
      "favori-automatique": "domestique",
      "leader-prepare": "leader",
    };
    const run = simulateOfficialRaceEdition(edition)[0];
    const staleRoleByRiderId = new Map([
      ["favori-automatique", "leader" as const],
      ["leader-prepare", "leader_sprinter" as const],
    ]);
    const lockedInput = {
      ...run.input,
      riders: run.input.riders.map((rider) => ({
        ...rider,
        role: staleRoleByRiderId.get(rider.id) ?? rider.role,
      })),
    };
    const lockedSimulation = {
      ...run.simulation,
      resolvedRiders: run.simulation.resolvedRiders.map((rider) => ({
        ...rider,
        role: staleRoleByRiderId.get(rider.id) ?? rider.role,
      })),
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

    expect(
      context.simulation.resolvedRiders.find(
        (rider) => rider.id === "favori-automatique",
      )?.role,
    ).toBe("domestique");
    expect(
      context.simulation.resolvedRiders.find(
        (rider) => rider.id === "leader-prepare",
      )?.role,
    ).toBe("leader");
    expect(context.simulation.results).toBe(lockedSimulation.results);
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
    const generalBeforeSecondStage = buildOfficialStageRaceStandings([
      runs[0],
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
    const standingsAfterStageOne = buildOfficialStageRaceStandings([
      { ...runs[0], simulation: firstStageSimulation },
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
