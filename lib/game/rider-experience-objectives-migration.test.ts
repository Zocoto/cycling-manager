import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260822120000_add_rider_experience_objectives.sql",
  ),
  "utf8",
);

describe("rider experience objectives migration", () => {
  it("adds the three 25, 50 and 100 experience milestones", () => {
    expect(migration).toContain("'rider_experience_25'");
    expect(migration).toContain("'rider_experience_50'");
    expect(migration).toContain("'rider_experience_100'");
    expect(migration).toContain("'highest_active_rider_experience', 25");
    expect(migration).toContain("'highest_active_rider_experience', 50");
    expect(migration).toContain("'highest_active_rider_experience', 100");
  });

  it("uses the same 0.2 point per race day scale as rider profiles", () => {
    expect(migration).toContain(
      "floor(greatest(0, rider.career_race_days)::numeric / 5)",
    );
    expect(migration).toContain(
      "floor(greatest(0, academy.career_race_days)::numeric / 5)",
    );
    expect(migration.match(/least\(\s*100,/g)).toHaveLength(2);
  });

  it("counts active professionals and academy riders from the current team", () => {
    expect(migration).toContain("contract.team_id = p_current_team_id");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("academy.team_id = p_current_team_id");
    expect(migration).toContain("academy.status in ('active', 'recruited')");
  });

  it("keeps the rewards progressive and reserves the item for 100 experience", () => {
    expect(migration).toContain("7500, 25, 1, null, null, false, 230, true");
    expect(migration).toContain("20000, 70, 2, null, null, false, 240, true");
    expect(migration).toContain(
      "60000, 180, 6, 'potential-spark', null, false, 250, true",
    );
  });

  it("extends the current metric function and upserts definitions idempotently", () => {
    expect(migration).toContain(
      "rename to calculate_game_objective_progress_pre_rider_experience",
    );
    expect(migration).toContain(
      "return public.calculate_game_objective_progress_pre_rider_experience(",
    );
    expect(migration).toContain("on conflict (objective_key) do update set");
    expect(migration).not.toMatch(
      /(?:update|delete\s+from)\s+public\.game_objective_claims/i,
    );
  });
});
