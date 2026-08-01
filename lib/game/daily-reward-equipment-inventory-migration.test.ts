import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801180000_store_daily_reward_equipment_in_inventory.sql",
  ),
  "utf8",
);

describe("daily reward equipment inventory migration", () => {
  it("grants newly claimed equipment directly to the team inventory", () => {
    expect(migration).toContain(
      "if v_reward.effect_kind = 'equipment' then",
    );
    expect(migration).toContain(
      "insert into public.team_equipment_inventory",
    );
    expect(migration).toContain("'used'");
    expect(migration).toContain("'equipmentItemId', v_equipment.id");
    expect(migration).toContain(
      "a rejoint l’inventaire de l’équipe",
    );
  });

  it("moves legacy pending equipment rewards to the same inventory", () => {
    expect(migration).toContain("for v_reward in");
    expect(migration).toContain("catalog.effect_kind = 'equipment'");
    expect(migration).toContain("where inventory.status = 'available'");
    expect(migration).toContain("'migrated', true");
  });

  it("keeps the claim function protected", () => {
    expect(migration).toContain("security definer");
    expect(migration).toMatch(
      /from public, anon;[\s\S]*to authenticated;/,
    );
  });
});
