import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729130000_raise_equipment_partner_threshold_to_endgame.sql",
  ),
  "utf8",
);

describe("equipment partner endgame threshold migration", () => {
  it("requires 200 reputation points when signing on the server", () => {
    expect(migration).toContain(
      "if coalesce(v_context.reputation_points, 0) < 200 then",
    );
    expect(migration).toContain(
      "Une réputation d’au moins 200 points est nécessaire pour signer.",
    );
    expect(migration).not.toContain(
      "if coalesce(v_context.reputation_points, 0) < 50 then",
    );
  });
});
