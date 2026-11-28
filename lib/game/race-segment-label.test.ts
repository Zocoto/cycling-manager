import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { RaceStageSegment } from "./race-profiles";
import {
  formatRaceSegmentOption,
  getRaceSegmentGradientLabel,
  getRaceSegmentTerrainLabel,
} from "./race-segment-label";

const segment = (terrain: RaceStageSegment["terrain"], surface: RaceStageSegment["surface"], gradient = 0): RaceStageSegment => ({
  segmentNumber: 7, distanceKm: 5, terrain, surface, averageGradientPct: gradient, prime: null,
});

describe("race segment presentation", () => {
  it.each([
    ["flat", "asphalt", "Plat"], ["climb", "asphalt", "Montée"],
    ["descent", "asphalt", "Descente"], ["flat", "cobbles", "Plat pavé"],
    ["climb", "cobbles", "Montée pavée"], ["descent", "cobbles", "Descente pavée"],
  ] as const)("keeps %s relief visible on %s", (terrain, surface, label) => {
    expect(getRaceSegmentTerrainLabel(segment(terrain, surface))).toBe(label);
  });

  it("shows the signed gradient and leaves flat zero-gradient labels compact", () => {
    expect(formatRaceSegmentOption(segment("climb", "cobbles", 6.25))).toBe("T7 · Montée pavée +6.25 % · 5 km");
    expect(formatRaceSegmentOption(segment("descent", "cobbles", -3.8))).toBe("T7 · Descente pavée -3.8 % · 5 km");
    expect(formatRaceSegmentOption(segment("flat", "cobbles"))).toBe("T7 · Plat pavé · 5 km");
    expect(getRaceSegmentGradientLabel({ averageGradientPct: Number.NaN })).toBe("");
  });

  it("does not hide any of the five cobbled climbs on the Flanders fixture", () => {
    const routes = JSON.parse(readFileSync(new URL("../../scripts/fixtures/s5-cobbled-profile-baseline.json", import.meta.url), "utf8")) as Array<{
      slug: string;
      segments: [number, RaceStageSegment["terrain"], RaceStageSegment["surface"], number][];
    }>;
    const route = routes.find(({ slug }) => slug === "traversee-des-flandres");
    expect(route).toBeDefined();
    const segments = route!.segments.map(([distanceKm, terrain, surface, averageGradientPct], index) => ({
      segmentNumber: index + 1, distanceKm, terrain, surface, averageGradientPct, prime: null,
    }));
    const before = structuredClone(segments);
    const climbs = segments.filter(({ terrain }) => terrain === "climb").map(formatRaceSegmentOption);
    expect(climbs).toHaveLength(5);
    expect(climbs.every(label => label.includes("Montée pavée +"))).toBe(true);
    expect(climbs).toEqual([
      "T3 · Montée pavée +4 % · 8 km", "T7 · Montée pavée +7 % · 6 km",
      "T11 · Montée pavée +9 % · 5 km", "T15 · Montée pavée +6 % · 6 km",
      "T23 · Montée pavée +2.6 % · 10 km",
    ]);
    expect(segments).toEqual(before);
  });
});
