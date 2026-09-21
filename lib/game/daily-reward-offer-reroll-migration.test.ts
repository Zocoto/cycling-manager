import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921100000_reroll_rigobert_day_40_rewards.sql",
  ),
  "utf8",
);

describe("reroll du cadeau 40/40 de Rigobert", () => {
  it("scope le sel à un directeur et un jour de saison", () => {
    expect(migration).toContain("create table if not exists public.daily_reward_offer_rerolls");
    expect(migration).toContain("primary key (sporting_director_id, season_day_id)");
    expect(migration).toContain("get_daily_reward_offer_sort_key");
    expect(migration).toContain("coalesce((");
    expect(migration).toContain("), '')");
  });

  it("utilise la même clé pour l'affichage et la validation", () => {
    expect(migration).toContain("get_current_daily_reward_overview()'::regprocedure");
    expect(migration).toContain("claim_current_daily_reward(text)'::regprocedure");
    expect(migration).toContain("if v_match_count <> 1 then");
    expect(migration.match(/regexp_replace\(/g)).toHaveLength(2);
  });

  it("protège le reroll curatif de Rigobert", () => {
    expect(migration).toContain("68ac37d2-0f42-4601-b892-d6661bd26f1d");
    expect(migration).toContain("lower(director.display_name) = 'rigobert'");
    expect(migration).toContain("v_cycle_day <> 39");
    expect(migration).toContain("get_next_daily_reward_cycle_day(v_cycle_day) <> 40");
    expect(migration).toContain("daily_reward_claims as claim");
  });

  it("remplace les trois propositions sans recouvrement", () => {
    expect(migration).toContain("'ultimate-prototype'");
    expect(migration).toContain("'custom-staff-mandate'");
    expect(migration).toContain("'staff-expertise-badge'");
    expect(migration).toContain("'golden-ticket'");
    expect(migration).toContain("'historic-training'");
    expect(migration).toContain("'high-performance-cell'");
    expect(migration).toContain("if v_previous && v_replacement then");
  });
});
