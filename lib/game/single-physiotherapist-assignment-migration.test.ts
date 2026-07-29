import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729110000_enforce_single_physiotherapist_per_rider.sql",
  ),
  "utf8",
);

describe("single physiotherapist assignment migration", () => {
  it("repairs legacy duplicates and keeps the latest assignment", () => {
    expect(migration).toContain("partition by assignment.rider_id");
    expect(migration).toContain(
      "order by assignment.assigned_at desc, assignment.id desc",
    );
    expect(migration).toContain("ranked.assignment_rank > 1");
  });

  it("enforces one active assignment per rider in the database", () => {
    expect(migration).toContain(
      "create unique index if not exists staff_rider_assignments_one_active_physio_idx",
    );
    expect(migration).toContain(
      "on public.staff_rider_assignments (rider_id)",
    );
    expect(migration).toContain("where status = 'active'");
  });

  it("never sums physiotherapist bonuses", () => {
    expect(migration).toContain("coalesce(max(member.level), 0)");
    expect(migration).toContain("coalesce(round(max(");
    expect(migration).not.toContain("sum(member.level)");
    expect(migration).not.toContain("round(sum(");
  });
});