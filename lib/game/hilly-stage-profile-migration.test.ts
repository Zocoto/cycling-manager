import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260920202000_reshape_future_hilly_finishes.sql",
  ),
  "utf8",
);

describe("planned hilly finish reshaping", () => {
  it("leaves started and locked stages unchanged", () => {
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain("stage.departure_at > now() + interval '48 hours'");
    expect(migration).toContain("season.status = 'planned'");
    expect(migration).toContain("public.stage_results as result");
    expect(migration).toContain("public.official_stage_simulations as simulation");
  });

  it("creates deterministic puncher finishes without changing the distance", () => {
    expect(migration).toContain("mod(eligible.shape_seed, 4) < 3");
    expect(migration).toContain("then 4 + mod(eligible.shape_seed, 5)");
    expect(migration).toContain("else 6 + mod(eligible.shape_seed, 5)");
    expect(migration).toContain("finish_distance_km - previous_finish_distance_km");
    expect(migration).toContain("finish.distance_km not between 4 and 8");
    expect(migration).toContain("finish.distance_km not between 4 and 10");
  });

  it("moves the mountain prize to the rewritten decisive hill", () => {
    expect(migration).toContain("prime.prime_type = 'mountain'");
    expect(migration).toContain("target.race_format = 'stage_race'");
    expect(migration).toContain("array[2, 1]::smallint[]");
  });
});
