import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  addFavoriteRaceBonusToRiders,
  applyFavoriteRaceRatingBonus,
  FAVORITE_RACE_RATING_BONUS,
} from "./rider-favorite-races";
import type { RiderSimulationRatings } from "./race-simulation";

const ratings: RiderSimulationRatings = {
  flat: 72,
  mountain: 81,
  hills: 69,
  cobbles: 55,
  downhill: 88,
  sprint: 77,
  acceleration: 83,
  timeTrial: 64,
  prologue: 70,
  endurance: 79,
  resistance: 84,
  recovery: 99,
  breakaway: 68,
};

describe("favorite race performance bonus", () => {
  it("adds exactly two points to every race rating without mutating permanent ratings", () => {
    const result = applyFavoriteRaceRatingBonus(
      ratings,
      FAVORITE_RACE_RATING_BONUS,
    );
    for (const key of Object.keys(ratings) as Array<keyof RiderSimulationRatings>) {
      expect(result[key]).toBe(Math.min(100, ratings[key] + 2));
    }
    expect(ratings.recovery).toBe(99);
    expect(result.recovery).toBe(100);
  });

  it("never grants a bonus without the exact favorite-race marker", () => {
    expect(applyFavoriteRaceRatingBonus(ratings, undefined)).toBe(ratings);
    expect(applyFavoriteRaceRatingBonus(ratings, 0)).toBe(ratings);
    expect(applyFavoriteRaceRatingBonus(ratings, 10)).toBe(ratings);
  });

  it("marks only participating favorites in the current edition", () => {
    const riders = [{ id: "favorite" }, { id: "other" }];
    expect(addFavoriteRaceBonusToRiders(riders, new Set(["favorite"]))).toEqual([
      { id: "favorite", favoriteRaceBonus: 2 },
      { id: "other" },
    ]);
    expect(addFavoriteRaceBonusToRiders(riders, new Set())).toBe(riders);
  });
});

describe("seasonal favorite race snapshots", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260919040000_add_rider_favorite_races.sql"),
    "utf8",
  );
  const maintenance = readFileSync(
    join(process.cwd(), "app/api/cron/game-maintenance/route.ts"),
    "utf8",
  );

  it("limits favorites to three stable race identities per rider and season", () => {
    expect(migration).toContain("preference_rank between 1 and 3");
    expect(migration).toContain("primary key (season_id, rider_id, preference_rank)");
    expect(migration).toContain("unique (season_id, rider_id, race_id)");
    expect(migration).toContain("where ranked.preference_rank <= 3");
    expect(migration).toContain("past_season.game_year < v_game_year");
  });

  it("uses geography, prestige, terrain and repeated results, then refreshes after rollover", () => {
    expect(migration).toContain("public.country_adjacencies");
    expect(migration).toContain("rider.rider_continent_code = race_option.race_continent_code");
    expect(migration).toContain("when 'elite' then 16");
    expect(migration).toContain("race_option.mountain_count * (rider.mountain + rider.endurance)");
    expect(migration).toContain("history.appearances >= 2");
    expect(migration).toContain("history.victories");
    expect(maintenance.indexOf('"refresh_due_rider_favorite_races"')).toBeGreaterThan(
      maintenance.indexOf('"settle_due_season_rollovers"'),
    );
  });
});
