import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808151000_date_daily_nutrition_effects_correctly.sql",
  ),
  "utf8",
);

describe("datation des bonus nutritionnels quotidiens", () => {
  it("date les bonus au jour de jeu reellement concerne", () => {
    expect(migration).toContain(
      "date_daily_nutrition_effect_on_game_day",
    );
    expect(migration).toContain(
      "before insert or update of season_day_id",
    );
    expect(migration).toContain(
      "update public.rider_daily_nutrition_effects as effect",
    );
    expect(migration).toContain("at time zone 'Europe/Paris'");
  });
});
