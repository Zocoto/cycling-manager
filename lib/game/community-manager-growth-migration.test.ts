import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260825100000_add_community_manager_growth_talent.sql",
  ),
  "utf8",
);

describe("community manager growth talent migration", () => {
  it("installe le nouveau talent dans le catalogue", () => {
    expect(migration).toContain("'community_rider_popularity_and_fans'");
    expect(migration).toContain("'community_manager'");
    expect(migration).toContain("'Communauté engagée'");
  });

  it("renforce les gains de popularité et de supporters", () => {
    expect(migration).toContain(
      "public.get_active_team_staff_talent_strength(",
    );
    expect(migration).toContain(
      "v_level * (1 + v_growth_percentage / 100.0)",
    );
    expect(migration).toContain(
      "v_level * 25 * (1 + v_growth_percentage / 100.0)",
    );
  });

  it("conditionne les nouveaux supporters à la présence du Fan Club", () => {
    expect(migration).toContain("'fan_club_headquarters'");
    expect(migration).toContain("when v_fan_club_level >= 1");
    expect(migration).toContain("if v_fans > 0 then");
  });
});
