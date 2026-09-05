import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pressMigration = readFileSync(
  "supabase/migrations/20260905151000_create_pre_race_press_conferences.sql",
  "utf8",
).toLowerCase();
const rivalryMigration = readFileSync(
  "supabase/migrations/20260905152000_create_team_rivalries.sql",
  "utf8",
).toLowerCase();
const awardsMigration = readFileSync(
  "supabase/migrations/20260905153000_create_season_awards.sql",
  "utf8",
).toLowerCase();

describe("community RP system migrations", () => {
  it("opens press conferences only after a complete accepted startlist", () => {
    expect(pressMigration).toContain("registration.status = 'accepted'");
    expect(pressMigration).toContain("roster.status in ('selected', 'confirmed')");
    expect(pressMigration).toContain("join public.season_days as season_day");
    expect(pressMigration).toContain("p_leader_rider_id");
    expect(pressMigration).toContain("unique (race_edition_id, team_id)");
    expect(pressMigration).toContain("settle_pre_race_press_after_race_completion");
    expect(pressMigration).toContain("'pre_race_press'");
  });

  it("pairs only human teams and records each common race once", () => {
    expect(rivalryMigration).toContain("from public.alpha_bot_managers as bot");
    expect(rivalryMigration).toContain("mod(a.pairing_rank, 2) = 1");
    expect(rivalryMigration).toContain("shared_races = shared_races + 1");
    expect(rivalryMigration).toContain("team_rivalries_after_race_completion");
    expect(rivalryMigration).toContain("settle_team_rivalries_for_season");
    expect(rivalryMigration).toContain("'team_rivalry'");
  });

  it("freezes five awards after the season rankings are complete", () => {
    for (const key of [
      "rider_of_year",
      "team_of_year",
      "serial_winner",
      "young_rider",
      "director_of_year",
    ]) {
      expect(awardsMigration).toContain(`'${key}'`);
    }
    expect(awardsMigration).toContain("unique (season_id, award_key)");
    expect(awardsMigration).toContain("new.status = 'completed'");
    expect(awardsMigration).toContain("create_season_awards_after_completion");
  });

  it("keeps every SQL function body balanced", () => {
    for (const migration of [pressMigration, rivalryMigration, awardsMigration]) {
      expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
    }
  });
});
