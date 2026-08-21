import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260821231000_cleanup_ineligible_cross_wheel_assignments.sql",
  ),
  "utf8",
);

describe("mechanic cross-wheel cleanup migration", () => {
  it("returns cross-mounted wheels when the last eligible mechanic leaves", () => {
    expect(migration).toContain(
      "public.cleanup_ineligible_cross_wheel_assignments",
    );
    expect(migration).toContain(
      "public.team_has_mechanic_wheel_interchangeability(p_team_id)",
    );
    expect(migration).toContain(
      "cleanup_cross_wheels_after_staff_contract_change",
    );
  });

  it("cleans permanent, pending and race-specific cross mounts", () => {
    expect(migration).toContain(
      "delete from public.rider_equipment_assignments",
    );
    expect(migration).toContain(
      "delete from public.rider_equipment_pending_assignments",
    );
    expect(migration).toContain(
      "delete from public.race_stage_equipment_assignments",
    );
  });

  it("also reacts if the talent, role or staff level changes", () => {
    expect(migration).toContain(
      "cleanup_cross_wheels_after_staff_talent_change",
    );
    expect(migration).toContain(
      "cleanup_cross_wheels_after_staff_member_change",
    );
    expect(migration).toContain("after update of role, level");
  });
});
