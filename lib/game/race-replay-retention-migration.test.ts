import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827150000_retain_active_season_replays_and_history.sql",
  ),
  "utf8",
);

describe("active-season replay retention", () => {
  it("purges only heavy simulations outside the active season", () => {
    expect(migration).toContain(
      "create or replace function public.purge_inactive_season_official_replays()",
    );
    expect(migration).toContain(
      "delete from public.official_stage_simulations as simulation",
    );
    expect(migration).toContain("season.status = 'active'");
    expect(migration).not.toMatch(/delete from public\.(race_results|stage_results)/);
  });

  it("exposes a lightweight authenticated historical classification", () => {
    expect(migration).toContain(
      "public.get_race_historical_classification(uuid, integer)",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("result.final_rank");
    expect(migration).toContain("result.gap_to_winner_ms");
  });
});
