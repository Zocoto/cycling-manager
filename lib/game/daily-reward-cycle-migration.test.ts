import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260809141000_extend_daily_reward_cycle.sql",
  ),
  "utf8",
);

describe("daily reward 40-gift cycle migration", () => {
  it("adds the missing importance milestones", () => {
    expect(migration).toContain("when cycle_day = 28 then 7");
    expect(migration).toContain("when cycle_day = 32 then 8");
    expect(migration).toContain("when cycle_day = 36 then 9");
    expect(migration).toContain("when cycle_day = 40 then 10");
  });

  it("persists the cycle across 28-day season boundaries", () => {
    expect(migration).toContain(
      "create table public.daily_reward_streak_states",
    );
    expect(migration).toContain("season.game_year * 28 + day.day_number");
    expect(migration).toContain(
      "v_context.game_year * 28 + v_context.current_day_number",
    );
  });

  it("restarts the cycle after the level 10 gift", () => {
    expect(migration).toContain("when coalesce(p_cycle_day, 0) >= 40 then 1");
    expect(migration).toContain(
      "public.get_next_daily_reward_cycle_day(v_streak_state.cycle_day)",
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id) do update set",
    );
  });
});
