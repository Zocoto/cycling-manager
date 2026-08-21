import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260821230000_add_mechanic_wheel_interchangeability.sql",
  ),
  "utf8",
);

describe("mechanic wheel interchangeability migration", () => {
  it("registers the talent and enforces its four-star minimum", () => {
    expect(migration).toContain("'mechanic_wheel_interchangeability'");
    expect(migration).toContain("'Roues interchangeables'");
    expect(migration).toContain("minimum_level = excluded.minimum_level");
    expect(migration).toContain("v_member_level < v_talent_minimum_level");
    expect(migration).toContain("member.level >= 4");
  });

  it("allows only the two wheel slots to cross for an eligible team", () => {
    expect(migration).toContain(
      "public.team_has_mechanic_wheel_interchangeability(p_team_id)",
    );
    expect(migration).toContain(
      "p_target_slot = 'front_wheel' and p_item_slot = 'rear_wheel'",
    );
    expect(migration).toContain(
      "p_target_slot = 'rear_wheel' and p_item_slot = 'front_wheel'",
    );
  });

  it("protects permanent, pending, bulk and race-specific assignments", () => {
    expect(migration).toContain("public.enforce_equipment_assignment_slot()");
    expect(migration).toContain(
      "public.enforce_race_stage_equipment_assignment()",
    );
    expect(migration).toContain(
      "public.equip_current_team_rider(uuid,text,uuid)",
    );
    expect(migration).toContain(
      "public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)",
    );
    expect(migration).toContain("equipment_slots_are_compatible");
  });
});
