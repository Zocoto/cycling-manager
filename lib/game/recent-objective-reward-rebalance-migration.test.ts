import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813100000_rebalance_recent_objective_rewards.sql",
  ),
  "utf8",
);

describe("recent objective reward rebalance", () => {
  it("rebalances every objective introduced in the two latest pools", () => {
    const rewardRows = migration.match(/^\s*\('[a-z0-9_]+', \d+::numeric/gm);

    expect(rewardRows).toHaveLength(62);
    expect(migration).toContain("'development_first_registration'");
    expect(migration).toContain("'development_double_world_title'");
    expect(migration).toContain("'infrastructure_first_performance'");
    expect(migration).toContain("'championship_triple_crown'");
  });

  it("makes the easy nationality milestones symbolic", () => {
    expect(migration).toContain(
      "('roster_countries_5', 2000::numeric, 10, 0::numeric, null::text, false)",
    );
    expect(migration).toContain(
      "('roster_countries_10', 7500::numeric, 30, 1::numeric, null::text, false)",
    );
    expect(migration).toContain(
      "('roster_continents_3', 3000::numeric, 12, 0::numeric, null::text, false)",
    );
  });

  it("keeps the Atlas trophy but removes its oversized stacked rewards", () => {
    expect(migration).toContain(
      "('roster_all_continents', 30000::numeric, 100, 3::numeric, null::text, false)",
    );

    // Trophy ownership is still driven by the existing claim trigger. This
    // corrective migration only changes the reward definition.
    expect(migration).not.toContain("delete from public.sporting_director_trophies");
    expect(migration).not.toContain("update public.sporting_director_trophies");
  });

  it("does not claw back rewards that were already claimed", () => {
    expect(migration).not.toMatch(/(?:update|delete\s+from)\s+public\.game_objective_claims/i);
    expect(migration).not.toMatch(/(?:update|delete\s+from)\s+public\.sporting_directors/i);
    expect(migration).not.toMatch(/(?:update|delete\s+from)\s+public\.team_finances/i);
  });

  it("reserves rare random abilities for genuinely long-term objectives", () => {
    const randomAbilityRows = migration.match(
      /^\s*\('[a-z0-9_]+', \d+::numeric, \d+, \d+::numeric, null::text, true\)/gm,
    );

    expect(randomAbilityRows).toHaveLength(2);
    expect(randomAbilityRows?.join("\n")).toContain(
      "development_double_world_title",
    );
    expect(randomAbilityRows?.join("\n")).toContain("referral_qualified_25");
  });
});
