import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260808130000_create_race_preparations.sql",
  ),
  "utf8",
);

describe("race preparation migration", () => {
  it("stores one compact strategy per registered team and stage", () => {
    expect(migration).toContain("create table public.race_stage_strategies");
    expect(migration).toContain(
      "primary key (race_registration_id, stage_id)",
    );
    expect(migration).toContain("unique (team_id, stage_id)");
    expect(migration).toContain("jsonb_array_length(attack_orders) <= 2");
  });

  it("exposes and saves only the authenticated current team", () => {
    expect(migration).toContain(
      "create function public.get_current_team_race_preparation()",
    );
    expect(migration).toContain(
      "create function public.save_current_team_race_preparation",
    );
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("security definer\nset search_path = ''");
  });

  it("locks past stages and validates every tactical reference", () => {
    expect(migration).toContain("v_departure_at <= clock_timestamp()");
    expect(migration).toContain(
      "from public.official_stage_simulations as simulation",
    );
    expect(migration).toContain(
      "Un même coureur ne peut pas cumuler deux missions spéciales.",
    );
    expect(migration).toContain(
      "Les missions spéciales doivent être confiées à des équipiers.",
    );
    expect(migration).toContain(
      "Deux ordres d attaque au maximum sont autorisés par étape.",
    );
  });

  it("adds a short-lived single-compute claim for official simulations", () => {
    expect(migration).toContain(
      "create table public.official_stage_simulation_claims",
    );
    expect(migration).toContain("claim_token uuid not null unique");
    expect(migration).toContain(
      "empêchant plusieurs fonctions serveur de calculer simultanément",
    );
  });
});
