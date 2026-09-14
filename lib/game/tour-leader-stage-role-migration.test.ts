import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260914130000_lock_declared_leader_for_entire_stage_race.sql",
  ),
  "utf8",
);

describe("declared tour leader database invariant", () => {
  it("normalizes contradictory future stage overrides after registration changes", () => {
    expect(migration).toContain(
      "create function public.normalize_declared_tour_leader_stage_roles",
    );
    expect(migration).toContain("stage_role.rider_id = v_leader_rider_id");
    expect(migration).toContain("stage_role.race_role = 'leader'");
    expect(migration).toContain("stage.status = 'planned'");
    expect(migration).toContain(
      "create trigger race_rosters_sync_declared_tour_leader",
    );
  });

  it("rejects any stage plan that replaces the available declared leader", () => {
    expect(migration).toContain(
      "create function public.enforce_declared_tour_leader_stage_role",
    );
    expect(migration).toContain(
      "new.rider_id = v_leader_rider_id\n    and new.race_role is distinct from 'leader'",
    );
    expect(migration).toContain(
      "new.rider_id <> v_leader_rider_id\n    and new.race_role = 'leader'",
    );
    expect(migration).toContain(
      "create trigger race_roster_stage_roles_lock_declared_tour_leader",
    );
  });

  it("keeps chronos and an unavailable leader outside the stage-role lock", () => {
    expect(migration).toContain("v_stage_type is distinct from 'road'");
    expect(migration).toContain("public.stage_rider_unavailabilities");
  });
});
