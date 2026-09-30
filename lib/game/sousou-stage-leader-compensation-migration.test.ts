import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930230000_grant_sousou_stage_leader_compensation.sql",
  ),
  "utf8",
);

describe("Sousou stage leader compensation migration", () => {
  it("targets exactly one active Sousou account and active team", () => {
    expect(migration).toContain("lower(btrim(director.display_name)) = 'sousou'");
    expect(migration).toContain("lower(btrim(director.username)) = 'sousou'");
    expect(migration).toContain("director.status = 'active'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain("if v_target_count <> 1 then");
  });

  it("grants one traceable level-ten equipment object", () => {
    expect(migration).toContain("v_reward_key constant text := 'ultimate-prototype'");
    expect(migration).toContain("importance = 10");
    expect(migration).toContain("effect_kind = 'equipment'");
    expect(migration).toContain("source_race_incident_compensation_id");
    expect(migration).toContain(
      "on conflict (incident_key, sporting_director_id) do nothing",
    );
  });

  it("does not duplicate the inventory item or notification", () => {
    expect(migration).toContain(
      "where inventory.source_race_incident_compensation_id = v_grant_id",
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing",
    );
    expect(migration).toContain("Un objet de niveau 10 vous a été attribué.");
    expect(migration).toContain("'/jeu/inventaire'");
  });
});
