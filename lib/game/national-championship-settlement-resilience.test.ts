import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("national championship settlement resilience", () => {
  it("settles independent countries with bounded concurrency", () => {
    const source = readSource("services/race-results.ts");

    expect(source).toContain(
      "export const NATIONAL_CHAMPIONSHIP_SETTLEMENT_CONCURRENCY = 4",
    );
    expect(source).toContain("chunkValues(");
    expect(source).toContain("await Promise.all(editionBatch.map(settleEdition))");
  });

  it("enforces one active roster per rider and edition in the database", () => {
    const migration = readSource(
      "supabase/migrations/20260821171000_harden_national_championship_settlement.sql",
    );

    expect(migration).toContain(
      "enforce_unique_active_rider_per_race_edition",
    );
    expect(migration).toContain("other_registration.race_edition_id");
    expect(migration).toContain("other_roster.rider_id = new.rider_id");
    expect(migration).toContain("set status = 'withdrawn'");
  });
});
