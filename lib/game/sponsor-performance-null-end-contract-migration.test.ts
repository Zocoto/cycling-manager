import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260915190000_fix_open_ended_sponsor_performance_awards.sql",
  ),
  "utf8",
).toLowerCase();

describe("open-ended sponsor performance awards", () => {
  it("uses the contractual duration when end_season_id is not materialized", () => {
    expect(migration).toContain("left join public.seasons as contract_end");
    expect(migration).toContain("contract_end.game_year,");
    expect(migration).toContain(
      "contract_start.game_year + contract.contract_duration_seasons - 1",
    );
  });

  it("keeps the race and sponsor-country reward rules", () => {
    expect(migration).toContain("public.get_sponsor_race_result_bonus");
    expect(migration).toContain(
      "v_team.sponsor_country_id = v_edition.race_country_id",
    );
    expect(migration).toContain("and v_team.best_rank = 1 then 2");
  });

  it("backfills completed S3+ races idempotently", () => {
    expect(migration).toContain("where edition.status = 'completed'");
    expect(migration).toContain("and season.game_year >= 3");
    expect(migration).toContain(
      "perform public.award_s3_sponsor_performance_satisfaction(v_edition_id)",
    );
    expect(migration).toContain(
      "on conflict (team_sponsor_contract_id, source_key) do nothing",
    );
  });
});
