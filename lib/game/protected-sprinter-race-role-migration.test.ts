import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260901120000_add_protected_sprinter_race_role.sql",
  ),
  "utf8",
);

describe("rôle protégé leader / sprinteur", () => {
  it("autorise la valeur dans les rôles généraux et par étape", () => {
    expect(migration).toContain("alter table public.race_rosters");
    expect(migration).toContain(
      "alter table public.race_roster_stage_roles",
    );
    expect(migration.match(/'leader_sprinter'/g)?.length).toBeGreaterThan(8);
  });

  it("partage l’unique créneau de sprint sans prendre celui du leader", () => {
    expect(migration).toContain(
      "where race_role in ('sprinter', 'leader_sprinter')",
    );
    expect(migration).toContain(
      "where entry.value ->> ''role'' in (''sprinter'', ''leader_sprinter'')",
    );
    expect(migration).not.toContain(
      "where race_role in ('leader', 'leader_sprinter')",
    );
  });

  it("préserve les validations des quatre écritures de composition", () => {
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
      "where role_entry.value ->> ''role'' in (''leader'', ''sprinter'', ''leader_sprinter'')",
    );
    expect(migration).toContain(
      "v_definition := replace(v_definition, chr(13), '');",
    );
  });
});
