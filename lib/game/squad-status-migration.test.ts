import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925133000_add_team_squad_statuses.sql",
  ),
  "utf8",
);

describe("team squad status migration", () => {
  it("stocke le statut sur le contrat actif avec un domaine fermé", () => {
    expect(migration).toContain("alter table public.rider_contracts");
    expect(migration).toContain("rider_contracts_squad_status_allowed");
    expect(migration).toContain("'absolute_leader'");
    expect(migration).toContain("'bottle_carrier'");
  });

  it("autorise uniquement le DS de l’équipe actuelle à modifier le statut", () => {
    expect(migration).toContain(
      "create function public.set_current_team_rider_squad_status",
    );
    expect(migration).toContain("director.auth_user_id = (select auth.uid())");
    expect(migration).toContain("contract.team_id = v_team_id");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("to authenticated");
  });

  it("expose le statut dans l’effectif et l’inscription aux courses", () => {
    expect(migration).toContain(
      "create function public.get_current_team_roster_with_potential()",
    );
    expect(migration).toContain(
      "create function public.get_current_team_race_roster_options(",
    );
    expect(migration.match(/squad_status text/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
