import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921120000_create_team_roster_management_center.sql",
  ),
  "utf8",
);

describe("roster management center migration", () => {
  it("registers the building, its progressive tariff and its construction flow", () => {
    expect(migration).toContain("'roster_management_center'");
    expect(migration).toContain(
      "array[600000, 1100000, 1800000, 2800000, 4200000]",
    );
    expect(migration).toContain("array[7, 12, 18, 24, 30]");
    expect(migration).toContain("Pôle de gestion sportive");
  });

  it("uses dynamic roster limits in every recruitment guard", () => {
    expect(migration).toContain(
      "select 35 + public.get_team_roster_management_level(p_team_id) * 5",
    );
    expect(migration).toContain("public.can_team_reserve_roster_rider(");
    expect(migration).toContain(
      "public.get_team_roster_limit(candidate.team_id)",
    );
    expect(migration).toContain(
      "public.get_team_roster_base_limit(new.team_id)",
    );
  });

  it("keeps youth places unavailable to external recruitment", () => {
    expect(migration).toContain("public.is_team_homegrown_rider");
    expect(migration).toContain(
      "v_non_homegrown + 1 <= public.get_team_roster_base_limit(p_team_id)",
    );
    expect(migration).toContain(
      "acquisition_type is distinct from 'academy'",
    );
  });

  it("applies only future renewal and two-day rotation bonuses", () => {
    expect(migration).toContain("new.acquisition_type <> 'renewal'");
    expect(migration).toContain(
      "roster_management_salary_before_discount",
    );
    expect(migration).toContain("previous_rest.effect_type = 'rest'");
    expect(migration).toContain("roster_rotation_bonus");
    expect(migration).toContain(
      "on conflict (rider_id, season_day_id) do update",
    );
  });
});
