import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260810153000_add_world_time_trial_championship.sql",
  ),
  "utf8",
);

describe("championnat du monde contre-la-montre", () => {
  it("programme le CLM à J26 14 h avant la course en ligne de 18 h", () => {
    expect(migration).toContain("day.day_number = 26");
    expect(migration).toContain("interval '14 hours'");
    expect(migration).toContain("'individual_time_trial'");
    expect(migration).toContain("'time_trial'");
    expect(migration).toContain("'early'");
    expect(migration).toContain("'championnats-du-monde-contre-la-montre'");
    expect(migration).toContain("'Championnats du monde en ligne'");
  });

  it("classe la sélection CLM selon les qualités de rouleur", () => {
    expect(migration).toContain("rating.time_trial * 0.62");
    expect(migration).toContain("rating.prologue * 0.13");
    expect(migration).toContain("rerank_world_time_trial_selection");
    expect(migration).toContain(
      "rerank_world_time_trial_candidates_after_insert",
    );
    expect(migration).toContain("referencing new table as inserted_candidates");
  });

  it("autorise un même coureur à disputer les deux Mondiaux", () => {
    expect(migration).toContain(
      "race.competition_type = 'world_championship'",
    );
    expect(migration).toContain("set status = 'confirmed'");
    expect(migration).toContain(
      "prioritize_international_championship_rider_base",
    );
  });
});
