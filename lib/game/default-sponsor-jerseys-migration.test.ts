import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261003120000_default_missing_sponsor_jerseys_at_season_end.sql",
    import.meta.url,
  ),
  "utf8",
).replaceAll("\r", "");

describe("maillots sponsor par défaut en fin de saison", () => {
  it("complète les nouveaux contrats sans écraser le choix du DS", () => {
    expect(migration).toContain(
      "create or replace function public.assign_default_next_season_sponsor_jerseys",
    );
    expect(migration).toContain(
      "selected_jersey_id = lower(btrim(sponsor.catalog_key)) || '-classic'",
    );
    expect(migration).toContain("contract.selected_jersey_id is null");
    expect(migration).toContain("contract.selected_jersey_style is null");
  });

  it("prépare aussi le maillot des contrats pluriannuels", () => {
    expect(migration).toContain(
      "pending_jersey_id = lower(btrim(sponsor.catalog_key)) || '-classic'",
    );
    expect(migration).toContain("pending_jersey_season_id = v_target.id");
    expect(migration).toContain(
      "v_target.game_year between start_season.game_year",
    );
  });

  it("s'appuie sur le dernier jour réel et sécurise le rollover", () => {
    expect(migration).toContain("select max(day.day_number)::integer");
    expect(migration).toContain(
      "old.status = 'active' and new.status = 'completed'",
    );
    expect(migration).toContain(
      "before update of current_day_number, status on public.seasons",
    );
  });

  it("n'expose pas l'écriture aux joueurs", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
