import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260824144000_restore_bulk_wheel_interchangeability.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("montage inversé dans l’affectation groupée", () => {
  it("remplace l’égalité stricte par la règle centrale de compatibilité", () => {
    expect(migration).toContain(
      "public.save_current_team_equipment_assignments(jsonb)",
    );
    expect(migration).toContain(
      "public.equipment_slots_are_compatible(v_context.team_id, requested.slot, item.slot_type)",
    );
    expect(migration).toContain(
      "v_legacy_check constant text :=\n    'and item.slot_type = requested.slot'",
    );
  });

  it("interrompt la migration si la fonction optimisée change de forme", () => {
    expect(migration).toContain(
      "if v_patched_definition = v_definition then",
    );
    expect(migration).toContain(
      "La validation groupée du matériel a une définition inattendue.",
    );
  });
});
