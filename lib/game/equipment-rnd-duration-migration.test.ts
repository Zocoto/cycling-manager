import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824132000_rebalance_and_settle_pipo_equipment_rnd.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("durée courte des recherches R&D", () => {
  it("fixe la base à cinq jours et applique ensuite le talent du staff", () => {
    expect(migration).toContain(
      "5 - case when v_has_research_time then v_engineer_level else 0 end",
    );
    expect(migration).toContain("v_duration := greatest(\\n    1,");
  });

  it("recalcule aussi les recherches déjà actives", () => {
    expect(migration).toContain(
      "update public.equipment_rnd_projects as project",
    );
    expect(migration).toContain("talent.talent_code = 'research_time'");
    expect(migration).toContain("where project.status = 'active'");
  });

  it("force la recherche de Pipo puis utilise le moteur officiel", () => {
    expect(migration).toContain(
      "lower(btrim(director.display_name)) = 'pipo inzaghi'",
    );
    expect(migration).toContain(
      "lower(btrim(sponsor.name)) = 'tsubame precision'",
    );
    expect(migration).toContain(
      "perform public.settle_due_equipment_rnd_projects()",
    );
    expect(migration).toContain(
      "v_result.status is distinct from 'completed'",
    );
  });
});
