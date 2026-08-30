import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830100000_fix_instant_youth_promotion_condition_state.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("instant youth promotion condition-state fix migration", () => {
  it("keeps the current-day condition insert conflict-safe", () => {
    const conditionInsertStart = migration.indexOf(
      "insert into public.rider_condition_states (",
    );
    const contractInsertStart = migration.indexOf(
      "insert into public.rider_contracts (",
      conditionInsertStart,
    );
    const conditionInsert = migration.slice(
      conditionInsertStart,
      contractInsertStart,
    );

    expect(conditionInsertStart).toBeGreaterThan(-1);
    expect(contractInsertStart).toBeGreaterThan(conditionInsertStart);
    expect(conditionInsert).toContain(
      "on conflict (rider_id, season_day_id) do nothing;",
    );
    expect(conditionInsert).not.toContain("do update");
  });

  it("still accepts juniors already scheduled for next-season promotion", () => {
    expect(migration).toContain(
      "v_academy.status not in ('active', 'recruited')",
    );
    expect(migration).toContain("promotion_game_year = null");
  });

  it("consumes the item only after the rider and contract are created", () => {
    const riderInsert = migration.indexOf("insert into public.riders (");
    const contractInsert = migration.indexOf("insert into public.rider_contracts (");
    const rewardConsumption = migration.indexOf(
      "if v_reward_source = 'daily_reward' then",
    );

    expect(riderInsert).toBeGreaterThan(-1);
    expect(contractInsert).toBeGreaterThan(riderInsert);
    expect(rewardConsumption).toBeGreaterThan(contractInsert);
  });
});
