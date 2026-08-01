import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801160000_use_all_vacant_elite_wildcards.sql",
  ),
  "utf8",
);

describe("migration de capacite des Wild Cards Elite", () => {
  it("ouvre toutes les places non occupees du plateau de 24 equipes", () => {
    expect(migration).toContain("coalesce(v_edition.field_limit, 24)");
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).not.toMatch(/select least\(\s*4,/);
    expect(migration).toContain("v_rank <= v_available_places");
  });

  it("conserve les equipes Elite acceptees comme prioritaires", () => {
    expect(migration).toContain(
      "coalesce(v_edition.field_limit, 24) - count(*)::integer",
    );
    expect(migration).toContain(
      "les equipes Elite inscrites sont prioritaires",
    );
  });

  it("regularise les refus de la saison 1 avant le depart", () => {
    expect(migration).toContain(
      "race.slug in ('ruta-de-las-sierras', 'classique-des-lacs')",
    );
    expect(migration).toContain("season.game_year = 1");
    expect(migration).toContain("stage.departure_at > now()");
    expect(migration).toContain(
      "rejected.invitation_rank <= rejected.available_places",
    );
  });

  it("restaure l'invitation, la decision et la composition hors blessure", () => {
    expect(migration).toMatch(
      /status = 'accepted',\s+entry_method = 'invited'/,
    );
    expect(migration).toContain("set status = 'confirmed'");
    expect(migration).toContain("roster.withdrawn_by_injury_id is null");
    expect(migration).toContain("decision = 'accepted'");
  });
});
