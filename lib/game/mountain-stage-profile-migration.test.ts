import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260916141000_make_future_mountain_courses_sustained_climbs.sql",
  ),
  "utf8",
);
const originalGrandTours = readFileSync(
  join(process.cwd(), "supabase/migrations/20260904015000_rebalance_future_grand_tours.sql"),
  "utf8",
);

describe("planned mountain course reshaping", () => {
  it("leaves started and simulated stages unchanged", () => {
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain("stage.departure_at > now() + interval '48 hours'");
    expect(migration).toContain("season.status = 'planned'");
    expect(migration).toContain("public.stage_results as result");
    expect(migration).toContain("public.official_stage_simulations as simulation");
  });

  it("uses sustained climbs, a summit finish and matching classifications", () => {
    expect(migration).toContain("previous_ascent_m >= 4800");
    expect(migration).toContain("final_climb_start");
    expect(migration).toContain("previous_distance_km - 1");
    expect(migration).toContain("previous_summit_m + 250 - finish_m");
    expect(migration).toContain("race_format = 'stage_race'");
    expect(migration).toContain("prime.prime_type in ('mountain', 'intermediate_sprint')");
    expect(migration).toContain("target.had_intermediate_sprint");
  });

  it.each([
    "gt-medium-mountain-a-186",
    "gt-medium-mountain-b-184",
    "gt-high-mountain-a-180",
    "gt-high-mountain-b-186",
  ])("keeps the %s summit climb near the intended length", (shapeCode) => {
    const source = originalGrandTours.slice(
      originalGrandTours.indexOf(`('${shapeCode}'`),
    );
    const encoded = source.match(/'(\[[^\n]+\])'/)?.[1];
    if (!encoded) throw new Error(`Missing ${shapeCode} profile`);

    const segments = JSON.parse(encoded) as Array<{
      d: number;
      t: "flat" | "climb" | "descent";
      g?: number;
    }>;
    const total = segments.reduce((sum, segment) => sum + segment.d, 0);
    const previousAscent = segments.reduce(
      (sum, segment) => sum + Math.max(0, segment.g ?? 0) * segment.d * 10,
      0,
    );
    const high = previousAscent >= 4_800 && segments.length >= 10;
    const desired = high
      ? Math.min(45, Math.max(30, total * 0.24))
      : Math.min(40, Math.max(25, total * 0.22));
    const candidates = segments.slice(1).map((segment, index) => ({
      index: index + 1,
      tail: segments.slice(index + 1).reduce((sum, part) => sum + part.d, 0),
      distance: segment.d,
      previousDistance: segments[index].d,
    }));
    candidates.sort(
      (left, right) =>
        Math.abs(left.tail - desired) - Math.abs(right.tail - desired) ||
        right.index - left.index,
    );
    const boundary = candidates[0];
    const shift = boundary.tail >= desired
      ? Math.min(boundary.tail - desired, Math.max(0, boundary.distance - 1))
      : -Math.min(desired - boundary.tail, Math.max(0, boundary.previousDistance - 1));
    segments[boundary.index].d -= shift;
    segments[boundary.index - 1].d += shift;

    const terrain = segments.map((_, index) => {
      const number = index + 1;
      const count = segments.length;
      if (index >= boundary.index) return "climb";
      if (index === boundary.index - 1) return "flat";
      if (high) {
        if (number <= Math.max(1, Math.floor(count * 0.12))) return "flat";
        if (number <= Math.max(2, Math.floor(count * 0.30))) return "climb";
        if (number <= Math.max(3, Math.floor(count * 0.42))) return "descent";
        if (number <= Math.max(4, Math.floor(count * 0.49))) return "flat";
        if (number <= Math.max(5, Math.floor(count * 0.64))) return "climb";
        if (number <= Math.max(6, Math.floor(count * 0.70))) return "descent";
        return "flat";
      }
      if (number <= Math.max(1, Math.floor(count * 0.20))) return "flat";
      if (number <= Math.max(2, Math.floor(count * 0.39))) return "climb";
      if (number <= Math.max(3, Math.floor(count * 0.52))) return "descent";
      return "flat";
    });
    const finalClimbKm = segments.slice(boundary.index).reduce(
      (sum, segment) => sum + segment.d,
      0,
    );
    const climbCount = terrain.filter(
      (current, index) => current === "climb" && terrain[index - 1] !== "climb",
    ).length;

    expect(total).toBeCloseTo(segments.reduce((sum, segment) => sum + segment.d, 0));
    expect(finalClimbKm).toBeGreaterThanOrEqual(25);
    expect(finalClimbKm).toBeLessThanOrEqual(46);
    expect(climbCount).toBe(high ? 3 : 2);
    expect(terrain.at(-1)).toBe("climb");
  });
});
