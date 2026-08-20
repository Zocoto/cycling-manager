import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260820170000_complete_underfilled_race_rosters.sql",
  ),
  "utf8",
);

describe("réinscription d'une composition passée sous le minimum", () => {
  it("ouvre une réparation générique sans exiger un retrait médical", () => {
    expect(migration).toContain(
      "complete_current_team_underfilled_race_roster",
    );
    expect(migration).toContain(
      "v_existing_active_count >= v_minimum_roster_size",
    );
    expect(migration).toContain(
      "Cette composition respecte déjà le contingent minimum et reste verrouillée.",
    );

    const genericFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.complete_current_team_underfilled_race_roster",
      ),
      migration.indexOf(
        "create or replace function public.replace_current_team_injured_race_roster",
      ),
    );
    expect(genericFunction).not.toContain(
      "Aucun retrait médical ne justifie une modification",
    );
  });

  it("conserve obligatoirement les coureurs encore engagés", () => {
    expect(migration).toContain(
      "v_active_count <> v_existing_active_count",
    );
    expect(migration).toContain(
      "Les coureurs toujours engagés doivent rester dans la composition.",
    );
    expect(migration).toMatch(
      /on conflict \(race_registration_id, rider_id\)[\s\S]*?when race_rosters\.status in \('selected', 'confirmed'\)[\s\S]*?then race_rosters\.race_role/,
    );
  });

  it("ne désinscrit plus toute l'équipe après une priorité CN", () => {
    const compatibilityFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.withdraw_underfilled_race_registration_after_cn_conflict",
      ),
      migration.indexOf("with affected_registrations as materialized"),
    );

    expect(compatibilityFunction).toContain(
      "return v_active_roster_size < v_minimum_roster_size",
    );
    expect(compatibilityFunction).not.toMatch(
      /update public\.race_registrations[\s\S]*?status = 'withdrawn'/,
    );
    expect(compatibilityFunction).not.toMatch(
      /update public\.race_rosters[\s\S]*?set status = 'withdrawn'/,
    );
  });

  it("récupère les reliquats encore valides retirés par l'ancienne règle CN", () => {
    expect(migration).toContain("restored_rosters as (");
    expect(migration).toContain("reopened_registrations as (");
    expect(migration).toMatch(
      /restored_rosters as \([\s\S]*?status = 'confirmed'[\s\S]*?contract\.status = 'active'[\s\S]*?not exists/,
    );
    expect(migration).toMatch(
      /reopened_registrations as \([\s\S]*?status = 'accepted'/,
    );
  });

  it("garde l'ancien RPC comme alias sécurisé", () => {
    expect(migration).toMatch(
      /replace_current_team_injured_race_roster[\s\S]*?complete_current_team_underfilled_race_roster/,
    );
  });
});
