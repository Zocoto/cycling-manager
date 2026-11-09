import { describe, expect, it, vi } from "vitest";
import { buildRaceCourseJournal } from "./race-course-journal";
import { createDemoSimulationInput } from "./race-simulation-demo";
import { resolveExistingChasers, simulateRaceStage } from "./race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "./race-strategy";

type States = Parameters<typeof resolveExistingChasers>[0]["states"];
type State = States extends Map<string, infer Value> ? Value : never;
const base = createDemoSimulationInput("paves-zelande", "chaser-regrouping").riders[0];

function state(id: string, group: State["group"], elapsedTimeSeconds: number, energy = 58): State {
  return {
    rider: { ...base, id, name: id, role: "leader", specialAbility: null, specialAbilities: [],
      ratings: { ...base.ratings, breakaway: 69, acceleration: 66 } },
    group, energy, elapsedTimeSeconds, groupSinceSegment: 16, lostTimeSeconds: 0,
    raceDayExecutionBonus: 0, cobblesSectorExecutionBonus: 0, decisiveAttackBonus: 0,
    injuryPerformancePenalty: 0, finalSprintCrashFinishPenalty: 0,
  };
}

function resolve(chaserTime: number, options: { energy?: number; roll?: number; peloton?: boolean; gap?: number; since?: number; startGap?: number | null } = {}) {
  const chaser = state("chaser", "chase", chaserTime, options.energy);
  chaser.groupSinceSegment = options.since ?? 16;
  const peloton = [state("p1", "peloton", 18_400), state("p2", "peloton", 18_402)];
  const states = new Map([["chaser", chaser], ...(options.peloton === false ? [] : peloton.map(rider => [rider.rider.id, rider] as const))]);
  const random = vi.fn(() => options.roll ?? 0.99);
  const commentary: string[] = [];
  resolveExistingChasers({ states, segmentIndex: 17, breakawayGapSeconds: options.gap ?? 101,
    chaserGapsAtSegmentStart: new Map(options.startGap === null ? [] : [["chaser", options.startGap ?? -12]]), random, commentary });
  return { chaser, peloton, random, commentary };
}

function simulatePlannedChase(seed: string) {
  const input = createDemoSimulationInput("paves-zelande", seed);
  const rider = input.riders[0];
  const { segmentNumber } = input.segments.at(-3)!;
  const simulation = simulateRaceStage({
    ...input,
    teamStrategies: [{
      ...DEFAULT_RACE_TEAM_STRATEGY,
      teamId: rider.teamId,
      attackOrders: [{ riderId: rider.id, segmentNumber, intensity: "strong", condition: "always" }],
    }],
  });
  const before = simulation.timeline.find(frame => frame.segmentNumber === segmentNumber - 1)!;
  const frame = simulation.timeline.find(frame => frame.segmentNumber === segmentNumber)!;
  return { rider, before, frame, simulation };
}

describe("retour des chasseurs après une jonction manquée", () => {
  it("keeps a Kulmane-like rider physically ahead instead of dropping him by chance", () => {
    const { chaser } = resolve(18_389);
    expect(chaser).toMatchObject({ group: "chase", elapsedTimeSeconds: 18_389, energy: 58, lostTimeSeconds: 0, groupSinceSegment: 16 });
  });

  it.each([0, 0.65, 0.66, 0.99])("rejoins the actual catching group regardless of the old drop roll (%s)", roll => {
    const { chaser, commentary, random, peloton } = resolve(18_401, { roll });
    expect(chaser).toMatchObject({ group: "peloton", elapsedTimeSeconds: 18_401, lostTimeSeconds: 0, energy: 58 });
    expect(peloton.map(rider => rider.elapsedTimeSeconds)).toEqual([18_400, 18_402]);
    expect(commentary).toEqual(["chaser est repris par le peloton et se replace dans les roues."]);
    expect(random).toHaveBeenCalledTimes(1); // The bridge roll remains; no random drop roll.
  });

  it.each([-3, -1, 0, 1, 3])("regroups within the existing contact tolerance (%s seconds)", gap => {
    expect(resolve(18_401 + gap).chaser).toMatchObject({ group: "peloton", elapsedTimeSeconds: 18_401, lostTimeSeconds: 0 });
  });

  it.each([4, 11, 25])("preserves a real physical deficit without an additional time penalty (%s seconds)", gap => {
    expect(resolve(18_401 + gap, { startGap: gap }).chaser).toMatchObject({ group: "dropped", elapsedTimeSeconds: 18_401 + gap, lostTimeSeconds: gap });
  });

  it.each([4, 12, 25])("allows a rider overtaken mid-sector to shelter instead of losing %s seconds of solo pace", gap => {
    expect(resolve(18_401 + gap, { startGap: -8 }).chaser).toMatchObject({ group: "peloton", elapsedTimeSeconds: 18_401, energy: 58, lostTimeSeconds: 0 });
  });

  it("does not manufacture a catch when the rider is still ahead or no peloton exists", () => {
    expect(resolve(18_397).chaser.group).toBe("chase");
    expect(resolve(18_389, { peloton: false }).chaser).toMatchObject({ group: "chase", elapsedTimeSeconds: 18_389 });
  });

  it("leaves energy and the ordinary physical selection rules in charge of exhaustion", () => {
    expect(resolve(18_401, { energy: 2 }).chaser).toMatchObject({ group: "peloton", energy: 2, elapsedTimeSeconds: 18_401 });
    expect(resolve(18_412, { energy: 2, startGap: 11 }).chaser).toMatchObject({ group: "dropped", energy: 2, elapsedTimeSeconds: 18_412, lostTimeSeconds: 11 });
  });

  it("still allows a sufficiently strong rider to bridge towards the breakaway", () => {
    const chaser = state("strong", "chase", 18_350, 95);
    chaser.rider.ratings.breakaway = 92;
    chaser.rider.ratings.acceleration = 90;
    const states = new Map([["strong", chaser], ["p1", state("p1", "peloton", 18_401)]]);
    const commentary: string[] = [];
    resolveExistingChasers({ states, segmentIndex: 17, breakawayGapSeconds: 101,
      chaserGapsAtSegmentStart: new Map([["strong", -51]]), random: () => 0.5, commentary });
    expect(chaser).toMatchObject({ group: "breakaway_2", elapsedTimeSeconds: 18_350, lostTimeSeconds: 8 });
    expect(commentary[0]).toContain("se rapproche de l’échappée");
  });

  it("regroups a new attacker who starts in the field and is caught before the sector ends", () => {
    const { chaser, commentary, random } = resolve(18_417.455, { since: 17, startGap: 0 });
    expect(chaser).toMatchObject({ group: "peloton", elapsedTimeSeconds: 18_401, lostTimeSeconds: 0, energy: 58 });
    expect(commentary).toEqual(["chaser est repris par le peloton et se replace dans les roues."]);
    expect(random).not.toHaveBeenCalled();
  });

  it("preserves the measured deficit of a new chaser who was already behind", () => {
    const { chaser, random } = resolve(18_417, { since: 17, startGap: 8 });
    expect(chaser).toMatchObject({ group: "dropped", elapsedTimeSeconds: 18_417, lostTimeSeconds: 16, energy: 58 });
    expect(random).not.toHaveBeenCalled();
  });

  it("leaves a new attacker who is still physically ahead on the chase", () => {
    const { chaser, commentary, random } = resolve(18_389, { since: 17, startGap: 0 });
    expect(chaser).toMatchObject({ group: "chase", elapsedTimeSeconds: 18_389 });
    expect(commentary).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  });

  it("does not resolve a late attacker who has yet to ride a sector in the chase", () => {
    const { chaser, commentary, random } = resolve(18_417, { since: 17, startGap: null });
    expect(chaser).toMatchObject({ group: "chase", elapsedTimeSeconds: 18_417 });
    expect(commentary).toEqual([]);
    expect(random).not.toHaveBeenCalled();
  });
});

describe("chronologie affichée d’une chasse après une attaque programmée", () => {
  it("montre la reprise sur le tronçon de l’attaque au lieu d’un faux groupe de tête", () => {
    const { rider, before, frame, simulation } = simulatePlannedChase("planned-chase-geometry-2");
    expect(before.groups.find(group => group.type === "peloton")?.riderIds).toContain(rider.id);
    expect(frame.commentary.some(line => line.includes(rider.name) && line.includes("attaque préparée"))).toBe(true);
    expect(frame.commentary).toContain(`${rider.name} est repris par le peloton et se replace dans les roues.`);
    expect(frame.groups.find(group => group.riderIds.includes(rider.id))?.type).toBe("peloton");

    const journal = buildRaceCourseJournal({ simulation });
    const attackIndex = journal.findIndex(entry =>
      entry.kind === "attack" && entry.detail.includes(rider.name) && entry.detail.includes("attaque préparée"),
    );
    const catchIndex = journal.findIndex(entry =>
      entry.kind === "junction" && entry.detail.includes(`${rider.name} est repris par le peloton`),
    );
    expect(journal[attackIndex]?.distanceKm).toBe(before.completedDistanceKm);
    expect(journal[catchIndex]?.distanceKm).toBe(frame.completedDistanceKm);
    expect(attackIndex).toBeLessThan(catchIndex);
  });

  it("affiche l’avance mesurée d’un chasseur qui reste réellement devant le peloton", () => {
    const { rider, frame } = simulatePlannedChase("planned-chase-geometry-52");
    const chaser = frame.groups.find(group => group.riderIds.includes(rider.id))!;
    const field = frame.groups.find(group => group.type === "peloton")!;
    expect(chaser.type).toBe("breakaway");
    expect(chaser.riderIds).toEqual([rider.id]);
    expect(chaser.elapsedTimeSeconds).toBeLessThan(field.elapsedTimeSeconds!);
    const measuredGap = field.elapsedTimeSeconds! - chaser.elapsedTimeSeconds!;
    const displayedGap = field.gapToLeaderSeconds - chaser.gapToLeaderSeconds;
    expect(Math.abs(displayedGap - measuredGap)).toBeLessThanOrEqual(1);
  });
});
