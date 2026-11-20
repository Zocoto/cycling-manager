import { describe, expect, it } from "vitest";
import { createDemoSimulationInput } from "./race-simulation-demo";
import {
  getCrowdSurgeSegmentNumber,
  getNailLayerPursuitTargets,
  simulateRaceStage,
  simulateRaceStageResultsOnly,
  type StageSimulationInput,
} from "./race-simulation";
import type { RaceStageSegment } from "./race-profiles";

const segment = (segmentNumber: number, terrain: "flat" | "climb" | "descent", distanceKm: number, gradient = 0, surface: "asphalt" | "cobbles" = "asphalt"): RaceStageSegment => ({
  segmentNumber, terrain, distanceKm, averageGradientPct: gradient, surface, prime: null,
});

function chrono(): StageSimulationInput {
  const demo = createDemoSimulationInput("chrono-algarve", "crowd-test");
  return {
    ...demo,
    id: "crowd-surge-chrono",
    seed: "same-official-input",
    segments: [segment(1, "flat", 6), segment(2, "climb", 8, 7), segment(3, "descent", 5, -5), segment(4, "flat", 6)],
    riders: demo.riders.slice(0, 6).map((rider, index) => ({
      ...rider,
      id: `chrono-${index}`,
      form: 95,
      morale: 80,
      equipmentEffects: undefined,
      specialAbilities: [],
      specialAbility: null,
      performancePreparations: [],
      fanClubSupport: undefined,
    })),
  };
}

describe("Poseur de clous pursuit targets", () => {
  it("includes chasse-patate and the active peloton pursuit workers together", () => {
    const state = (id: string, group: string, teamId = "rival", elapsedTimeSeconds = 160) => ({
      rider: { id, teamId }, group, elapsedTimeSeconds,
    });
    const holder = state("holder", "breakaway", "holder-team", 100);
    const candidates = [
      holder, state("chasse-patate", "chase", "rival", 115),
      state("second-escape", "breakaway_2", "rival", 110),
      state("pursuit-worker", "peloton"), state("sheltered-leader", "peloton"),
      state("own-worker", "peloton", "holder-team"), state("own-chaser", "chase", "holder-team"),
      state("dropped", "dropped"), state("injured", "abandoned"), state("delayed", "delayed"),
      state("another-front-rider", "breakaway", "rival", 100),
      state("ahead", "chase", "rival", 99),
    ];
    const workers = new Set(["pursuit-worker", "own-worker", "dropped"]);
    expect(getNailLayerPursuitTargets(candidates, holder, workers).map(({ rider }) => rider.id))
      .toEqual(["chasse-patate", "second-escape", "pursuit-worker"]);
  });
  it("adds at most one individual puncture and still allows a complete stage without one", () => {
    const run = (seed: number) => {
      const input = createDemoSimulationInput("sprint-littoral", "nail-test");
      input.seed = `nail-check-${seed}`;
      input.riders = input.riders.map(rider => ({
        ...rider, specialAbilities: ["nail_layer", "panache"],
      }));
      return simulateRaceStage(input);
    };
    const success = run(7);
    const events = success.timeline.flatMap(point =>
      point.incidents.filter(incident => incident.id.includes("-nail-layer-")),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "puncture", abandonedRiderIds: [],
    });
    expect(events[0].riderIds).toHaveLength(1);
    expect(success.timeline.flatMap(point => point.commentary).filter(line => line.startsWith("Poseur de clous"))).toHaveLength(1);
    expect(run(0).timeline.flatMap(point => point.incidents).some(incident => incident.id.includes("-nail-layer-"))).toBe(false);
    expect(run(7)).toEqual(success);
  });
});

describe("Coup de pression fixed decisive sector", () => {
  it("uses the final sector on flat roads and the actual hardest original sector elsewhere", () => {
    expect(getCrowdSurgeSegmentNumber([segment(1, "flat", 30), segment(2, "flat", 10)], "sprint")).toBe(2);
    expect(getCrowdSurgeSegmentNumber(chrono().segments, "time_trial")).toBe(2);
    expect(getCrowdSurgeSegmentNumber([segment(1, "flat", 50), segment(2, "flat", 10, 0, "cobbles"), segment(3, "flat", 15)], "cobbles")).toBe(2);
  });

  it("boosts only the selected ITT sector and preserves other riders, ratings and the source snapshot", () => {
    const input = chrono();
    const baseline = simulateRaceStage(input);
    const holder = input.riders[0];
    holder.specialAbilities = ["crowd_surge"];
    holder.popularity = 100;
    const snapshot = structuredClone(input);
    const withoutBus = simulateRaceStage(input);
    input.riders[0].fanClubSupport = { mobilizedSupporters: 40, fervor: 0, ratingBoost: 0 };
    const withBus = simulateRaceStage(input);
    const elapsed = (simulation: ReturnType<typeof simulateRaceStage>, index: number) =>
      simulation.timeline[index].groups.find(group => group.riderIds.includes(holder.id))!.elapsedTimeSeconds!;
    expect(elapsed(withoutBus, 0)).toBe(elapsed(baseline, 0));
    expect(elapsed(withBus, 0)).toBe(elapsed(baseline, 0));
    const improvement = elapsed(baseline, 1) - elapsed(withoutBus, 1);
    expect(improvement).toBeGreaterThan(0);
    expect(elapsed(baseline, 1) - elapsed(withBus, 1)).toBeGreaterThan(improvement);
    expect(elapsed(baseline, 3) - elapsed(withoutBus, 3)).toBeCloseTo(improvement, 2);
    expect(withoutBus.timeline.flatMap(point => point.commentary).filter(line => line.startsWith("Coup de pression"))).toHaveLength(1);
    expect(withBus.timeline.flatMap(point => point.commentary).filter(line => line.startsWith("Coup de pression"))).toHaveLength(1);
    expect(withoutBus.resolvedRiders[0].ratings).toEqual(baseline.resolvedRiders[0].ratings);
    for (const rider of baseline.results.filter(result => result.riderId !== holder.id)) {
      expect(withoutBus.results.find(result => result.riderId === rider.riderId)?.elapsedTimeSeconds).toBe(rider.elapsedTimeSeconds);
    }
    expect(input.riders[0].ratings).toEqual(snapshot.riders[0].ratings);
    expect(snapshot.riders[0].crowdSurgeSegmentNumber).toBeUndefined();
  });

  it("remains inactive with zero popularity and on riders who do not own the capacity", () => {
    const input = chrono();
    const baseline = simulateRaceStage(input);
    input.riders[0].popularity = 100;
    const noCapacity = simulateRaceStage(input);
    expect(noCapacity.results).toEqual(baseline.results);
    expect(noCapacity.timeline).toEqual(baseline.timeline);
    input.riders[0].specialAbilities = ["crowd_surge"];
    input.riders[0].popularity = 0;
    const noPopularity = simulateRaceStage(input);
    expect(noPopularity.results).toEqual(baseline.results);
    expect(noPopularity.timeline).toEqual(baseline.timeline);
  });

  it("also contributes through the lightweight results-only entry point", () => {
    const input = chrono();
    const baseline = simulateRaceStageResultsOnly(input);
    input.riders[0].specialAbilities = ["crowd_surge"];
    input.riders[0].popularity = 100;
    const boosted = simulateRaceStageResultsOnly(input);
    const own = (simulation: typeof baseline) => simulation.results.find(result => result.riderId === input.riders[0].id)!;
    expect(own(boosted).gapToWinnerSeconds).toBeLessThan(own(baseline).gapToWinnerSeconds);
    expect(boosted.timeline).toEqual([]);
    expect(boosted.resolvedRiders[0].ratings).toEqual(baseline.resolvedRiders[0].ratings);
  });
});

