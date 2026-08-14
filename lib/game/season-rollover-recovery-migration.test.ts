import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814050000_finalize_s1_rollover.sql",
  ),
  "utf8",
);

describe("first production season rollover recovery", () => {
  it("keeps the extended timeout local to the recovery transaction", () => {
    expect(migration).toContain("set local statement_timeout = '5min'");
    expect(migration).toContain("select public.settle_due_season_rollovers()");
  });

  it("allows only the national road/time-trial pair for one country", () => {
    expect(migration).toContain("v_target_country_id = other_race.country_id");
    expect(migration).toContain(
      "v_target_competition_type = 'national_road'",
    );
    expect(migration).toContain(
      "other_race.competition_type = 'national_time_trial'",
    );
    expect(migration).toContain(
      "v_target_competition_type = 'national_time_trial'",
    );
    expect(migration).toContain(
      "other_race.competition_type = 'national_road'",
    );
  });
});
