import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820210000_scope_race_conflicts_to_half_day_slots.sql",
  ),
  "utf8",
);

describe("conflits d'inscription par créneau", () => {
  it("aligne toutes les voies d'inscription sur le jour et le créneau", () => {
    for (const signature of [
      "save_current_team_race_roster(uuid,uuid[])",
      "complete_current_team_underfilled_race_roster(uuid,jsonb)",
      "prioritize_national_championship_rider(uuid,uuid)",
      "prioritize_international_championship_rider_base(uuid,uuid)",
      "get_current_team_race_roster_options_before_reconnaissance(uuid)",
      "get_current_team_race_roster_options(uuid)",
    ]) {
      expect(migration).toContain(signature);
    }

    expect(migration).toContain(
      "other_stage.day_slot = target_stage.day_slot",
    );
    expect(migration).toContain(
      "target_stage.day_slot = other_stage.day_slot",
    );
  });

  it("conserve le verrou transactionnel et les inscriptions en attente", () => {
    const trigger = migration.slice(
      migration.indexOf(
        "create or replace function public.enforce_pending_race_roster_conflicts",
      ),
    );

    expect(trigger).toContain("pg_advisory_xact_lock");
    expect(trigger).toContain(
      "other_registration.status in ('accepted', 'pending')",
    );
    expect(trigger).toContain(
      "other_stage.season_day_id = target_stage.season_day_id",
    );
    expect(trigger).toContain(
      "other_stage.day_slot = target_stage.day_slot",
    );
  });

  it("n'utilise plus d'exception de championnat au verrou final", () => {
    const trigger = migration.slice(
      migration.indexOf(
        "create or replace function public.enforce_pending_race_roster_conflicts",
      ),
      migration.indexOf(
        "comment on function public.enforce_pending_race_roster_conflicts",
      ),
    );

    expect(trigger).not.toContain("v_target_competition_type");
    expect(trigger).not.toContain("national_time_trial");
    expect(trigger).not.toContain("world_championship");
  });
});
