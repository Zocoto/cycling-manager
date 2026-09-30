import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930120000_add_scouting_visibility_consumable.sql",
  ),
  "utf8",
);

describe("consommable de visibilité du scouting", () => {
  it("ajoute la Loupe du recruteur aux deux sources d’inventaire", () => {
    expect(migration).toContain("'scouting-clarity-pass'");
    expect(migration).toContain("'Loupe du recruteur'");
    expect(migration).toContain("'scouting_visibility'");
    expect(migration).toContain("'scouting-clarity'");
    expect(migration).toContain("public.daily_reward_catalog");
    expect(migration).toContain("public.inventory_catalog_items");
  });

  it("active exactement 24 heures et refuse de consommer un second objet", () => {
    expect(migration).toContain("v_duration_hours <> 24");
    expect(migration).toContain(
      "v_active_until := now() + make_interval(hours => v_duration_hours)",
    );
    expect(migration).toContain(
      "La vision complète est déjà active. Conservez cet objet pour plus tard.",
    );
    expect(migration).toMatch(
      /if v_context\.scouting_reports_revealed_until > now\(\)[\s\S]*select[\s\S]*from public\.daily_reward_inventory/,
    );
  });

  it("consomme atomiquement les inventaires quotidiens ou d’équipe", () => {
    expect(migration).toContain("for update of inventory");
    expect(migration).toContain("update public.daily_reward_inventory");
    expect(migration).toContain("delete from public.team_item_inventory");
    expect(migration).toContain("set quantity = quantity - 1");
    expect(migration).toContain("team_scouting_visibility_activations");
  });
});
