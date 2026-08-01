import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801170000_fix_late_race_result_settlements.sql",
  ),
  "utf8",
);

describe("late race result settlement migration", () => {
  it("removes sporting completion from condition settlement", () => {
    expect(migration).toContain("v_completion_block");
    expect(migration).toContain(
      "v_definition := replace(v_definition, v_completion_block, '');",
    );
    expect(migration).toContain(
      "'public.settle_finished_race_conditions()'::regprocedure",
    );
  });

  it("detects only completed editions with missing expected results", () => {
    expect(migration).toContain(
      "get_incomplete_completed_race_edition_ids",
    );
    expect(migration).toContain("edition.status = 'completed'");
    expect(migration).toContain(
      "result.race_roster_id = expected.race_roster_id",
    );
    expect(migration).toContain(
      "when expected.competition_type = 'standard' then 2",
    );
  });

  it("keeps the repair detector private to the service role", () => {
    expect(migration).toMatch(/from public, anon, authenticated/);
    expect(migration).toMatch(/to service_role/);
  });
});
