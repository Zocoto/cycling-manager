import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260818070000_withdraw_j8_cn_underfilled_registrations.sql",
  ),
  "utf8",
);

describe("retrait des inscriptions J8 sous le contingent après les CN", () => {
  it("retire entièrement une inscription ordinaire devenue trop petite", () => {
    expect(migration).toContain(
      "withdraw_underfilled_race_registration_after_cn_conflict",
    );
    expect(migration).toContain(
      "v_active_roster_size >= v_minimum_roster_size",
    );
    expect(migration).toMatch(
      /update public\.race_rosters[\s\S]*?set status = 'withdrawn'[\s\S]*?update public\.race_registrations[\s\S]*?status = 'withdrawn'/,
    );
  });

  it("évalue uniquement les inscriptions réellement touchées par la priorité CN", () => {
    expect(migration).toContain("withdrawn_overlaps as (");
    expect(migration).toContain(
      "select distinct withdrawn.race_registration_id",
    );
    expect(migration).toMatch(
      /prioritize_national_championship_rider[\s\S]*?withdraw_underfilled_race_registration_after_cn_conflict/,
    );
  });

  it("régularise le J8 actif sans toucher aux championnats ni aux contingents valides", () => {
    expect(migration).toContain("ordinary_day.day_number = 8");
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain(
      "ordinary_race.competition_type not in (",
    );
    expect(migration).toContain(
      "cn_race.competition_type in (",
    );
    expect(migration).toContain(
      ") < coalesce(category.minimum_roster_size, 1)",
    );
    expect(migration).toContain(
      "cn_roster.rider_id = withdrawn_roster.rider_id",
    );
  });
});
