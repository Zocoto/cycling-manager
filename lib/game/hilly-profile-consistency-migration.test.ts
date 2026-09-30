import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260930220000_repair_hilly_profile_consistency.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalizedMigration = migration.replaceAll("\r\n", "\n");

describe("cohérence des profils vallonnés", () => {
  it("répare uniquement les étapes futures non verrouillées", () => {
    expect(normalizedMigration).toContain("stage.status = 'planned'");
    expect(normalizedMigration).toContain(
      "edition.status not in ('completed', 'cancelled')",
    );
    expect(normalizedMigration).toContain(
      "not exists (\n      select 1 from public.stage_results",
    );
    expect(normalizedMigration).toContain(
      "not exists (\n      select 1 from public.official_stage_simulations",
    );
  });

  it("plafonne la côte finale sans changer la distance totale", () => {
    expect(normalizedMigration).toContain(
      "least(12::numeric, approach.distance_km) as repaired_approach_distance_km",
    );
    expect(normalizedMigration).toContain(
      "recipient.distance_km + repair.transferred_distance_km",
    );
    expect(normalizedMigration).toContain(
      "abs(measured.distance_km - repair.expected_distance_km) > 0.05",
    );
  });

  it("aligne la classique arctique sur son véritable profil montagneux", () => {
    expect(normalizedMigration).toContain(
      "race.slug = 'arctic-endurance-classic'",
    );
    expect(normalizedMigration).toContain("set profile_type = 'mountain'");
  });
});
