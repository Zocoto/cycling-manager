import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261001194000_optimize_due_race_job_discovery.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("race job discovery query", () => {
  it("sépare les modes pour ne jamais auditer les réparations en simulation", () => {
    expect(migration).toContain("if p_mode = 'simulation' then");
    expect(migration).toContain("if p_mode = 'settlement' then");

    const simulationBranch = migration.slice(
      migration.indexOf("if p_mode = 'simulation' then"),
      migration.indexOf("if p_mode = 'settlement' then"),
    );
    expect(simulationBranch).not.toContain(
      "get_incomplete_completed_race_edition_ids",
    );
  });

  it("interroge les étapes indexées sans rescanner un CTE corrélé", () => {
    expect(migration).toContain("from public.stages as pending");
    expect(migration).toContain("pending.race_edition_id = edition.id");
    expect(migration).not.toContain("from stage_state as pending");
    expect(migration).not.toContain("from stage_state as unfinished");
  });

  it("conserve la reprise des classements terminés incomplets", () => {
    expect(migration).toContain(
      "public.get_incomplete_completed_race_edition_ids",
    );
    expect(migration).toContain("select temporal_due.race_edition_id");
    expect(migration).toContain("select repairable.race_edition_id");
  });
});
