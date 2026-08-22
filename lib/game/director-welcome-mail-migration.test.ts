import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822140000_add_director_welcome_message.sql",
  ),
  "utf8",
);

describe("courrier de bienvenue du Directeur Sportif", () => {
  it("est envoyé automatiquement et une seule fois après l'inscription", () => {
    expect(migration).toContain(
      "private.ensure_sporting_director_welcome_message",
    );
    expect(migration).toContain("after insert on public.sporting_directors");
    expect(migration).toContain("'system:welcome'");
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing",
    );
  });

  it("propose les raccourcis des premières étapes", () => {
    expect(migration).toContain("add column action_links jsonb");
    expect(migration).toContain("'/jeu/transferts'");
    expect(migration).toContain("'/jeu/calendrier'");
    expect(migration).toContain("'/jeu/preparation-course'");
    expect(migration).toContain("'/jeu/staff'");
    expect(migration).toContain("l’icône « ? »");
  });

  it("prévoit l'exemplaire de validation pour Max Lamenace", () => {
    expect(migration).toContain("lower('Max Lamenace')");
  });
});
