import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260910120000_add_protected_rider_race_role.sql",
  ),
  "utf8",
);

describe("migration du rôle coureur protégé", () => {
  it("autorise le rôle dans les compositions générales et par étape", () => {
    expect(migration).toContain("alter table public.race_rosters");
    expect(migration).toContain(
      "alter table public.race_roster_stage_roles",
    );
    expect(migration.match(/'protected_rider'/g)?.length).toBeGreaterThan(8);
  });

  it("limite le rôle à un coureur par composition", () => {
    expect(migration).toContain("race_rosters_one_protected_rider_idx");
    expect(migration).toContain(
      "race_roster_stage_roles_one_protected_rider_idx",
    );
    expect(migration).toContain("where race_role = 'protected_rider'");
  });

  it("met à jour les quatre écritures et interdit une mission cumulée", () => {
    expect(migration).toContain(
      "public.save_current_team_race_roster_with_roles(uuid,jsonb)",
    );
    expect(migration).toContain(
      "public.save_current_team_stage_role_plan(uuid,uuid,jsonb)",
    );
    expect(migration).toContain(
      "public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)",
    );
    expect(migration).toContain(
      "public.complete_current_team_underfilled_race_roster(uuid,jsonb)",
    );
    expect(migration).toContain(
      "(''leader'', ''sprinter'', ''leader_sprinter'', ''protected_rider'')",
    );
  });
});
