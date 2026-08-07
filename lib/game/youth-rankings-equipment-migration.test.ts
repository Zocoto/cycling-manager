import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260807110000_fix_youth_rankings_and_equipment_assignments.sql",
  ),
  "utf8",
);

describe("migration classements jeunes et équipements", () => {
  it("reconstruit les jeunes depuis le classement final et régularise les gains", () => {
    expect(migration).toContain("status = 'classified'");
    expect(migration).toContain("classification_type = 'youth'");
    expect(migration).toContain("youth-ranking-correction:");
    expect(migration).toContain("apply_race_roster_competition_reward");
  });

  it("rend les changements d'équipement immédiats et vide les programmations", () => {
    expect(migration).toContain("insert into public.rider_equipment_assignments");
    expect(migration).toContain("delete from public.rider_equipment_pending_assignments");
    expect(migration).not.toContain("v_frozen_stage");
  });
});
