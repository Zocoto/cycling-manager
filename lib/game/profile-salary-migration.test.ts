import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261014140000_profile_based_future_rider_salaries.sql", "utf8");
it("ne recalcule aucun contrat signé pendant l’application du barème", () => {
  expect(sql).not.toMatch(/update\s+public\.rider_contracts/i);
  expect(sql).not.toMatch(/insert\s+into\s+public\.rider_contracts/i);
  expect(sql).toContain("for update skip locked");
  expect(sql).toContain("where b.listing_id=listing.id");
  expect(sql).toContain("Unexpected renewal definition");
});
