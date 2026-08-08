import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260808150000_fix_daily_nutrition_settlement.sql",
  ),
  "utf8",
);

describe("correctif du règlement nutritionnel quotidien", () => {
  it("branche explicitement le bonus dans le règlement de santé", () => {
    expect(migration).toContain(
      "perform public.settle_due_daily_nutrition_recovery();",
    );
    expect(migration).toContain("regexp_replace");
    expect(migration).toContain(
      "Impossible de brancher le règlement nutritionnel quotidien.",
    );
  });

  it("contrôle la définition installée et rattrape les journées manquées", () => {
    const definitionReads = migration.match(/select pg_get_functiondef/g) ?? [];

    expect(definitionReads).toHaveLength(2);
    expect(migration).toMatch(
      /select public\.settle_due_daily_nutrition_recovery\(\);/,
    );
  });
});
