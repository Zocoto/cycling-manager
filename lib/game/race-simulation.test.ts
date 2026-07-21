import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  assignAutomaticRaceRoles,
  buildStageRaceStandings,
  getStageAttackParticipants,
  getFinalBattleRiderIds,
  getFinalBattleScenario,
  simulateRaceStage,
  type RiderSimulationInput,
} from "./race-simulation";

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
      .slice(1)
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

  it("laisse certaines échappées aller au bout sans rendre ce résultat systématique", () => {
    const outcomes = Array.from({ length: 30 }, (_, index) =>
      simulateRaceStage(createDemoSimulationInput("collines-ardennes", index + 1))
    ).map((result) =>
      result.timeline.at(-1)?.groups.some((group) => group.type === "breakaway") ?? false
    );

    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
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
    const abandoned = firstStage!.results.find(
      (row) => row.status === "did_not_finish"
    )!;
    expect(firstStage!.results.at(-1)).toEqual(abandoned);
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
});

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
