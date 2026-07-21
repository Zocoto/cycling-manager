import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  accumulateRaceGroupGapsFromLeader,
  areFinishersInSameTimeGroup,
  assignAutomaticRaceRoles,
  buildStageRaceStandings,
  getStageAttackParticipants,
  getFinalBattleRiderIds,
  getFinalBattleScenario,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";

describe("areFinishersInSameTimeGroup", () => {
  it("conserve les écarts de 1, 2 ou 3 secondes en MT et casse à 4 secondes", () => {
    expect(areFinishersInSameTimeGroup(100, 101)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 102)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 103)).toBe(true);
    expect(areFinishersInSameTimeGroup(100, 104)).toBe(false);
  });
});

describe("accumulateRaceGroupGapsFromLeader", () => {
  it("exprime chaque écart successif depuis le groupe de tête", () => {
    const groups = [0, 8, 10, 8].map((gapToLeaderSeconds, index) => ({
      id: `group-${index}`,
      label: `Groupe ${index}`,
      type: index === 0 ? ("peloton" as const) : ("dropped" as const),
      riderIds: [`rider-${index}`],
      gapToLeaderSeconds,
      averageEnergy: 50,
    }));

    expect(
      accumulateRaceGroupGapsFromLeader(groups).map(
        (group) => group.gapToLeaderSeconds
      )
    ).toEqual([0, 8, 18, 26]);
  });
});

describe("simulateRaceStage", () => {
  it("rejoue exactement la même course avec la même graine", () => {
    const input = createDemoSimulationInput("sprint-littoral", 12);

    expect(simulateRaceStage(input)).toEqual(simulateRaceStage(input));
  });

  it("produit un classement complet avec des rangs uniques", () => {
    const input = createDemoSimulationInput("collines-ardennes", 3);
    const result = simulateRaceStage(input);

    expect(result.results).toHaveLength(input.riders.length);
    const finishers = result.results.filter(
      (item) => item.status === "finished"
    );
    expect(finishers.map((item) => item.rank)).toEqual(
      Array.from({ length: finishers.length }, (_, index) => index + 1)
    );
    expect(
      result.results
        .filter((item) => item.status === "did_not_finish")
        .every((item) => item.rank === null)
    ).toBe(true);
    expect(result.results[0].gapToWinnerSeconds).toBe(0);
    expect(result.timeline).toHaveLength(input.segments.length);
  });

  it("commence avec un peloton groupé avant de laisser partir l’échappée", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );

    expect(
      result.timeline[0].groups.map((group) => group.type)
    ).toEqual(["peloton"]);
    expect(
      result.timeline[1].groups.some(
        (group) => group.type === "breakaway"
      )
    ).toBe(true);
    expect(result.timeline[1].commentary.join(" ")).toContain(
      "attaque"
    );
  });

  it("restitue une seule fois chaque attaquant avec son premier tronçon", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );
    const participants = getStageAttackParticipants(result);
    const participantIds = participants.map((participant) => participant.riderId);

    expect(participants.length).toBeGreaterThan(0);
    expect(new Set(participantIds).size).toBe(participantIds.length);
    for (const participant of participants) {
      const firstSnapshot = result.timeline.find((snapshot) =>
        snapshot.groups.some(
          (group) =>
            (group.type === "breakaway" || group.type === "chase") &&
            group.riderIds.includes(participant.riderId)
        )
      );
      expect(participant.firstSegmentNumber).toBe(firstSnapshot?.segmentNumber);
    }
  });

  it("détermine le format du final avec la taille du groupe qui joue la victoire", () => {
    const massFinish = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 1)
    );
    const selectiveFinish = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );

    expect(getFinalBattleRiderIds(massFinish).length).toBeGreaterThan(10);
    expect(getFinalBattleRiderIds(selectiveFinish).length).toBeLessThanOrEqual(10);
  });

  it("explique l’origine de chaque coureur présent dans un final sélectif", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );
    const scenario = getFinalBattleScenario(simulation);
    const explainedRiderIds = new Set([
      ...scenario.entryLeaderIds,
      ...scenario.lateJoiners.map((lateJoiner) => lateJoiner.riderId),
    ]);

    expect(explainedRiderIds).toEqual(new Set(scenario.contenderIds));
    expect(
      scenario.lateJoiners.every(
        (lateJoiner) => lateJoiner.fromGroupLabel.length > 0
      )
    ).toBe(true);
  });

  it("fait payer davantage d’énergie à une petite échappée", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7)
    );
    const comparableSnapshot = result.timeline
      .slice(2)
      .find(
        (snapshot) =>
          snapshot.groups.some((group) => group.type === "breakaway") &&
          snapshot.groups.some((group) => group.type === "peloton")
      );

    expect(comparableSnapshot).toBeDefined();
    const breakaway = comparableSnapshot!.groups.find((group) => group.type === "breakaway")!;
    const peloton = comparableSnapshot!.groups.find((group) => group.type === "peloton")!;
    expect(breakaway.averageEnergy).toBeLessThan(peloton.averageEnergy);
  });

  it("réduit l'avantage de l'aspiration lorsque la pente devient forte", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const getAverageEnergyAfter = (
      terrain: "flat" | "climb",
      riderCount: number
    ) => {
      const riders = Array.from({ length: riderCount }, (_, index) =>
        createSelectionTestRider(`${terrain}-${riderCount}-${index}`, {})
      );
      const result = simulateRaceStage({
        ...baseInput,
        profileType: terrain === "climb" ? "mountain" : "flat",
        segments: [
          {
            segmentNumber: 1,
            distanceKm: 30,
            terrain,
            averageGradientPct: terrain === "climb" ? 8 : 0,
            surface: "asphalt",
            prime: null,
          },
        ],
        riders,
      });

      return (
        result.results.reduce(
          (total, resultRow) => total + resultRow.energyAfter,
          0
        ) / result.results.length
      );
    };
    const flatDraftingBenefit =
      getAverageEnergyAfter("flat", 12) - getAverageEnergyAfter("flat", 2);
    const uphillDraftingBenefit =
      getAverageEnergyAfter("climb", 12) - getAverageEnergyAfter("climb", 2);

    expect(flatDraftingBenefit).toBeGreaterThan(uphillDraftingBenefit);
  });

  it("attribue les points des GPM et sprints intermédiaires", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 2)
    );

    expect(result.primes.some((prime) => prime.prime.type === "mountain")).toBe(true);
    expect(Object.values(result.mountainPoints).some((points) => points > 0)).toBe(true);
    expect(Object.values(result.sprintPoints).some((points) => points > 0)).toBe(true);
  });

  it("favorise un spécialiste du chrono sur un contre-la-montre", () => {
    const input = createDemoSimulationInput("chrono-algarve", 9);
    const result = simulateRaceStage(input);
    const winner = result.resolvedRiders.find(
      (rider) => rider.id === result.results[0].riderId
    )!;

    expect(winner.ratings.timeTrial).toBeGreaterThanOrEqual(78);
    expect(result.timeline.at(-1)?.groups[0].riderIds).toContain(winner.id);
  });

  it("attribue le même temps aux coureurs d'un sprint massif restés dans le peloton", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 12)
    );
    const finalPelotonIds = new Set(
      result.timeline.at(-1)?.groups.find((group) => group.type === "peloton")?.riderIds ?? []
    );
    const pelotonResults = result.results.filter((resultRow) =>
      finalPelotonIds.has(resultRow.riderId)
    );

    expect(pelotonResults.length).toBeGreaterThan(1);
    expect(new Set(pelotonResults.map((resultRow) => resultRow.elapsedTimeSeconds)).size).toBe(1);
  });

  it("conserve le temps commun d'un groupe sur une étape classée montagne", () => {
    const mountainInput = createDemoSimulationInput("haute-montagne", 1);
    const result = simulateRaceStage({
      ...mountainInput,
      segments: mountainInput.segments.map((segment) => ({
        ...segment,
        terrain: "flat" as const,
        averageGradientPct: 0,
        prime: null,
      })),
    });
    const resultByRiderId = new Map(
      result.results.map((resultRow) => [resultRow.riderId, resultRow])
    );
    const groupedArrivals = (result.timeline.at(-1)?.groups ?? [])
      .map((group) =>
        group.riderIds.flatMap((riderId) => {
          const resultRow = resultByRiderId.get(riderId);
          return resultRow?.status === "finished" ? [resultRow] : [];
        })
      )
      .filter((group) => group.length > 1);

    expect(groupedArrivals.length).toBeGreaterThan(0);
    expect(
      groupedArrivals.every(
        (group) =>
          new Set(group.map((resultRow) => resultRow.elapsedTimeSeconds)).size === 1
      )
    ).toBe(true);
  });

  it("donne la priorité aux grimpeurs sur une longue ascension finale", () => {
    const baseInput = createDemoSimulationInput("haute-montagne", 1);
    const longSummitSegments = baseInput.segments.map((segment, index) =>
      index >= baseInput.segments.length - 3
        ? {
            ...segment,
            terrain: "climb" as const,
            averageGradientPct: 8,
            surface: "asphalt" as const,
          }
        : segment
    );
    const climbers = Array.from({ length: 3 }, (_, index) =>
      createSelectionTestRider(`grimpeur-${index}`, {
        mountain: 80,
        hills: 65,
        acceleration: 55,
        endurance: 58,
        resistance: 58,
        breakaway: 45,
      })
    );
    const secondarySpecialists = Array.from({ length: 6 }, (_, index) =>
      createSelectionTestRider(`secondaire-${index}`, {
        mountain: 50,
        hills: 55,
        acceleration: 90,
        endurance: 90,
        resistance: 90,
        breakaway: 85,
      })
    );

    const simulations = Array.from({ length: 30 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        segments: longSummitSegments,
        riders: [...climbers, ...secondarySpecialists],
      })
    );

    const secondaryRidersAheadOfAFinishingClimber = simulations.flatMap(
      (simulation) => {
        const bestFinishingClimberRank = Math.min(
          ...simulation.results
            .filter(
              (resultRow) =>
                resultRow.status === "finished" &&
                resultRow.riderId.startsWith("grimpeur-")
            )
            .map((resultRow) => resultRow.rank ?? Number.POSITIVE_INFINITY)
        );

        return simulation.results.filter(
          (resultRow) =>
            resultRow.status === "finished" &&
            resultRow.riderId.startsWith("secondaire-") &&
            (resultRow.rank ?? Number.POSITIVE_INFINITY) < bestFinishingClimberRank
        );
      }
    ).length;
    const completeClimberFinishes = simulations.filter(
      (simulation) =>
        simulation.results.filter(
          (resultRow) =>
            resultRow.status === "finished" &&
            resultRow.riderId.startsWith("grimpeur-")
        ).length === climbers.length
    );

    expect(secondaryRidersAheadOfAFinishingClimber).toBe(0);
    expect(
      completeClimberFinishes.every((simulation) =>
        simulation.results
          .filter((resultRow) => resultRow.status === "finished")
          .slice(0, climbers.length)
          .every((resultRow) => resultRow.riderId.startsWith("grimpeur-"))
      )
    ).toBe(true);
  });

  it("laisse certaines échappées aller au bout sans rendre ce résultat systématique", () => {
    const outcomes = Array.from({ length: 100 }, (_, index) =>
      simulateRaceStage(createDemoSimulationInput("collines-ardennes", index + 1))
    ).map((result) =>
      result.timeline.at(-1)?.groups.some((group) => group.type === "breakaway") ?? false
    );

    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it("favorise nettement les puncheurs face aux baroudeurs sur une étape vallonnée", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const riders = [
      ...Array.from({ length: 4 }, (_, index) =>
        createHillyTestRider("puncheur", index)
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        createHillyTestRider("baroudeur", index)
      ),
    ];
    const winners = Array.from({ length: 120 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        riders,
      }).results[0].riderId
    );
    const puncherWins = winners.filter((riderId) =>
      riderId.startsWith("puncheur-")
    ).length;

    expect(puncherWins).toBeGreaterThanOrEqual(84);
  });

  it("écarte durablement les coureurs très inférieurs dans la statistique clé", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const strongRiders = Array.from({ length: 2 }, (_, index) =>
      createSelectionTestRider(`fort-${index}`, {
        hills: 70,
        mountain: 62,
        acceleration: 68,
      })
    );
    const weakRiders = Array.from({ length: 4 }, (_, index) =>
      createSelectionTestRider(`faible-${index}`, {
        hills: 45,
        mountain: 47,
        acceleration: 52,
      })
    );
    const result = simulateRaceStage({
      ...baseInput,
      riders: [...strongRiders, ...weakRiders],
    });
    const weakIds = new Set(weakRiders.map((rider) => rider.id));
    const firstDropIndex = result.timeline.findIndex((snapshot) =>
      snapshot.groups.some(
        (group) =>
          group.type === "dropped" &&
          group.riderIds.some((riderId) => weakIds.has(riderId))
      )
    );

    expect(firstDropIndex).toBeGreaterThan(0);
    expect(
      result.timeline.slice(firstDropIndex).every((snapshot) =>
        snapshot.groups
          .filter((group) => group.type !== "dropped")
          .every((group) =>
            group.riderIds.every((riderId) => !weakIds.has(riderId))
          )
      )
    ).toBe(true);
    expect(
      Math.min(
        ...result.results
          .filter((row) => weakIds.has(row.riderId))
          .map((row) => row.gapToWinnerSeconds)
      )
    ).toBeGreaterThan(120);
  });

  it("fait de la note sprint le facteur décisif d'un final plat", () => {
    const baseInput = createDemoSimulationInput("sprint-littoral", 1);
    const pureSprinter = createSelectionTestRider("pur-sprinteur", {
      sprint: 84,
      acceleration: 74,
      flat: 70,
    });
    const explosiveRider = createSelectionTestRider("explosif", {
      sprint: 66,
      acceleration: 94,
      flat: 80,
    });
    const simulations = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage({
        ...baseInput,
        seed: index + 1,
        riders: [pureSprinter, explosiveRider],
      })
    );
    const groupedFinishes = simulations.filter((result) => {
      const pureResult = result.results.find((row) => row.riderId === pureSprinter.id);
      const explosiveResult = result.results.find((row) => row.riderId === explosiveRider.id);

      return (
        pureResult?.status === "finished" &&
        explosiveResult?.status === "finished" &&
        pureResult.gapToWinnerSeconds === 0 &&
        explosiveResult.gapToWinnerSeconds === 0
      );
    });

    expect(groupedFinishes.length).toBeGreaterThanOrEqual(20);
    const pureSprinterWinRate =
      groupedFinishes.filter(
        (result) => result.results[0].riderId === pureSprinter.id
      ).length / groupedFinishes.length;
    expect(pureSprinterWinRate).toBeGreaterThanOrEqual(0.9);
  });

  it("applique le bonus local de +2 sans modifier les notes permanentes", () => {
    const baseInput = createDemoSimulationInput("collines-ardennes", 1);
    const local = {
      ...createSelectionTestRider("local", { hills: 64 }),
      countryCode: "BE",
    };
    const visitor = {
      ...createSelectionTestRider("visiteur", { hills: 64 }),
      countryCode: "FR",
    };
    const result = simulateRaceStage({
      ...baseInput,
      raceCountryCode: "BE",
      riders: [local, visitor],
    });
    const resolvedLocal = result.resolvedRiders.find(
      (rider) => rider.id === local.id
    )!;
    const resolvedVisitor = result.resolvedRiders.find(
      (rider) => rider.id === visitor.id
    )!;

    expect(resolvedLocal.localRaceBonus).toBe(2);
    expect(resolvedVisitor.localRaceBonus).toBe(0);
    expect(resolvedLocal.ratings).toEqual(local.ratings);
  });

  it("génère de manière déterministe crevaisons, bordures et chutes", () => {
    const incidentTypes = new Set(
      Array.from({ length: 60 }, (_, index) =>
        simulateRaceStage(
          createDemoSimulationInput(
            "collines-ardennes",
            index + 1
          )
        ).timeline.flatMap((snapshot) =>
          snapshot.incidents.map((incident) => incident.type)
        )
      ).flat()
    );

    expect(incidentTypes).toEqual(
      new Set([
        "puncture",
        "crosswind",
        "crash_individual",
        "crash_mass",
      ])
    );
  });

  it("place les coureurs piégés par une bordure derrière le peloton", () => {
    const crosswindCase = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    )
      .flatMap((result) => result.timeline)
      .map((snapshot) => ({
        snapshot,
        incident: snapshot.incidents.find(
          (incident) => incident.type === "crosswind"
        ),
      }))
      .find(({ snapshot, incident }) => {
        const peloton = snapshot.groups.find(
          (group) => group.type === "peloton"
        );
        const affectedGroup = incident
          ? snapshot.groups.find((group) =>
              incident.riderIds.every((riderId) =>
                group.riderIds.includes(riderId)
              )
            )
          : null;
        return Boolean(incident && peloton && affectedGroup);
      });

    expect(crosswindCase).toBeDefined();
    const { snapshot, incident } = crosswindCase!;
    const pelotonIndex = snapshot.groups.findIndex(
      (group) => group.type === "peloton"
    );
    const affectedGroupIndex = snapshot.groups.findIndex((group) =>
      incident!.riderIds.every((riderId) =>
        group.riderIds.includes(riderId)
      )
    );
    const peloton = snapshot.groups[pelotonIndex];
    const affectedGroup = snapshot.groups[affectedGroupIndex];

    expect(affectedGroupIndex).toBeGreaterThan(pelotonIndex);
    expect(affectedGroup.type).toBe("dropped");
    expect(affectedGroup.gapToLeaderSeconds).toBeGreaterThan(
      peloton.gapToLeaderSeconds
    );
    expect(affectedGroup.label).toContain("bordure");
  });

  it("peut scinder une échappée en plusieurs groupes", () => {
    const result = simulateRaceStage(
      createDemoSimulationInput("haute-montagne", 1)
    );

    expect(
      result.timeline.some(
        (snapshot) =>
          snapshot.groups.filter(
            (group) => group.type === "breakaway"
          ).length > 1
      )
    ).toBe(true);
  });
  it("place un abandon sur chute en fin de classement et exclut le coureur de l'étape suivante", () => {
    const firstStage = Array.from({ length: 80 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    ).find((result) =>
      result.results.some(
        (row) => row.status === "did_not_finish"
      )
    );

    expect(firstStage).toBeDefined();
    const abandoned = firstStage!.results.at(-1)!;
    expect(abandoned.status).toBe("did_not_finish");
    expect(abandoned.rank).toBeNull();
    expect(abandoned.abandonment?.injury.recoveryDays).toBeGreaterThan(0);

    const nextInput = createDemoSimulationInput("collines-ardennes", 999);
    const nextStage = simulateRaceStage({
      ...nextInput,
      unavailableRiderIds: [abandoned.riderId],
    });
    expect(
      nextStage.resolvedRiders.some(
        (rider) => rider.id === abandoned.riderId
      )
    ).toBe(false);
  });

  it("peut diagnostiquer une blessure sans retirer le coureur du classement de l’étape", () => {
    const stage = Array.from({ length: 160 }, (_, index) =>
      simulateRaceStage(
        createDemoSimulationInput("collines-ardennes", index + 1)
      )
    ).find((result) =>
      result.results.some(
        (row) => row.status === "finished" && row.injury !== null
      )
    );

    expect(stage).toBeDefined();
    const injuredFinisher = stage!.results.find(
      (row) => row.status === "finished" && row.injury !== null
    )!;
    expect(injuredFinisher.rank).not.toBeNull();
    expect(injuredFinisher.abandonment).toBeNull();
    expect(injuredFinisher.injury?.recoveryHours).toBeGreaterThanOrEqual(72);
  });

  it("cumule les classements montagne, points, jeunes et équipes d'un tour", () => {
    const stages = [
      simulateRaceStage(createDemoSimulationInput("sprint-littoral", 12)),
      simulateRaceStage(createDemoSimulationInput("haute-montagne", 2)),
    ];
    const standings = buildStageRaceStandings(stages);

    expect(standings.mountain[0]?.points).toBeGreaterThan(0);
    expect(standings.sprint[0]?.points).toBeGreaterThan(0);
    expect(
      stages
        .flatMap((stage) => stage.resolvedRiders)
        .find((rider) => rider.id === standings.youth[0]?.riderId)?.age
    ).toBeLessThan(25);
    expect(standings.teams.length).toBeGreaterThan(1);
    expect(standings.teams[0].elapsedTimeSeconds).toBeLessThanOrEqual(
      standings.teams[1].elapsedTimeSeconds
    );
  });

  it("pondère le classement par équipes selon le nombre de coureurs engagés", () => {
    const stage = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 12)
    );
    const ridersByTeam = Map.groupBy(
      stage.resolvedRiders,
      (rider) => rider.teamId
    );
    const [smallTeam, largeTeam] = [...ridersByTeam.entries()].filter(
      ([, riders]) => riders.length >= 4
    );

    expect(smallTeam).toBeDefined();
    expect(largeTeam).toBeDefined();

    const smallTeamRiders = smallTeam[1].slice(0, 2);
    const largeTeamRiders = largeTeam[1].slice(0, 4);
    const selectedRiders = [...smallTeamRiders, ...largeTeamRiders];
    const resultByRiderId = new Map(
      stage.results.map((result) => [result.riderId, result])
    );
    const selectedResults = selectedRiders.map((rider, index) => {
      const original = resultByRiderId.get(rider.id)!;
      const isSmallTeam = rider.teamId === smallTeam[0];
      const teamIndex = isSmallTeam ? index : index - smallTeamRiders.length;
      const elapsedTimeSeconds =
        (isSmallTeam ? 2_000 : 1_000) + teamIndex * 10;
      return {
        ...original,
        status: "finished" as const,
        rank: index + 1,
        elapsedTimeSeconds,
        gapToWinnerSeconds: Math.max(0, elapsedTimeSeconds - 1_000),
        abandonment: null,
      };
    });
    const standings = buildStageRaceStandings([
      {
        ...stage,
        resolvedRiders: selectedRiders,
        results: selectedResults,
      },
    ]);

    expect(standings.teams[0]).toMatchObject({
      teamId: largeTeam[0],
      elapsedTimeSeconds: 1_015,
    });
    expect(standings.teams[1]).toMatchObject({
      teamId: smallTeam[0],
      elapsedTimeSeconds: 2_005,
    });
  });
});

function createHillyTestRider(
  archetype: "puncheur" | "baroudeur",
  index: number
): RiderSimulationInput {
  const isPuncher = archetype === "puncheur";
  return {
    id: `${archetype}-${index}`,
    name: `${archetype} ${index}`,
    teamId: `hilly-team-${index}`,
    teamName: `hilly team ${index}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 75,
    role: "auto",
    ratings: {
      flat: isPuncher ? 49 : 55,
      mountain: isPuncher ? 56 : 52,
      hills: isPuncher ? 64 : 57,
      cobbles: isPuncher ? 43 : 50,
      downhill: isPuncher ? 54 : 56,
      sprint: isPuncher ? 54 : 50,
      acceleration: isPuncher ? 62 : 54,
      timeTrial: isPuncher ? 46 : 52,
      prologue: isPuncher ? 48 : 50,
      endurance: isPuncher ? 56 : 61,
      resistance: isPuncher ? 55 : 59,
      recovery: isPuncher ? 55 : 56,
      breakaway: isPuncher ? 60 : 65,
    },
  };
}

function createSelectionTestRider(
  id: string,
  overrides: Partial<RiderSimulationInput["ratings"]>
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: `team ${id}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    age: 26,
    form: 75,
    role: "leader",
    ratings: {
      flat: 60,
      mountain: 60,
      hills: 60,
      cobbles: 60,
      downhill: 60,
      sprint: 60,
      acceleration: 60,
      timeTrial: 60,
      prologue: 60,
      endurance: 60,
      resistance: 60,
      recovery: 60,
      breakaway: 55,
      ...overrides,
    },
  };
}

describe("assignAutomaticRaceRoles", () => {
  it("désigne automatiquement un leader et un sprinteur sur un profil plat", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const oneTeam = input.riders
      .filter((rider) => rider.teamId === input.riders[0].teamId)
      .map((rider) => ({ ...rider, role: "auto" as const }));
    const resolved = assignAutomaticRaceRoles(oneTeam, input.segments);

    expect(resolved.filter((rider) => rider.role === "leader")).toHaveLength(1);
    expect(resolved.filter((rider) => rider.role === "sprinter")).toHaveLength(1);
  });

  it("refuse deux leaders dans la même équipe", () => {
    const input = createDemoSimulationInput("sprint-littoral", 1);
    const riders = input.riders.slice(0, 2).map(
      (rider) => ({ ...rider, role: "leader" }) as RiderSimulationInput
    );

    expect(() => assignAutomaticRaceRoles(riders, input.segments)).toThrow(
      "un seul leader"
    );
  });
});
