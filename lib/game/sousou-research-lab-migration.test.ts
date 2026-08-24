import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824133000_grant_sousou_research_lab.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("construction du laboratoire R&D de sousou", () => {
  it("cible uniquement son identité et son équipe active", () => {
    expect(migration).toContain(
      "lower(btrim(director.display_name)) = 'sousou'",
    );
    expect(migration).toContain("assignment.role = 'general_manager'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain("if v_target_count <> 1 then");
  });

  it("construit le laboratoire au niveau un sans pouvoir le rétrograder", () => {
    expect(migration).toContain("'research_lab',\n    1,");
    expect(migration).toContain(
      "set level = greatest(public.team_infrastructures.level, 1)",
    );
    expect(migration).toContain("coalesce(v_current_level, 0) >= 1");
  });

  it("clôture proprement un éventuel chantier déjà lancé", () => {
    expect(migration).toContain("from public.infrastructure_projects");
    expect(migration).toContain("set status = 'completed'");
    expect(migration).toContain("Laboratoire R&D opérationnel");
  });
});
