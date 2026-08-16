import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816130000_enforce_race_equipment_available_stock.sql",
  ),
  "utf8",
);

describe("race equipment available stock migration", () => {
  it("valide le stock après la construction complète du montage", () => {
    expect(migration).toContain(
      "create constraint trigger validate_race_stage_equipment_available_stock",
    );
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("after insert or update or delete");
  });

  it("réserve les équipements des coureurs hors course et les changements programmés", () => {
    expect(migration).toContain("external_equipped as");
    expect(migration).toContain(
      "from public.rider_equipment_pending_assignments as assignment",
    );
    expect(migration).toContain(
      "where roster.rider_id = assignment.rider_id",
    );
    expect(migration).toContain(
      "- coalesce(external_equipped.reserved_quantity, 0)",
    );
    expect(migration).toContain("- coalesce(pending.reserved_quantity, 0)");
  });

  it("ne déplace ni ne retire aucun équipement permanent", () => {
    expect(migration).not.toContain(
      "insert into public.rider_equipment_assignments",
    );
    expect(migration).not.toContain(
      "update public.rider_equipment_assignments",
    );
    expect(migration).not.toContain(
      "delete from public.rider_equipment_assignments",
    );
  });
});
