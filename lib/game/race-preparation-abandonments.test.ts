import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const migrationPath = path.join(
  projectRoot,
  "supabase",
  "migrations",
  "20260827130000_exclude_unavailable_riders_from_race_preparation.sql",
);

describe("race preparation after a withdrawal", () => {
  it("uses the sporting unavailability ledger for every preparation RPC", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");

    expect(migration).toContain("public.get_current_team_race_preparation()");
    expect(migration).toContain(
      "public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)",
    );
    expect(migration).toContain(
      "public.save_current_team_time_trial_preparation(uuid,uuid,jsonb)",
    );
    expect(migration).toContain(
      "public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)",
    );
    expect(migration).toContain("public.stage_rider_unavailabilities");
    expect(migration).toContain(
      "unavailable.race_edition_id = p_race_edition_id",
    );
    expect(migration).toContain(
      "unavailable.rider_id = roster.rider_id",
    );
    expect(migration).toContain(
      "stage_rider_unavailabilities_edition_rider_idx",
    );
    expect(migration).toContain("v_available_unqualified_roster_filter");
  });

  it("removes stale tactics assigned to riders no longer displayed", () => {
    const service = fs.readFileSync(
      path.join(projectRoot, "services", "race-calendar.ts"),
      "utf8",
    );

    expect(service).toContain("const availableRiderIds = new Set(");
    expect(service).toContain("stagePlan.lieutenantRiderId = null");
    expect(service).toContain("stagePlan.dangerPacerRiderId = null");
    expect(service).toContain("stagePlan.protectorRiderId = null");
    expect(service).toContain("stagePlan.breakawayRiderId = null");
    expect(service).toContain(
      "stagePlan.attackOrders = stagePlan.attackOrders.filter",
    );
  });
});
