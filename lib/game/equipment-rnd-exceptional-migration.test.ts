import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260919030000_add_exceptional_rnd_prototypes.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("exceptional equipment R&D migration", () => {
  it("adds a real research-engineer affix and allows a +3 result", () => {
    expect(migration).toContain("'research_exceptional_chance'");
    expect(migration).toContain("rating_delta between -1 and 3");
    expect(migration).toContain("member.level)) * 0.5");
  });

  it("keeps the chance at 1% per eligible project without altering success", () => {
    expect(migration).toContain("select 1::numeric + coalesce");
    expect(migration).toContain("when v_bonus_total <= 7");
    expect(migration).toContain("random() * v_project.success_rate");
    expect(migration).toContain(
      "< public.get_equipment_rnd_exceptional_chance(v_project.engineer_contract_id)",
    );
    expect(migration).toContain("then 3");
    expect(migration).toContain("when v_project.lab_level >= 6 and random() < 0.12 then 2");
  });

  it("recognizes both +2 and +3 for the existing breakthrough objective", () => {
    expect(migration).toContain("and project.rating_delta >= 2;");
    expect(migration).toContain("where objective_key = 'rnd_breakthrough'");
  });
});
