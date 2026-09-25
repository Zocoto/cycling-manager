import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925130000_grant_boucle_provinces_v35_consolation.sql",
  ),
  "utf8",
);

describe("Boucle des Provinces v35 consolation migration", () => {
  it("targets the two validated active managers and teams", () => {
    expect(migration).toContain("d7ec0ccf-bcb4-4802-8a14-b458eccf41d7");
    expect(migration).toContain("803e9755-570b-48ba-9b2d-6bbf5d8312d4");
    expect(migration).toContain("Ujik");
    expect(migration).toContain("Hexa Bâtiment");
    expect(migration).toContain("69334b61-e63a-49fd-8eb6-1ed901c5ec98");
    expect(migration).toContain("c9db310c-1a90-4df5-9f78-fd48c8147425");
    expect(migration).toContain("Romain Bardet");
    expect(migration).toContain("Montecristi Toquilla House");
  });

  it("grants one traceable level-eight equipment object per manager", () => {
    expect(migration).toContain("v_reward_key constant text := 'elite-equipment'");
    expect(migration).toContain("importance = 8");
    expect(migration).toContain("effect_kind = 'equipment'");
    expect(migration).toContain("source_race_incident_compensation_id");
    expect(migration).toContain("race_incident_compensation_once");
    expect(migration).toContain(
      "on conflict (incident_key, sporting_director_id) do nothing",
    );
  });

  it("notifies each manager without duplicating inventory or messages", () => {
    expect(migration).toContain("where inventory.source_race_incident_compensation_id = v_grant_id");
    expect(migration).toContain("Cadeau de consolation · Boucle des Provinces");
    expect(migration).toContain("Le moteur de course a été corrigé et la version 35 est maintenant active.");
    expect(migration).toContain("where message.source_reference =");
  });
});
