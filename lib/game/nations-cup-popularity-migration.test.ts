import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261005090000_reward_nations_cup_rider_popularity.sql",
  ),
  "utf8",
);

describe("Nations Cup rider popularity rewards", () => {
  it("rewards starters and scales the bonus up for the best results", () => {
    expect(migration).toContain("p_final_rank = 1 then 8.00");
    expect(migration).toContain("p_final_rank between 11 and 16 then 1.00");
    expect(migration).toContain("when p_status = 'classified' then 0.50");
    expect(migration).toContain(
      "p_status in ('did_not_finish', 'outside_time_limit') then 0.25",
    );
  });

  it("only rewards professional Nations Cup results", () => {
    expect(migration).toContain("race.competition_type = 'nations_cup'");
    expect(migration).not.toContain("nations_cup_junior");
  });

  it("keeps rewards idempotent and adjusts result corrections by delta", () => {
    expect(migration).toContain(
      "primary key (race_edition_id, race_roster_id)",
    );
    expect(migration).toContain(
      "on conflict (race_edition_id, race_roster_id) do nothing",
    );
    expect(migration).toContain(
      "v_reward_delta := v_new_reward - coalesce(v_previous_reward, 0)",
    );
  });

  it("hooks future results and backfills past editions once", () => {
    expect(migration).toContain(
      "after insert or update of status, final_rank",
    );
    expect(migration).toContain("with candidates as (");
    expect(migration).toContain("returning rider_id, popularity_awarded");
    expect(migration).toContain(
      "popularity_points = public.rider_popularity_profiles.popularity_points",
    );
  });
});
