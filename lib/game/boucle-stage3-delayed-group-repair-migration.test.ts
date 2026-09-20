import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260920173000_prepare_boucle_stage3_delayed_group_repair.sql",
  ),
  "utf8",
);

describe("guarded Boucle des Provinces stage 3 repair", () => {
  it("is scoped to the audited edition, stage, next stage and engine versions", () => {
    expect(migration).toContain("716dad06-c144-47a7-afbc-68bff48f8e57");
    expect(migration).toContain("dc96b124-3b96-4393-ba55-c31f2915fef3");
    expect(migration).toContain("b493e2ed-4e31-401d-a17a-f839524d4a41");
    expect(migration).toContain("2026.09-leader-recovery-priority-v30");
    expect(migration).toContain("2026.09-delayed-group-energy-v31");
  });

  it("backs up the stage and every provisional secondary classification", () => {
    expect(migration).toContain("official_race_historical_corrections");
    expect(migration).toContain("stageResults");
    expect(migration).toContain("secondaryResults");
    expect(migration).toContain("race_secondary_results");
    expect(migration).toContain("attackParticipants");
    expect(migration).toContain("postRaceNews");
  });

  it("refuses a changed startlist, winner, availability or later-stage lock", () => {
    expect(migration).toContain("count(distinct result.value->>'riderId')");
    expect(migration).toContain("source.value->>'status'");
    expect(migration).toContain("source.value->'injury'");
    expect(migration).toContain("source.value->'abandonment'");
    expect(migration).toContain("official_stage_simulations where stage_id = v_next_stage");
  });

  it("is only executable by the service role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
