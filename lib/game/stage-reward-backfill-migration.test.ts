import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728203000_credit_historical_stage_results.sql",
  ),
  "utf8",
);

describe("historical stage sporting rewards migration", () => {
  it("cree une recompense idempotente par resultat d'etape", () => {
    expect(migration).toContain("official-stage-sporting:");
    expect(migration).toContain("on conflict (source_reference) do nothing");
    expect(migration).toContain("stage_result.rank = 1");
  });

  it("applique le meme bareme que le moteur de recompenses", () => {
    expect(migration).toContain("when stage_result.rank = 1 then 10");
    expect(migration).toContain("when stage_result.rank = 1 then 25");
    expect(migration).toContain("when stage_result.rank = 1 then 60");
    expect(migration).toContain("when stage_result.rank = 1 then 120");
  });

  it("credite les equipes, les coureurs et les classements UCI", () => {
    expect(migration).toContain(
      "set points = team_season.points + totals.uci_points",
    );
    expect(migration).toContain(
      "insert into public.rider_season_summaries",
    );
    expect(migration).toContain(
      "count(*) filter (where inserted.is_victory)",
    );
    expect(migration).toContain(
      "perform public.refresh_uci_rankings(target_season.season_id)",
    );
  });
});
