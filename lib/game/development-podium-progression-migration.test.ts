import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260822100000_add_development_podium_progression.sql",
  "utf8",
);

describe("development podium progression migration", () => {
  it("keeps every SQL dollar-quoted block balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("rewards only real riders on the final podium", () => {
    expect(migration).toContain("new.result_scope <> 'general'");
    expect(migration).toContain("new.rank not between 1 and 3");
    expect(migration).toContain("new.academy_rider_id is null");
    expect(migration).toMatch(
      /create trigger development_result_awards_podium_progression\r?\nafter insert\r?\non public\.development_race_results/,
    );
  });

  it("makes each race and rider reward idempotent", () => {
    expect(migration).toContain(
      "unique (race_edition_id, academy_rider_id)",
    );
    expect(migration).toContain(
      "on conflict (race_edition_id, academy_rider_id) do nothing",
    );
    expect(migration).toContain("if v_reward_id is null then");
  });

  it("uses the agreed place and high-rating reductions", () => {
    expect(migration).toContain("when 1 then 1.00");
    expect(migration).toContain("when 2 then 0.60");
    expect(migration).toContain("when 3 then 0.35");
    expect(migration).toContain("when p_projected_rating < 70 then 1.00");
    expect(migration).toContain("when p_projected_rating < 74 then 0.65");
    expect(migration).toContain("when p_projected_rating < 77 then 0.40");
    expect(migration).toContain("else 0.25");
  });

  it("awards the main profile stat and linked secondary stats", () => {
    expect(migration).toContain("('mountain', 'mountain', 1.00, true)");
    expect(migration).toContain("('mountain', 'recovery', 0.18, false)");
    expect(migration).toContain("('cobbles', 'flat', 0.19, false)");
    expect(migration).toContain(
      "('time_trial', 'prologue', 0.16, false)",
    );
    expect(migration).toContain("('mixed', 'endurance', 1.00, true)");
    expect(migration).toContain("projected_rating_changes = v_projected_changes");
    expect(migration).toContain("time_trial = least(8.25");
  });
});
