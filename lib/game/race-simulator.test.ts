import { describe, expect, it } from "vitest";

import { createDemoSimulationInput } from "./race-simulation-demo";
import { simulateRaceStage } from "./race-simulation";
import {
  buildRaceSimulatorLogs,
  getRaceSimulationOverallNote,
  getRaceSimulationProfileNote,
} from "./race-simulator";

describe("race simulator diagnostics", () => {
  it("produit un journal ordonné couvrant le départ, les groupes et le résultat", () => {
    const input = createDemoSimulationInput("collines-ardennes", "lab-logs");
    const simulation = simulateRaceStage(input);
    const logs = buildRaceSimulatorLogs(input, simulation);

    expect(logs.length).toBeGreaterThan(simulation.timeline.length);
    expect(logs[0]).toMatchObject({ sequence: 1, type: "setup" });
    expect(logs.some((entry) => entry.type === "event")).toBe(true);
    expect(logs.some((entry) => entry.type === "group")).toBe(true);
    expect(logs.at(-1)).toMatchObject({ type: "result" });
    expect(logs.map((entry) => entry.sequence)).toEqual(
      Array.from({ length: logs.length }, (_, index) => index + 1)
    );
  });

  it("calcule une note de profil stable à partir des pondérations du moteur", () => {
    const input = createDemoSimulationInput("haute-montagne", "lab-note");
    const rider = input.riders[0];
    const first = getRaceSimulationProfileNote({
      rider,
      segments: input.segments,
      stageType: input.stageType,
      profileType: input.profileType,
    });
    const second = getRaceSimulationProfileNote({
      rider,
      segments: input.segments,
      stageType: input.stageType,
      profileType: input.profileType,
    });

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(100);
  });

  it("affiche une moyenne couvrant les treize notes du coureur", () => {
    const input = createDemoSimulationInput("sprint-littoral", "lab-overall");
    const rider = input.riders[0];
    const expected = Math.round(
      Object.values(rider.ratings).reduce((total, value) => total + value, 0) /
        Object.values(rider.ratings).length
    );

    expect(getRaceSimulationOverallNote(rider.ratings)).toBe(expected);
  });
});
