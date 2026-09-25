import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925113000_expand_stage_reconnaissance_bonus_range.sql",
  ),
  "utf8",
);

describe("plage des bonus de reconnaissance", () => {
  it("accepte les bonus cumulés du niveau, de la nationalité et du talent", () => {
    expect(migration).toContain(
      "preparer_bonus_percentage between 0 and 50",
    );
    expect(migration).toContain("bonus_points between 2 and 3");
    expect(migration).toContain("Repérage minutieux");
    expect(migration).toContain("maximum calculable de 2,88");
  });
});
