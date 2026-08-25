import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260825130000_create_mixed_zone_events.sql",
  ),
  "utf8",
).toLowerCase();

describe("migration des événements de zone mixte", () => {
  it("applique toutes les conséquences dans une fonction atomique", () => {
    expect(migration).toContain(
      "create or replace function public.submit_post_race_interview_with_event",
    );
    expect(migration).toContain("for update of interview, director, team_season");
    expect(migration).toContain("update public.sporting_directors");
    expect(migration).toContain("update public.team_seasons");
    expect(migration).toContain("public.rider_popularity_profiles");
    expect(migration).toContain("public.team_item_inventory");
    expect(migration).toContain("where item.item_key = v_inventory_item_key");
    expect(migration).toContain("v_inventory_item_key <> 'acceleration-focus'");
  });

  it("est idempotente et inaccessible directement au joueur", () => {
    expect(migration).toContain("if v_context.interview_status = 'submitted'");
    expect(migration).toContain(
      "revoke all on function public.submit_post_race_interview_with_event",
    );
    expect(migration).toContain("to service_role");
  });

  it("neutralise les pénalités sponsor temporaires mais conserve la clôture", () => {
    expect(migration).toContain("v_temporary_penalty integer := 0");
    expect(migration).toContain("if not p_finalize then");
    expect(migration).toContain("reputation_penalty = 0");
    expect(migration).toContain(
      "le barème agrégé de 10 points par objectif manquant sous 50 % ne s’applique qu’à la clôture de saison",
    );
  });
});
