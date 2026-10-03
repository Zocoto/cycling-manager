import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261003090000_reconcile_sponsor_objectives_after_official_replay.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("sponsor objective reconciliation after an official replay", () => {
  it("reopens only unsettled objectives attached to the corrected edition", () => {
    expect(migration).toContain(
      "public.reconcile_sponsor_race_objectives_for_edition(",
    );
    expect(migration).toContain("objective.objective_type = 'race_result'");
    expect(migration).toContain("progress.settled_at is null");
    expect(migration).toContain("status = 'in_progress'");
    expect(migration).toContain("set status = 'active'");
  });

  it("delegates the recalculation to the canonical sponsor evaluator", () => {
    expect(migration).toContain(
      "perform public.evaluate_sponsor_objectives_for_contract(",
    );
    expect(migration).toContain("v_contract.contract_id");
    expect(migration).toContain("false");
  });

  it("runs only after a guarded official replay reaches applied state", () => {
    expect(migration).toContain(
      "private.reconcile_sponsor_objectives_after_official_replay()",
    );
    expect(migration).toContain(
      "new.after_summary ->> 'status' = 'applied'",
    );
    expect(migration).toContain(
      "after update of after_summary on public.official_race_historical_corrections",
    );
  });

  it("backfills already applied replays without reopening settled seasons", () => {
    expect(migration).toContain("$backfill_applied_official_replays$");
    expect(migration).toContain(
      "select distinct correction.race_edition_id",
    );
    expect(migration).toContain(
      "correction.after_summary ->> 'status' = 'applied'",
    );
    expect(migration.match(/progress\.settled_at is null/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
