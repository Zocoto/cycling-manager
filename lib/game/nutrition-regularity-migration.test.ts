import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(),
  "supabase/migrations/20261007120000_increase_supplement_risk_with_regularity.sql"), "utf8");
const service = readFileSync(join(process.cwd(), "services/team-health.ts"), "utf8");
const editor = readFileSync(join(process.cwd(), "components/game/nutrition-interventions-editor.tsx"), "utf8");

describe("supplement regularity wiring", () => {
  it("partage le décompte réel entre le moteur et l’aperçu, borné et réservé au serveur", () => {
    expect(migration).toContain("count(distinct day.calendar_date)");
    expect(migration).toContain("day.calendar_date >= v_date - 6");
    expect(migration).toContain("day.calendar_date < v_date");
    expect(migration).toContain("cardinality(p_rider_ids), 0) > 100");
    expect(migration).toContain("from public, anon, authenticated");
    expect(service).toContain('.rpc("get_recent_supplement_use_counts"');
    expect(editor).toContain("recentInterventionCount,");
  });

  it("préserve la puissance, le tirage déterministe et la protection contre les doublons", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("new.id::text || ':supplement'");
    expect(migration).toContain("least(6, greatest(0, coalesce(v_recent_uses, 0))) * 2");
    expect(migration).toContain("when 'recovery_snack' then 0.1");
    expect(migration).toContain("when 'tailored_plan' then 0.2");
    expect(migration).toContain("else 0.3");
    expect(migration).toContain("set local lock_timeout = '2s'");
    expect(migration).not.toContain("update public.rider_nutrition_interventions");
    expect(migration).not.toContain("create trigger");
  });
});
