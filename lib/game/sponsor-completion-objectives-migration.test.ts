import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260825123000_add_sponsor_completion_objectives.sql",
  ),
  "utf8",
);

describe("sponsor completion objectives migration", () => {
  it("adds four cumulative sponsor milestones", () => {
    for (const target of [1, 5, 10, 25]) {
      expect(migration).toContain(`'sponsor_objective_${target}'`);
      expect(migration).toContain(`'completed_sponsor_objectives', ${target}`);
    }
  });

  it("counts achieved objectives across every team managed by the director", () => {
    expect(migration).toContain("progress.status = 'achieved'");
    expect(migration).toContain(
      "assignment.sporting_director_id = p_director_id",
    );
    expect(migration).toContain("assignment.role = 'general_manager'");
    expect(migration).toContain("count(distinct progress.id)");
  });

  it("keeps the cumulative metric cheap", () => {
    expect(migration).toContain(
      "create index if not exists objective_progress_achieved_contract_idx",
    );
    expect(migration).toContain("where status = 'achieved'");
  });

  it("uses progressive rewards", () => {
    expect(migration).toContain("3000, 15, 0, null, null, false, 920, true");
    expect(migration).toContain("10000, 45, 1, null, null, false, 930, true");
    expect(migration).toContain("25000, 100, 2, null, null, true, 940, true");
    expect(migration).toContain(
      "60000, 220, 5, 'potential-spark', null, false, 950, true",
    );
  });

  it("extends the current metric function and upserts without touching claims", () => {
    expect(migration).toContain(
      "rename to calculate_game_objective_progress_pre_sponsor_completion",
    );
    expect(migration).toContain(
      "return public.calculate_game_objective_progress_pre_sponsor_completion(",
    );
    expect(migration).toContain("on conflict (objective_key) do update set");
    expect(migration).not.toMatch(
      /(?:update|delete\s+from)\s+public\.game_objective_claims/i,
    );
  });
});
