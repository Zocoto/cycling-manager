import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260927230000_add_s4_main_and_secondary_sponsors.sql",
  ),
  "utf8",
).toLowerCase();
const secondaryService = readFileSync(
  resolve(process.cwd(), "services/secondary-sponsors.ts"),
  "utf8",
).toLowerCase();
const sponsorPage = readFileSync(
  resolve(process.cwd(), "app/jeu/sponsoring/page.tsx"),
  "utf8",
).toLowerCase();

describe("S4 sponsor expansion migration", () => {
  it("crée un objectif principal atomique, idempotent et chiffré", () => {
    expect(migration).toContain("create table public.sponsor_main_objective_terms");
    expect(migration).toContain("settle_sponsor_main_objective");
    expect(migration).toContain("sponsor-main-objective:");
    expect(migration).toContain("sponsor_main_objective_failure");
    expect(migration).toContain("on conflict (team_season_id, source_reference) do nothing");
  });

  it("crée dix identités légères par pays et protège la signature à 1 500 points", () => {
    expect(migration).toContain("cross join (values");
    expect(migration).toContain("(10, 'pul");
    expect(migration).toContain("reputation_points < 1500");
    expect(migration).toContain("create or replace function public.sign_secondary_sponsor_offer");
    expect(migration).toContain("unique (team_id, season_id)");
  });

  it("verse chaque prime une seule fois et applique le nom composé au J1", () => {
    expect(migration).toContain("secondary-sponsor-objective:");
    expect(migration).toContain("display_name = display_name || ' - '");
    expect(migration).toContain("set cash_balance = cash_balance + v_objective.cash_reward");
    expect(migration).toContain("after update of status on public.race_editions");
  });

  it("expose l’onglet dédié, le verrou THL et l’éditeur du logo", () => {
    expect(sponsorPage).toContain("sponsor secondaire");
    expect(sponsorPage).toContain("onglet=secondaire");
    expect(secondaryService).toContain("secondary_sponsor_reputation_threshold");
    expect(secondaryService).toContain("getsecondarysponsorobjectivecount");
    expect(secondaryService).toContain("loadfutureprincipaljersey");
  });
});
