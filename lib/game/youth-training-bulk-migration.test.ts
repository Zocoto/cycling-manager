import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260810080000_add_bulk_youth_training_settings.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("migration des entraînements juniors groupés", () => {
  it("borne et valide le tableau reçu", () => {
    expect(migration).toContain("p_changes jsonb");
    expect(migration).toContain("jsonb_array_length(p_changes) < 1");
    expect(migration).toContain("jsonb_array_length(p_changes) > 100");
    expect(migration).toContain("v_training_mode not in ('automatic', 'manual')");
  });

  it("refuse les doublons avant toute validation", () => {
    expect(migration).toContain(
      "v_academy_rider_id = any(v_seen_rider_ids)",
    );
    expect(migration).toContain(
      "v_seen_rider_ids := array_append(v_seen_rider_ids, v_academy_rider_id)",
    );
  });

  it("réutilise la procédure sécurisée dans une transaction unique", () => {
    expect(migration).toContain(
      "perform public.save_current_youth_training_settings(",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("to authenticated, service_role");
  });
});
