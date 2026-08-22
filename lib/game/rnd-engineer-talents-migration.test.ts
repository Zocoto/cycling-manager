import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260822090000_fix_rnd_engineer_talents.sql",
  ),
  "utf8",
);

describe("R&D engineer talents migration", () => {
  it("keeps every SQL dollar-quoted block balanced", () => {
    expect(migration.match(/\$\$/g)?.length ?? 0).toBeGreaterThan(0);
    expect((migration.match(/\$\$/g)?.length ?? 0) % 2).toBe(0);
  });

  it("backfills only research engineers without a talent", () => {
    expect(migration).toContain("member.role = 'research_engineer'");
    expect(migration).toContain("not exists (");
    expect(migration).toContain("talent.staff_member_id = member.id");
    expect(migration).toContain("'generation'");
  });

  it("applies all three acquired talents independently", () => {
    for (const talent of [
      "research_time",
      "research_cost",
      "research_success",
    ]) {
      expect(migration).toContain(
        `coalesce(bool_or(talent.talent_code = '${talent}'), false)`,
      );
      expect(migration).toContain(`v_has_${talent}`);
    }

    expect(migration).not.toContain(
      "select member.level,talent.talent_code into",
    );
  });
});
