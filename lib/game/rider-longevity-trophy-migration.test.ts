import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260828100000_age_rider_avatars_and_reward_longevity.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const achievementDefinitions = readFileSync(
  resolve(process.cwd(), "lib/game/achievement-trophies.ts"),
  "utf8",
);

describe("rider aging and secret longevity trophy migration", () => {
  it("extends every persisted rider age boundary and season rollover to 120", () => {
    expect(migration).toContain("check (age between 15 and 120)");
    expect(migration).toContain(
      "check (retirement_age is null or retirement_age between 15 and 120)",
    );
    expect(migration).toContain(
      "check (preview_age is null or preview_age between 15 and 120)",
    );
    expect(migration).toContain("least(120, rating.age + 1)");
    expect(migration).toContain("public.rollover_game_season(uuid,boolean)");
  });

  it("creates three stable free-agent test riders at the visual thresholds", () => {
    expect(migration).toContain("'Arsène', 'Grison'");
    expect(migration).toContain("'Albin', 'Neige'");
    expect(migration).toContain("'Mortimer', 'Éternel'");
    expect(migration).toContain("'free_agent'");
    expect(migration).toContain("f0900000-0000-4000-8000-000000000090");
    expect(migration).toMatch(/'Arsène', 'Grison', 40,/);
    expect(migration).toMatch(/'Albin', 'Neige', 55,/);
    expect(migration).toMatch(/'Mortimer', 'Éternel', 90,/);
  });

  it("keeps the longevity trophy secret and out of the public gallery", () => {
    expect(migration).toContain("peloton_eternel");
    expect(migration).toContain("Le Peloton éternel");
    expect(migration).toContain("Trophée secret");
    expect(achievementDefinitions).not.toContain("peloton_eternel");
  });

  it("rewards a strictly over-90 rider with the exceptional bundle", () => {
    expect(migration).toContain("rating.age > 90");
    expect(migration).toContain("cash_balance = cash_balance + 5000000");
    expect(migration).toContain("experience_points = experience_points + 5000");
    expect(migration).toContain("reputation_points = reputation_points + 500");
    expect(migration).toContain("for v_slot in 1..3 loop");
    expect(migration).toContain("catalog.importance = 10");
    expect(migration).toContain("source_longevity_trophy_reward_id");
    expect(migration).toContain(
      "on conflict (sporting_director_id, trophy_key) do nothing",
    );
  });

  it("uses event triggers and does not introduce a polling job", () => {
    expect(migration).toContain("check_longevity_trophy_after_contract");
    expect(migration).toContain("check_longevity_trophy_after_rating");
    expect(migration).toContain("check_longevity_trophy_after_manager");
    expect(migration).not.toContain("pg_cron");
  });
});
