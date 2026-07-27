import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260727171000_raise_equipment_partner_reputation_threshold.sql",
  ),
  "utf8",
);

describe("equipment partner reputation threshold migration", () => {
  it("allows signing from 50 reputation points", () => {
    expect(migration).toContain(
      "if coalesce(v_context.reputation_points, 0) < 50 then",
    );
    expect(migration).toContain(
      "Une réputation d’au moins 50 points est nécessaire pour signer.",
    );
  });
});
