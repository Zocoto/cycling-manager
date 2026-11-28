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

  it("signale la reprise d’une attaque préparée qui se termine dans le même tronçon", () => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, otherAttacker, pursuer] = simulation.resolvedRiders;
    const peloton = group("peloton", 0, attacker.id, otherAttacker.id, pursuer.id);
    simulation.timeline = [
      snapshot(7, 150, [peloton]),
      snapshot(8, 170, [peloton], [
        `${attacker.name}, ${otherAttacker.name} déclenchent l’attaque préparée sur le tronçon 8, à 38 km de l’arrivée.`,
      ]),
      snapshot(9, 188, [peloton]),
    ];
    simulation.primes = [];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.find((entry) => entry.kind === "attack")).toMatchObject({ distanceKm: 150 });
    expect(journal.filter((entry) => entry.caughtRiderIds?.length)).toMatchObject([{
      title: "Reprise par le peloton", distanceKm: 170, segmentNumber: 8,
      caughtRiderIds: [attacker.id, otherAttacker.id],
      detail: `Le peloton reprend ${attacker.name} et ${otherAttacker.name} avant la fin du tronçon.`,
    }]);
  });

  it("rend les reprises du dernier tronçon enregistrées par le moteur sans doublonner le commentaire", () => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, unableToFollow, pursuer] = simulation.resolvedRiders;
    simulation.timeline = [
      snapshot(1, 80, [group("breakaway", 0, attacker.id, unableToFollow.id), group("peloton", 20, pursuer.id)]),
      {
        ...snapshot(2, 100, [group("peloton", 0, pursuer.id, attacker.id), group("dropped", 7, unableToFollow.id)], [
          `${attacker.name} est repris par le peloton et se replace dans les roues.`,
          "L’échappée est reprise : le peloton est de nouveau groupé.",
        ]),
        pelotonCatches: [
          { riderId: attacker.id, rejoined: true },
          { riderId: unableToFollow.id, rejoined: false },
        ],
      },
    ];
    simulation.primes = [];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.filter((entry) => entry.caughtRiderIds?.length)).toMatchObject([
      { title: "Reprise par le peloton", distanceIsSegmentEnd: true, caughtRiderIds: [attacker.id] },
      { title: "Reprise par le peloton", distanceIsSegmentEnd: true, caughtRiderIds: [unableToFollow.id],
        detail: expect.stringContaining("reste distancé.") },
    ]);
    expect(journal.some((entry) => entry.title === "Échappée reprise")).toBe(false);
  });

  it("ne déduit pas une reprise d’une simple offensive ni du classement final d’un ancien replay", () => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, pursuer] = simulation.resolvedRiders;
    const peloton = group("peloton", 0, attacker.id, pursuer.id);
    simulation.timeline = [
      snapshot(1, 150, [peloton], [`${attacker.name} place une attaque dans le final.`]),
      snapshot(2, 188, [peloton], [`${attacker.name} déclenche l’attaque préparée sur le tronçon 2.`]),
    ];
    simulation.primes = [];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.filter((entry) => entry.kind === "attack")).toHaveLength(2);
    expect(journal.some((entry) => entry.caughtRiderIds?.length)).toBe(false);
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

  it.each([true, false])("replace le GPM avant la séparation finale même sans marqueur historique (%s)", (hasMarker) => {
    const simulation = simulateRaceStage(createDemoSimulationInput("collines-ardennes", 7));
    const [attacker, climber, other] = simulation.resolvedRiders;
    simulation.timeline = [
      snapshot(18, 180, [group("peloton", 0, attacker.id, climber.id, other.id)], [
        `${attacker.name}, favori n°5, refuse d’attendre et place une attaque dans le final.`,
      ]),
      snapshot(19, 184, [group("peloton", 0, attacker.id), group("dropped", 7, climber.id)], [
        ...(hasMarker ? [`${climber.name} passe en tête du GPM.`] : []),
        `${climber.name} impose son rythme dans la longue ascension finale ; les purs grimpeurs prennent progressivement le dessus.`,
        `${attacker.name} prolonge son attaque jusqu’à la ligne et conserve 9 s sur ses premiers poursuivants.`,
      ]),
    ];
    simulation.primes = [{
      segmentNumber: 19, prime: { type: "mountain", category: "HC", pointsScale: [20, 15, 12] },
      classification: [
        { riderId: climber.id, rank: 1, points: 20 },
        { riderId: other.id, rank: 2, points: 15 },
        { riderId: attacker.id, rank: 3, points: 12 },
      ],
    }];
    simulation.results = [
      { riderId: attacker.id, rank: 1, status: "finished", elapsedTimeSeconds: 8000, gapToWinnerSeconds: 0,
        energyAfter: 10, injury: null, abandonment: null },
      { riderId: climber.id, rank: 2, status: "finished", elapsedTimeSeconds: 8007, gapToWinnerSeconds: 7,
        energyAfter: 10, injury: null, abandonment: null },
    ];

    const journal = buildRaceCourseJournal({ simulation });
    expect(journal.slice(-6).map((entry) => entry.title)).toEqual([
      "Offensive", "Dernier GPM", "Tempo", "Offensive", "Sélection à l’arrivée", "Victoire",
    ]);
    expect(journal.at(-3)).toMatchObject({
      kind: "attack",
      detail: `Classé 3e au GPM derrière ${climber.name}, ${attacker.name} termine 7 s devant lui.`,
      riderIds: [attacker.id, climber.id],
    });
    expect(journal.some((entry) => entry.detail.includes("conserve 9 s"))).toBe(false);
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
