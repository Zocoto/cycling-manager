import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260824213000_backfill_prix_releve_podium_progression.sql",
  "utf8",
);

describe("Prix de la Relève podium progression backfill", () => {
  it("keeps every SQL dollar-quoted block balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("targets only missing real riders from the final Prix de la Relève podium", () => {
    expect(migration).toContain("edition.slug = 'prix-de-la-releve'");
    expect(migration).toContain("result.result_scope = 'general'");
    expect(migration).toContain("result.rank between 1 and 3");
    expect(migration).toContain("result.academy_rider_id is not null");
    expect(migration).toContain("and not exists (");
    expect(migration).toContain(
      "from public.development_race_podium_progression as progression",
    );
  });

  it("reuses the production award function instead of duplicating its formula", () => {
    expect(migration).toMatch(
      /create trigger development_result_backfills_prix_releve_podium\r?\nafter update of rank/,
    );
    expect(migration).toContain(
      "execute function public.award_development_podium_progression()",
    );
    expect(migration).toContain("set rank = result.rank");
    expect(
      migration.match(
        /drop trigger if exists development_result_backfills_prix_releve_podium/g,
      ),
    ).toHaveLength(2);
  });

  it("rolls the migration back if an eligible podium reward remains missing", () => {
    expect(migration).toContain("get diagnostics v_awarded_count = row_count");
    expect(migration).toContain("if v_remaining_count <> 0 then");
    expect(migration).toContain("raise exception");
  });
});
