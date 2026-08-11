import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260811100000_make_team_buildings_constructible.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("constructible team buildings migration", () => {
  it("allows all three buildings through projects and completed levels", () => {
    for (const code of [
      "training_center",
      "fan_club_headquarters",
      "club_shop",
    ]) {
      expect(migration).toContain("'" + code + "'");
      expect(migration).toContain(
        "infrastructure_code = '" + code + "' and level between 1 and 5",
      );
      expect(migration).toContain(
        "infrastructure_code = '" +
          code +
          "' and target_level between 1 and 5",
      );
    }
  });

  it("uses the same increasing price grids as the application", () => {
    expect(migration).toContain(
      "array[100000, 250000, 500000, 900000, 1500000]",
    );
    expect(migration).toContain(
      "array[200000, 450000, 850000, 1400000, 2200000]",
    );
    expect(migration).toContain(
      "array[150000, 350000, 650000, 1050000, 1600000]",
    );
  });

  it("requires the Fan Club headquarters before the shop", () => {
    expect(migration).toContain(
      "Construisez d’abord le siège social du Fan Club.",
    );
    expect(migration).toMatch(
      /p_infrastructure_code = 'club_shop'[\s\S]+infrastructure_code = 'fan_club_headquarters'/,
    );
  });

  it("adds two percent of professional training progression per level", () => {
    expect(migration).toContain(
      "get_team_training_center_progress_multiplier",
    );
    expect(migration).toContain(
      "coalesce(max(infrastructure.level), 0) * 0.02",
    );
    expect(migration).toContain(
      "public.get_daily_reward_training_multiplier_for_session(v_rider.team_id, v_day.id)",
    );
  });
});
