import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824131000_grant_pipo_inzaghi_research_lab.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("activation du laboratoire R&D de Pipo Inzaghi", () => {
  it("cible simultanément le DS et son sponsor principal", () => {
    expect(migration).toContain("lower(btrim(director.display_name)) = 'pipo inzaghi'");
    expect(migration).toContain("lower(btrim(sponsor.name)) = 'tsubame precision'");
    expect(migration).toContain("contract.role = 'principal'");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain("if v_target_count <> 1 then");
  });

  it("active immédiatement le laboratoire au niveau 1 sans débit financier", () => {
    expect(migration).toContain("'research_lab',\n    1,");
    expect(migration).toContain(
      "level = greatest(public.team_infrastructures.level, 1)",
    );
    expect(migration).not.toContain("team_finance_transactions");
    expect(migration).not.toContain("cash_balance");
  });

  it("termine proprement un éventuel chantier de niveau 1 déjà payé", () => {
    expect(migration).toContain("project.target_level = 1");
    expect(migration).toContain("set status = 'completed'");
    expect(migration).toContain("Laboratoire R&D opérationnel");
  });
});
