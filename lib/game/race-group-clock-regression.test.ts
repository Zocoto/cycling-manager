import { describe, expect, it } from "vitest";
import barichara from "./__fixtures__/barichara-group-clocks.json";
import { createDemoSimulationInput, RACE_DEMO_SCENARIOS } from "./race-simulation-demo";
import {
  buildFlatGroupFinishTimes, simulateRaceStage, validateRoadSnapshotGroups,
  type RaceGroupSnapshot, type StageSimulationInput,
} from "./race-simulation";

describe("sporting group clocks", () => {
  it("refuses the exhausted zero-gap detached group that corrupted Barichara v36", () => {
    const groups: RaceGroupSnapshot[] = [
      { id: "exhausted", label: "Groupe attardé", type: "dropped", riderIds: ["exhausted"],
        gapToLeaderSeconds: 0, averageEnergy: 0 },
      { id: "peloton", label: "Peloton", type: "peloton", riderIds: ["leader"],
        gapToLeaderSeconds: 0, averageEnergy: 63 },
    ];
    expect(() => validateRoadSnapshotGroups(groups, ["exhausted", "leader"]))
      .toThrow("groupe attardé sans retard réel");
    expect(() => validateRoadSnapshotGroups([
      { ...groups[0], type: "breakaway", label: "Échappée E1" },
      { ...groups[1], gapToLeaderSeconds: 25 },
    ], ["exhausted", "leader"])).not.toThrow();
  });

  it("uses the leading group even if the incoming array is out of order", () => {
    const times = buildFlatGroupFinishTimes({
      groups: [
        { riderIds: ["rear"], gapToLeaderSeconds: 45 },
        { riderIds: ["front"], gapToLeaderSeconds: 0 },
      ],
      elapsedTimeByRiderId: new Map([["rear", 900], ["front", 1000]]),
    });
    expect([...times]).toEqual([["front", 1000], ["rear", 1045]]);
  });

  it("replays Barichara without promoting the exhausted riders over Gautam", () => {
    const input = barichara as StageSimulationInput;
    const simulation = simulateRaceStage(input);
    expect(simulateRaceStage(input)).toEqual(simulation);
    const gautam = simulation.resolvedRiders.find((rider) => rider.name === "Gautam Patel")!;
    expect(simulation.results.find((result) => result.riderId === gautam.id))
      .toMatchObject({ rank: 3, gapToWinnerSeconds: 0, status: "finished" });
    const formerPhantomPodium = ["Jhony Cabezas", "Clément Abessolo"];
    for (const name of formerPhantomPodium) {
      const rider = simulation.resolvedRiders.find((entry) => entry.name === name)!;
      expect(simulation.results.find((result) => result.riderId === rider.id)!.rank).toBeGreaterThan(10);
    }
    for (const snapshot of simulation.timeline) {
      expect(() => validateRoadSnapshotGroups(snapshot.groups, input.riders.map((r) => r.id))).not.toThrow();
    }
  });

  it("keeps complete coherent groups and monotone results across all road profiles", () => {
    for (const scenario of RACE_DEMO_SCENARIOS.filter((entry) => entry.stageType === "road")) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const input = createDemoSimulationInput(scenario.id, seed);
        const simulation = simulateRaceStage(input);
        for (const snapshot of simulation.timeline) {
          const abandoned = new Set(simulation.timeline
            .filter((entry) => entry.segmentNumber <= snapshot.segmentNumber)
            .flatMap((entry) => entry.abandonments.map((r) => r.riderId)));
          validateRoadSnapshotGroups(snapshot.groups, input.riders
            .filter((r) => !abandoned.has(r.id)).map((r) => r.id));
        }
        const finishers = simulation.results.filter((r) => r.status === "finished");
        for (const [index, result] of finishers.entries()) {
          expect(result.rank).toBe(index + 1);
          expect(result.elapsedTimeSeconds).toBeGreaterThanOrEqual(finishers[index - 1]?.elapsedTimeSeconds ?? 0);
          expect(result.gapToWinnerSeconds).toBe(result.elapsedTimeSeconds - finishers[0].elapsedTimeSeconds);
        }
      }
    }
  }, 30_000);
});
