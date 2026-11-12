import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage, type RaceGroupSnapshot, type RaceTimelineSnapshot } from "./race-simulation";
import {
  buildRaceCourseJournal,
  RACE_COURSE_JOURNAL_MAX_ENTRIES,
} from "./race-course-journal";

describe("buildRaceCourseJournal", () => {
  it("résume chronologiquement une course vallonnée jusqu’à la victoire", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("collines-ardennes", 7),
    );
    const journal = buildRaceCourseJournal({ simulation });

    expect(journal.length).toBeLessThanOrEqual(
      RACE_COURSE_JOURNAL_MAX_ENTRIES,
    );
    expect(journal[0]).toMatchObject({ kind: "start", distanceKm: 0 });
    expect(journal.some((entry) => entry.kind === "breakaway")).toBe(true);
    expect(journal.some((entry) => entry.kind === "gap")).toBe(true);
    expect(journal.some((entry) => entry.kind === "junction")).toBe(true);
    expect(journal.some((entry) => entry.kind === "attack")).toBe(true);
    expect(journal.at(-1)).toMatchObject({ kind: "finish", title: "Victoire" });
    expect(journal.at(-1)?.detail).toContain("s’impose");
    expect(journal.map((entry) => entry.distanceKm)).toEqual(
      [...journal].map((entry) => entry.distanceKm).sort((a, b) => a - b),
    );
  });

  it("conserve les chutes et les avaries sans recopier tout le direct", () => {
    const simulation = simulateRaceStage(
      createDemoSimulationInput("sprint-littoral", 7),
    );
    const journal = buildRaceCourseJournal({ simulation });
    const incidentTitles = journal
      .filter((entry) => entry.kind === "incident")
      .map((entry) => entry.title);

    expect(incidentTitles).toContain("Chute");
    expect(incidentTitles).toContain("Avarie mécanique");
    expect(journal.length).toBeLessThan(simulation.timeline.length);
    expect(journal.filter((entry) => entry.kind === "finish")).toHaveLength(1);
  });

  it.each([
    ["déclenche l’attaque préparée sur le tronçon 2.", 10],
    ["profite d’un temps mort et part seul en chasse-patate.", 20],
    ["profite d’un peloton encore attentiste pour tenter de rejoindre la tête.", 20],
  ])("relie la sortie (%s) à la reprise observée au pointage suivant", (commentary, attackKm) => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, pursuer] = simulation.resolvedRiders;
    const together = group("peloton", 0, attacker.id, pursuer.id);
    simulation.timeline = [
      snapshot(1, 10, [together]),
      snapshot(2, 20, [group("breakaway", 0, attacker.id), group("peloton", 24, pursuer.id)], [
        `${attacker.name} ${commentary}`,
      ]),
      snapshot(3, 30, [together]),
      snapshot(4, 100, [together]),
    ];
    simulation.primes = [];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.find((entry) => entry.kind === "attack")).toMatchObject({ distanceKm: attackKm, riderIds: [attacker.id] });
    expect(journal.find((entry) => entry.caughtRiderIds?.includes(attacker.id))).toMatchObject({
      kind: "junction", distanceKm: 30, detail: `${attacker.name} est repris par le peloton au pointage du tronçon.`,
    });
  });

  it("distingue le dernier GPM sur le tronçon final du classement d’étape", () => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [gpmWinner, stageWinner] = simulation.resolvedRiders;
    simulation.timeline = [
      snapshot(1, 90, [group("breakaway", 0, gpmWinner.id), group("peloton", 20, stageWinner.id)]),
      snapshot(2, 100, [group("peloton", 0, stageWinner.id, gpmWinner.id)]),
    ];
    simulation.primes = [{
      segmentNumber: 2, prime: { type: "mountain", category: "2", pointsScale: [10] },
      classification: [{ riderId: gpmWinner.id, rank: 1, points: 10 }],
    }];
    simulation.results = [
      { riderId: stageWinner.id, rank: 1, status: "finished", elapsedTimeSeconds: 8000, gapToWinnerSeconds: 0,
        energyAfter: 10, injury: null, abandonment: null },
    ];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.find((entry) => entry.kind === "prime")).toMatchObject({
      title: "Dernier GPM", distanceKm: 100, segmentNumber: 2, distanceIsSegmentEnd: true, riderIds: [gpmWinner.id],
    });
    expect(journal.at(-1)).toMatchObject({ kind: "finish", riderIds: [stageWinner.id] });
    expect(journal.some((entry) => entry.caughtRiderIds?.includes(gpmWinner.id))).toBe(false);
  });

  it("distingue le tempo d’une attaque et un dépassement d’une jonction", () => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, pursuer] = simulation.resolvedRiders;
    const peloton = group("peloton", 0, pursuer.id);
    simulation.timeline = [
      snapshot(1, 10, [group("breakaway", 0, attacker.id), group("peloton", 20, pursuer.id)]),
      snapshot(2, 20, [peloton, group("dropped", 9, attacker.id)], [`${pursuer.name} impose son rythme dans l’ascension.`]),
      snapshot(3, 30, [peloton, group("dropped", 15, attacker.id)]),
    ];
    simulation.primes = [];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.find((entry) => entry.title === "Tempo")).toMatchObject({ kind: "selection", riderIds: [pursuer.id] });
    expect(journal.find((entry) => entry.title === "Dépassé par le peloton")).toMatchObject({ kind: "selection", riderIds: [attacker.id] });
    expect(journal.some((entry) => entry.caughtRiderIds?.includes(attacker.id))).toBe(false);
  });
});

function group(type: RaceGroupSnapshot["type"], gapToLeaderSeconds: number, ...riderIds: string[]): RaceGroupSnapshot {
  return { id: `${type}-${riderIds.join("-")}`, label: type, type, riderIds, gapToLeaderSeconds, averageEnergy: 50 };
}

function snapshot(segmentNumber: number, completedDistanceKm: number, groups: RaceGroupSnapshot[], commentary: string[] = []): RaceTimelineSnapshot {
  return { segmentNumber, completedDistanceKm, groups, commentary, incidents: [], abandonments: [] };
}
