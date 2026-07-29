import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DAILY_TRANSFER_RIDER_COUNT } from "@/lib/game/transfer-market";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729090000_expand_daily_transfer_market_to_ten_riders.sql",
  ),
  "utf8",
);

describe("daily auction count migration", () => {
  it("aligne la constante du jeu sur dix coureurs", () => {
    expect(DAILY_TRANSFER_RIDER_COUNT).toBe(10);
  });

  it("exige dix identités et crée dix annonces", () => {
    expect(migration).toContain(
      "jsonb_array_length(p_rider_identities) <> 10",
    );
    expect(migration).toContain("daily_slot between 1 and 10");
    expect(migration).toContain("return 10;");
  });

  it("conserve la cardinalité réelle des anciens lots à cinq", () => {
    expect(migration).toContain("rider_count in (5, 10)");
    expect(migration).not.toContain("update public.transfer_daily_batches");
  });
});
