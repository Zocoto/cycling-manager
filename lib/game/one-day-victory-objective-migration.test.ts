import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261001160000_count_pending_one_day_victories_in_game_objectives.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("one-day victory objective fallback migration", () => {
  it("counts an official one-day stage victory before final consolidation", () => {
    expect(migration).toContain("p_metric_key <> 'victories'");
    expect(migration).toContain("from public.stage_results as result");
    expect(migration).toContain("result.status = 'finished'");
    expect(migration).toContain("result.rank = 1");
  });

  it("does not double-count a one-day winner after race_results is created", () => {
    expect(migration).toContain("or not exists (");
    expect(migration).toContain("final_result.race_edition_id = stage.race_edition_id");
    expect(migration).toContain("final_result.race_roster_id = result.race_roster_id");
    expect(migration).toContain("final_result.final_rank = 1");
  });

  it("preserves stage wins and general-classification wins on tours", () => {
    expect(migration).toContain("from public.race_results as result");
    expect(migration).toContain("from public.stages as edition_stage");
    expect(migration).toContain(") > 1");
  });
});
