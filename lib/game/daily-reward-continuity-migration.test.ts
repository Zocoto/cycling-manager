import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829100000_preserve_daily_reward_cycle_after_absence.sql",
  ),
  "utf8",
);

describe("daily reward cycle continuity migration", () => {
  it("keeps the current cycle position visible after an absence", () => {
    expect(migration).toContain(
      "v_consecutive := greatest(1, v_streak_state.cycle_day)",
    );
    expect(migration).toMatch(
      /when v_streak_state is not null\s+then public\.get_next_daily_reward_cycle_day\(v_streak_state\.cycle_day\)/,
    );
    expect(migration).not.toContain(
      "v_streak_state.last_claimed_game_day_index = v_current_game_day_index - 1",
    );
  });

  it("advances the next claim regardless of missed game days", () => {
    const claimFunction = migration.slice(
      migration.indexOf(
        "create or replace function public.claim_current_daily_reward",
      ),
    );

    expect(claimFunction).toMatch(
      /when v_streak_state is not null\s+then public\.get_next_daily_reward_cycle_day\(v_streak_state\.cycle_day\)/,
    );
    expect(claimFunction).toContain("else 1");
    expect(claimFunction).not.toContain(
      "last_claimed_game_day_index = v_current_game_day_index - 1",
    );
  });

  it("preserves the one-claim-per-day guard", () => {
    expect(migration).toContain(
      "raise exception 'Le cadeau du jour a déjà été récupéré.'",
    );
    expect(migration).toContain("for update");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
