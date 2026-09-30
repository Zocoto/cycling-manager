import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260930190000_allow_team_time_trial_collective_strategy.sql",
);
const federationAction = read("app/jeu/federations/equipment-actions.ts");

describe("team time-trial collective strategy guard", () => {
  it("allows collective roles on a team time trial but not on an individual one", () => {
    const guard = migration.slice(
      migration.indexOf("create or replace function public.reject_time_trial_race_preparation"),
      migration.indexOf("revoke all on function public.reject_time_trial_race_preparation"),
    );

    expect(guard).toContain(
      "if v_stage_type in ('individual_time_trial', 'prologue') then",
    );
    expect(guard).not.toContain(
      "'individual_time_trial', 'team_time_trial', 'prologue'",
    );
    expect(guard).toContain("not coalesce(v_is_federation_registration, false)");
  });

  it("saves federation TTT roles, strategy and relay plans atomically", () => {
    expect(migration).toContain("p_roles jsonb");
    expect(migration).toContain("p_strategy jsonb");
    expect(migration).toContain("save_national_federation_race_preparation(");
    expect(migration).toMatch(
      /save_national_federation_time_trial_preparation\(\s+p_country_code/,
    );
    expect(federationAction).toContain("p_roles: roles");
    expect(federationAction).toContain("p_strategy: {");
  });
});
