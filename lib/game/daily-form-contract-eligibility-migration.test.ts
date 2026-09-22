import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260922100000_prevent_retroactive_daily_form_recovery.sql",
  ),
  "utf8",
).toLowerCase();

describe("daily form contract eligibility migration", () => {
  it("resolves the team from the exact contract interval", () => {
    expect(migration).toContain(
      "create or replace function public.get_rider_contract_team_for_day",
    );
    expect(migration).toContain(
      "day.day_number >= coalesce(contract.joined_day_number, 1)",
    );
    expect(migration).toContain(
      "day.day_number <= coalesce(contract.left_day_number, 28)",
    );
    expect(migration).toContain(
      "contract.status in ('active', 'completed', 'terminated')",
    );
  });

  it("guards every daily form write and skips ineligible settlement rows", () => {
    expect(migration).toContain(
      "create trigger aa_enforce_daily_condition_contract_eligibility",
    );
    expect(migration).toContain(
      "public.get_rider_contract_team_for_day(rider.id, v_day.id) is not null",
    );
  });

  it("uses the historical team for nutrition and recovery bonuses", () => {
    expect(migration).toContain(
      "v_team_id := public.get_rider_contract_team_for_day",
    );
    expect(migration).toContain(
      "select rider.id, contract_day.team_id",
    );
    expect(migration).toContain(
      "public.get_rider_contract_team_for_day(current_rest.rider_id, v_day.id) = v_team.team_id",
    );
  });

  it("backs up, removes and replays the corrupted active-season history", () => {
    expect(migration).toContain(
      "create table if not exists public.rider_form_contract_repairs",
    );
    expect(migration).toContain("retroactive_daily_effects");
    expect(migration).toContain("retroactive_nutrition_effects");
    expect(migration).toContain("replaced_condition_states");
    expect(migration).toContain(
      "delete from public.rider_daily_condition_effects as effect",
    );
    expect(migration).toContain(
      "delete from public.rider_daily_nutrition_effects as effect",
    );
    expect(migration).toContain(
      "and effect.effect_type <> 'training'",
    );
  });
});
