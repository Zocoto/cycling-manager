import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260808160000_add_stage_specific_race_roles.sql"
  ),
  "utf8"
);

describe("stage-specific race roles migration", () => {
  it("attaches every override to a registered rider and one stage", () => {
    expect(migration).toContain("create table public.race_roster_stage_roles");
    expect(migration).toContain(
      "foreign key (race_registration_id, rider_id)"
    );
    expect(migration).toContain(
      "primary key (race_registration_id, rider_id, stage_id)"
    );
    expect(migration).toContain("race_roster_stage_roles_scope_guard");
    expect(migration).toContain("race_roster_stage_roles_one_leader_idx");
    expect(migration).toContain("race_roster_stage_roles_one_sprinter_idx");
    expect(migration).toContain(
      "v_registration_edition_id is distinct from v_stage_edition_id"
    );
  });

  it("keeps the general role as fallback and exposes only the current team", () => {
    expect(migration).toContain(
      "create function public.get_current_team_stage_role_plan"
    );
    expect(migration).toContain("roster.race_role");
    expect(migration).toContain(
      "left join public.race_roster_stage_roles as stage_role"
    );
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toMatch(/security definer\r?\nset search_path = ''/);
  });

  it("locks a started or officially simulated stage", () => {
    expect(migration).toContain(
      "v_departure_at <= clock_timestamp()"
    );
    expect(migration).toContain(
      "from public.official_stage_simulations as simulation"
    );
    expect(migration).toContain(
      "Les nouveaux rôles s appliquent à une étape suivante."
    );
  });

  it("requires the complete active roster and unique protected roles", () => {
    expect(migration).toContain(
      "Le plan doit couvrir exactement les coureurs encore engagés."
    );
    expect(migration).toContain(
      "Un seul leader et un seul sprinteur peuvent être désignés par étape."
    );
    expect(migration).toContain(
      "grant execute on function public.save_current_team_stage_role_plan"
    );
  });
});
