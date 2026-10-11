import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011133000_enforce_training_potential_stat_caps.sql", import.meta.url),
  "utf8",
);

describe("prospective training potential cap migration", () => {
  it("patches all SQL training paths, with guarded idempotent replacements", () => {
    expect(migration).toContain("public.settle_due_training_sessions()");
    expect(migration).toContain("public.settle_due_free_agent_training(integer)");
    expect(migration).toContain("public.complete_current_youth_training_attempt(uuid,integer)");
    expect(migration).toContain("potential_stat_cap_v1");
    expect(migration).toContain("Unexpected potential guard");
    expect(migration).toContain("v_cap || ' - v_stat.current_rating'");
  });

  it("does not rewrite ratings or add a global constraint that would block items", () => {
    expect(migration).not.toMatch(/update\s+public\.(rider_season_ratings|youth_academy_riders)/i);
    expect(migration).not.toMatch(/create\s+trigger|add\s+constraint/i);
    expect(migration).not.toContain("use_current_team_inventory_item");
    expect(migration).toContain("greatest(p_current_raw, least(");
    expect(migration).toContain("set local lock_timeout = '5s'");
    expect(migration).toContain("set local statement_timeout = '8s'");
  });
});
