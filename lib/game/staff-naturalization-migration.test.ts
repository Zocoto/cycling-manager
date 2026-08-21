import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260821235500_add_staff_naturalization_and_rebalance_infrastructures.sql",
  ),
  "utf8",
);

describe("staff naturalization and infrastructure rebalance migration", () => {
  it("enforces the seasonal staff quota from welcome-center level", () => {
    expect(migration).toContain("create table public.staff_naturalizations");
    expect(migration).toContain(
      "create or replace function public.naturalize_current_team_staff",
    );
    expect(migration).toContain(
      "v_limit := least(5, greatest(0, v_welcome_center_level))",
    );
    expect(migration).toContain("if v_used >= v_limit then");
    expect(migration).toContain("update public.staff_members");
    expect(migration).toContain("to authenticated");
  });

  it("enforces manager thresholds and cheaper proportional upgrades server-side", () => {
    expect(migration).toContain(
      "v_required_director_level := least(v_target_level, 5) * 10",
    );
    expect(migration).toContain("when 2 then 0.6");
    expect(migration).toContain("when 3 then 0.7");
    expect(migration).toContain("when 4 then 0.8");
    expect(migration).toContain("else 0.9");
    expect(migration).toContain(
      "public.assert_team_infrastructure_construction_slot",
    );
  });
});
