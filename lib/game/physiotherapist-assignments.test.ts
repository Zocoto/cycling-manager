import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727170000_fix_incremental_physiotherapist_assignments.sql",
  ),
  "utf8",
);

describe("incremental physiotherapist assignments migration", () => {
  it("correlates the existing assignment with the requested rider", () => {
    expect(migration).toContain(
      "from unnest(v_rider_ids) as requested(rider_id)",
    );
    expect(migration).toContain(
      "existing.rider_id = requested.rider_id",
    );
  });

  it("keeps existing assignments and inserts only missing riders", () => {
    expect(migration).toContain(
      "existing.staff_contract_id = v_context.contract_id",
    );
    expect(migration).toContain(
      "and existing.status = 'active'",
    );
  });
});
