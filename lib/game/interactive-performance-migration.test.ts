import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260926123000_remove_interactive_lock_hotspots.sql",
  ),
  "utf8",
).toLocaleLowerCase("en-US");

describe("interactive performance migration", () => {
  it("ne réécrit la journée active que lorsqu’elle change", () => {
    expect(migration).toContain(
      "season.current_day_number is distinct from v_target_day",
    );
    expect(migration).toContain("set lock_timeout = '2s'");
  });

  it.each([
    "save_current_rider_training_plans(jsonb)",
    "save_current_youth_training_settings_bulk(jsonb)",
    "save_current_team_equipment_assignments(jsonb)",
    "apply_current_team_nutrition_interventions(jsonb)",
  ])("borne les validations groupées atomiques : %s", (signature) => {
    expect(migration).toContain(`alter function public.${signature}`);
  });

  it("sérialise le recalcul junior et agrège une équipe par clé", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "group by grouped.entity_key, grouped.development_team_id",
    );
    expect(migration).not.toContain(
      "group by grouped.entity_key, grouped.development_team_id, grouped.display_name",
    );
  });
});
