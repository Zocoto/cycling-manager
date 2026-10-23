import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { RaceProfileType } from "./race-calendar";
import { splitRaceSegmentIntoSimulationTicks } from "./race-dynamics";
import type { RaceStageSegment } from "./race-profiles";
import { isUrbanCobbles, normalizeUrbanCobblesSegments } from "./urban-cobbles";

function segment(
  distanceKm: number,
  surface: RaceStageSegment["surface"] = "asphalt",
  extra: Partial<RaceStageSegment> = {},
): RaceStageSegment {
  return {
    segmentNumber: 1,
    distanceKm,
    terrain: "flat",
    averageGradientPct: 0,
    surface,
    prime: null,
    ...extra,
  };
}

function renumber(segments: RaceStageSegment[]) {
  return segments.map((part, index) => ({ ...part, segmentNumber: index + 1 }));
}

function circuit({
  totalKm = 164,
  islandsKm = [3, 3, 3, 3, 4],
  gapsKm = islandsKm.slice(1).map(() => 5),
  runInKm = 0,
}: {
  totalKm?: number;
  islandsKm?: number[];
  gapsKm?: number[];
  runInKm?: number;
} = {}): RaceStageSegment[] {
  const approachKm =
    totalKm -
    islandsKm.reduce((sum, distance) => sum + distance, 0) -
    gapsKm.reduce((sum, distance) => sum + distance, 0) -
    runInKm;
  const segments = [segment(approachKm)];
  for (const [index, distance] of islandsKm.entries()) {
    if (index > 0) segments.push(segment(gapsKm[index - 1]));
    segments.push(segment(distance, "cobbles"));
  }
  if (runInKm > 0) segments.push(segment(runInKm));
  return renumber(segments);
}

function normalize(
  segments: RaceStageSegment[],
  profileType: RaceProfileType = "flat",
  stageType = "road",
) {
  return normalizeUrbanCobblesSegments({ stageType, profileType, segments });
}

function expectUrban(segments: RaceStageSegment[]) {
  const result = normalize(segments);
  expect(result.filter(isUrbanCobbles)).toHaveLength(
    segments.filter((part) => part.surface === "cobbles").length,
  );
  expect(result.some(isUrbanCobbles)).toBe(true);
  return result;
}

function expectOrdinary(segments: RaceStageSegment[]) {
  const result = normalize(segments);
  expect(result.some(isUrbanCobbles)).toBe(false);
  expect(result).toBe(segments);
}

describe("narrow urban cobbles geometry", () => {
  it("recognizes the authored Paris finale without depending on its identity", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260925134500_shape_next_french_gt_champs_elysees_finale.sql"),
      "utf8",
    );
    const segments: RaceStageSegment[] = [
      ...migration.matchAll(
        /\((\d+)::smallint,\s*([\d.]+)::numeric,\s*'(flat|climb|descent)'::text,\s*'(asphalt|cobbles)'::text,\s*(-?[\d.]+)::numeric\)/g,
      ),
    ].map((match) => ({
      segmentNumber: Number(match[1]),
      distanceKm: Number(match[2]),
      terrain: match[3] as RaceStageSegment["terrain"],
      surface: match[4] as RaceStageSegment["surface"],
      averageGradientPct: Number(match[5]),
      prime: null,
    }));
    expect(segments).toHaveLength(18);
    const result = expectUrban(segments);
    expect(result.filter(isUrbanCobbles).map((part) => part.segmentNumber))
      .toEqual([10, 12, 14, 16, 18]);
    expect(result.filter(isUrbanCobbles).every((part) => part.surface === "cobbles"))
      .toBe(true);
  });

  it("also accepts a sprint profile but excludes every other profile", () => {
    const segments = circuit();
    expect(normalize(segments, "sprint").some(isUrbanCobbles)).toBe(true);
    for (const profile of ["cobbles", "hilly", "mountain", "mixed", "time_trial"]) {
      expect(normalize(segments, profile as RaceProfileType)).toBe(segments);
    }
  });

  it.each(["individual_time_trial", "team_time_trial", "prologue", "unknown"])(
    "does not change stage type %s",
    (stageType) => {
      const segments = circuit();
      expect(normalize(segments, "flat", stageType)).toBe(segments);
    },
  );

  it("requires at least one hundred kilometers", () => {
    expectUrban(circuit({ totalKm: 100, islandsKm: [1, 1, 1, 1], gapsKm: [3, 3, 3] }));
    expectOrdinary(circuit({ totalKm: 99.999, islandsKm: [1, 1, 1, 1], gapsKm: [3, 3, 3] }));
  });

  it("accepts four through eight actual cobbled islands, not three or nine", () => {
    expectUrban(circuit({ totalKm: 200, islandsKm: [1, 1, 1, 1] }));
    expectUrban(circuit({ totalKm: 200, islandsKm: Array(8).fill(1) }));
    expectOrdinary(circuit({ totalKm: 200, islandsKm: [1, 1, 1] }));
    expectOrdinary(circuit({ totalKm: 200, islandsKm: Array(9).fill(1) }));
  });

  it("limits each continuous island to four kilometers", () => {
    expectUrban(circuit());
    expectOrdinary(circuit({ islandsKm: [3, 3, 3, 3, 4.001] }));
  });

  it("requires at least three asphalt kilometers between islands", () => {
    expectUrban(circuit({ gapsKm: [3, 5, 5, 5] }));
    expectOrdinary(circuit({ gapsKm: [2.999, 5, 5, 5] }));
  });

  it("requires every cobbled island to begin in the final quarter", () => {
    expectUrban(circuit({ totalKm: 100, islandsKm: [3, 3, 3, 3], gapsKm: [4, 4, 5] }));
    expectOrdinary(circuit({ totalKm: 100, islandsKm: [3, 3, 3, 3], gapsKm: [4.001, 4, 5] }));
  });

  it("requires the last island to end within five kilometers of the finish", () => {
    expectUrban(circuit({ totalKm: 200, runInKm: 5 }));
    expectOrdinary(circuit({ totalKm: 200, runInKm: 5.001 }));
  });

  it("caps total cobbled distance at one eighth of the race", () => {
    expectUrban(circuit({ totalKm: 100, islandsKm: [3.125, 3.125, 3.125, 3.125], gapsKm: [3, 3, 3] }));
    expectOrdinary(circuit({ totalKm: 100, islandsKm: [3.126, 3.125, 3.125, 3.125], gapsKm: [3, 3, 3] }));
  });

  it("caps ascent at five hundred meters", () => {
    const withAscent = (gradient: number) => renumber([
      segment(20, "asphalt", { terrain: "climb", averageGradientPct: gradient }),
      segment(108),
      ...circuit().slice(1),
    ]);
    expectUrban(withAscent(2.5));
    expectOrdinary(withAscent(2.50001));
  });

  it("rejects an ascending gradient above three percent even with little ascent", () => {
    const withClimb = (gradient: number) => renumber([
      segment(1, "asphalt", { terrain: "climb", averageGradientPct: gradient }),
      segment(127),
      ...circuit().slice(1),
    ]);
    expectUrban(withClimb(3));
    expectOrdinary(withClimb(3.001));
  });

  it.each([0.5, -0.5])("accepts a slight cobbled grade of %s percent", (gradient) => {
    const segments = circuit().map((part) =>
      part.surface === "cobbles" ? { ...part, averageGradientPct: gradient } : part,
    );
    expectUrban(segments);
  });

  it.each([0.501, -0.501])("rejects a cobbled grade of %s percent", (gradient) => {
    const segments = circuit().map((part) =>
      part.surface === "cobbles" ? { ...part, averageGradientPct: gradient } : part,
    );
    expectOrdinary(segments);
  });

  it.each(["climb", "descent"] as const)("rejects cobbles labeled as %s", (terrain) => {
    expectOrdinary(circuit().map((part) => part.surface === "cobbles" ? { ...part, terrain } : part));
  });

  it("does not relax a normal cobbled classic or a single long paved finish", () => {
    expectOrdinary(renumber([segment(120), segment(25, "cobbles"), segment(19)]));
    expectOrdinary(renumber([segment(160), segment(4, "cobbles")]));
  });

  it("is unchanged when every authored segment is divided in two", () => {
    const original = circuit();
    const split = renumber(original.flatMap((part) => [
      { ...part, distanceKm: part.distanceKm / 2 },
      { ...part, distanceKm: part.distanceKm / 2 },
    ]));
    expectUrban(original);
    expectUrban(split);
    expect(normalize(split).filter(isUrbanCobbles).reduce((sum, part) => sum + part.distanceKm, 0))
      .toBe(16);
  });

  it("cannot disguise a long island by dividing it into small adjacent sectors", () => {
    const segments = renumber(circuit({ islandsKm: [3, 3, 3, 3, 5] }).flatMap((part) =>
      part.surface === "cobbles" ? [
        { ...part, distanceKm: part.distanceKm / 2 },
        { ...part, distanceKm: part.distanceKm / 2 },
      ] : [part],
    ));
    expectOrdinary(segments);
  });
});

describe("urban normalization safety", () => {
  it("does not mutate input and only replaces the annotated cobbled segments", () => {
    const segments = circuit();
    const original = structuredClone(segments);
    for (const part of segments) Object.freeze(part);
    Object.freeze(segments);
    const normalized = expectUrban(segments);
    expect(segments).toEqual(original);
    expect(normalized).not.toBe(segments);
    normalized.forEach((part, index) => {
      if (part.surface === "cobbles") expect(part).not.toBe(segments[index]);
      else expect(part).toBe(segments[index]);
    });
  });

  it("returns the original normalized array when run twice", () => {
    const once = normalize(circuit());
    expect(normalize(once)).toBe(once);
  });

  it("keeps ordinary route identity including an empty route", () => {
    expectOrdinary([]);
    expectOrdinary([segment(164)]);
  });

  it("removes forged annotations from an ineligible route or non-road race", () => {
    const segments = circuit().map((part) => ({ ...part, cobblesStyle: "urban" as const }));
    const invalid = normalize(segments, "cobbles");
    expect(invalid.every((part) => part.cobblesStyle === undefined)).toBe(true);
    expect(segments.every((part) => part.cobblesStyle === "urban")).toBe(true);
    expect(normalize(invalid, "cobbles")).toBe(invalid);
    expect(normalize(segments, "flat", "team_time_trial").some(isUrbanCobbles)).toBe(false);
  });

  it("removes annotations on asphalt but retains correct derived urban tags", () => {
    const segments = normalize(circuit());
    const forged = segments.map((part) => part.surface === "asphalt" ? { ...part, cobblesStyle: "urban" as const } : part);
    const result = normalize(forged);
    expect(result).toEqual(segments);
    result.forEach((part, index) => {
      if (part.surface === "cobbles") expect(part).toBe(forged[index]);
    });
  });

  it("does not let an unknown annotation classify a bad route", () => {
    const part = { ...segment(164, "cobbles"), cobblesStyle: "rough" } as unknown as RaceStageSegment;
    const result = normalize([part]);
    expect(result[0].cobblesStyle).toBeUndefined();
    expect(isUrbanCobbles(part)).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1])("rejects invalid distance %s and strips supplied tags", (distanceKm) => {
    const segments = normalize(circuit()).map((part, index) => index === 0 ? { ...part, distanceKm } : part);
    const result = normalize(segments);
    expect(result.some(isUrbanCobbles)).toBe(false);
    expect(result.every((part) => part.cobblesStyle === undefined)).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity])("rejects invalid gradient %s", (averageGradientPct) => {
    const segments = circuit().map((part, index) => index === 0 ? { ...part, averageGradientPct } : part);
    expectOrdinary(segments);
  });

  it("rejects an unknown terrain or surface at runtime", () => {
    for (const extra of [{ terrain: "unknown" }, { surface: "gravel" }]) {
      const segments = circuit().map((part, index) => index === 0 ? { ...part, ...extra } as RaceStageSegment : part);
      expectOrdinary(segments);
    }
  });

  it("carries the derived annotation through physical ticks without changing the surface", () => {
    const part = normalize(circuit()).find(isUrbanCobbles)!;
    const ticks = splitRaceSegmentIntoSimulationTicks(part);
    expect(ticks.every(isUrbanCobbles)).toBe(true);
    expect(ticks.every((tick) => tick.surface === "cobbles")).toBe(true);
    expect(ticks.reduce((sum, tick) => sum + tick.distanceKm, 0)).toBe(part.distanceKm);
  });

  it("does not identify forged urban tags on asphalt, hills or invalid segments", () => {
    const urban = { ...segment(3, "cobbles"), cobblesStyle: "urban" as const };
    expect(isUrbanCobbles(urban)).toBe(true);
    expect(isUrbanCobbles({ ...urban, surface: "asphalt" })).toBe(false);
    expect(isUrbanCobbles({ ...urban, terrain: "climb" })).toBe(false);
    expect(isUrbanCobbles({ ...urban, averageGradientPct: 1 })).toBe(false);
    expect(isUrbanCobbles({ ...urban, distanceKm: 5 })).toBe(false);
    expect(isUrbanCobbles({ ...urban, distanceKm: NaN })).toBe(false);
  });
});
