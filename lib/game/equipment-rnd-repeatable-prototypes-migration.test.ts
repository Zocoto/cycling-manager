import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const startMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824150000_make_equipment_rnd_free_scalable_and_parallel.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");
const prototypeMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260830170000_repeat_name_and_resell_rnd_prototypes.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("repeatable named R&D prototypes migration", () => {
  it("keeps the same reference reusable and accepts owned prototypes", () => {
    expect(startMigration).toContain(
      "and acquisition_channel <> 'equipment_partner'",
    );
    expect(startMigration).toContain(
      "and (owner_team_id is null or owner_team_id = v_context.team_id)",
    );
    expect(startMigration).toContain(
      "Aucun exemplaire libre de cette référence n’est disponible.",
    );
    expect(startMigration).not.toContain(
      "unique (input_equipment_item_id)",
    );
  });

  it("stores a normalized custom name and applies it on settlement", () => {
    expect(prototypeMigration).toContain("add column if not exists prototype_name text");
    expect(prototypeMigration).toContain("char_length(prototype_name) between 3 and 60");
    expect(prototypeMigration).toContain(
      "public.start_current_team_equipment_rnd(\n  p_equipment_item_id uuid,\n  p_engineer_contract_id uuid,\n  p_prototype_name text",
    );
    expect(prototypeMigration).toContain("set prototype_name = v_prototype_name");
    expect(prototypeMigration).toContain(
      "nullif(btrim(v_project.prototype_name), '')",
    );
  });

  it("prices prototype bonuses and maluses with a signed scale", () => {
    expect(prototypeMigration).toContain(
      "create or replace function public.calculate_research_prototype_resale_price",
    );
    expect(prototypeMigration).toContain("scores.rating_power * 1000");
    expect(prototypeMigration).toContain("greatest(\n    100,");
    expect(prototypeMigration).not.toContain(
      "sum(greatest(value::numeric, 0))",
    );
  });

  it("only resells commercial equipment or a prototype owned by the team", () => {
    expect(prototypeMigration).toContain(
      "v_item.acquisition_channel = 'research_prototype'",
    );
    expect(prototypeMigration).toContain(
      "and v_item.owner_team_id = v_context.team_id",
    );
    expect(prototypeMigration).toContain(
      "public.calculate_research_prototype_resale_price(v_item.effect_payload)",
    );
  });
});
