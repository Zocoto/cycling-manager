import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261001203000_grant_ujik_ruta_stage_role_compensation.sql",
  ),
  "utf8",
);

describe("Ujik Ruta stage-role compensation migration", () => {
  it("targets exactly one active Ujik account and active team", () => {
    expect(migration).toContain("lower(btrim(director.display_name)) = 'ujik'");
    expect(migration).toContain("lower(btrim(director.username)) = 'ujik'");
    expect(migration).toContain("director.status = 'active'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain("if v_target_count <> 1 then");
  });

  it("grants one traceable level-nine gift", () => {
    expect(migration).toContain("catalog.importance = 9");
    expect(migration).toContain("source_race_incident_compensation_id");
    expect(migration).toContain(
      "on conflict (incident_key, sporting_director_id) do nothing",
    );
  });

  it("does not duplicate the inventory gift or notification", () => {
    expect(migration).toContain(
      "where inventory.source_race_incident_compensation_id = v_grant_id",
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing",
    );
    expect(migration).toContain("Un cadeau de niveau 9 vous a été attribué.");
    expect(migration).toContain("'/jeu/inventaire'");
  });
});
