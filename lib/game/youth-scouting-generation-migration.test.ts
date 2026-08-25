import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260825142000_refine_youth_scouting_generation.sql",
  ),
  "utf8",
);

describe("refined youth scouting generation migration", () => {
  it("ranks countries from the immediately preceding UCI season", () => {
    expect(migration).toContain(
      "create or replace function public.get_youth_scouting_country_uci_rankings",
    );
    expect(migration).toContain("season.game_year < current_season.game_year");
    expect(migration).toContain("order by season.game_year desc");
    expect(migration).toContain("limit 1");
    expect(migration).toContain("public.rider_season_summaries");
    expect(migration).toContain("join public.riders as rider");
    expect(migration).not.toContain("reward_events");
  });

  it("persists a rare native ability through academy and promotion", () => {
    expect(migration).toContain(
      "youth_scouting_candidates\n  add column if not exists native_special_ability_code",
    );
    expect(migration).toContain(
      "youth_academy_riders\n  add column if not exists native_special_ability_code",
    );
    expect(migration).toContain("copy_youth_native_ability_to_academy");
    expect(migration).toContain("grant_promoted_youth_native_ability");
    expect(migration).toContain("'academy_native'");
    expect(migration).toContain(
      "on conflict (rider_id, ability_code) do nothing",
    );
  });
});
