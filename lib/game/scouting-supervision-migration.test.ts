import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825113000_show_and_stack_scouting_supervision.sql",
  ),
  "utf8",
).toLowerCase();

describe("scouting supervision migration", () => {
  it("expose les effets actifs en un seul appel indexé", () => {
    expect(migration).toContain(
      "create index if not exists daily_reward_active_scouting_lookup_idx",
    );
    expect(migration).toContain(
      "create or replace function public.get_current_scouting_supervision_status",
    );
    expect(migration).toContain("jsonb_agg");
  });

  it("autorise l’activation groupée des bonus de scouting", () => {
    expect(migration).toMatch(/'rating_boost',\s*'scouting_boost'/);
    expect(migration).toContain(
      "v_result := public.redeem_current_daily_reward",
    );
  });
});
