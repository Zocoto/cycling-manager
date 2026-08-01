import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260801190000_create_fast_dashboard_summary.sql",
  ),
  "utf8",
);

describe("dashboard fast summary migration", () => {
  it("regroupe les compteurs du premier rendu dans un seul RPC sécurisé", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_dashboard_fast_summary()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("where sporting_director.auth_user_id = auth.uid()");
    expect(migration).toContain(
      "grant execute on function public.get_current_dashboard_fast_summary() to authenticated",
    );
  });

  it("calcule les compteurs sans charger les catalogues complets", () => {
    expect(migration).toContain("inventory_available_units integer");
    expect(migration).toContain("objective_ready_count integer");
    expect(migration).toContain("trophy_reward_count integer");
    expect(migration).toContain("daily_reward_available boolean");
    expect(migration).not.toContain("inventory_catalog_items");
    expect(migration).not.toContain("equipment_catalog_items");
  });
});
