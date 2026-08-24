import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const seniorTrainingMigration = read(
  "supabase/migrations/20260824141000_optimize_bulk_training_plans.sql",
);
const youthTrainingMigration = read(
  "supabase/migrations/20260824142000_optimize_bulk_youth_training_settings.sql",
);
const equipmentMigration = read(
  "supabase/migrations/20260824143000_optimize_bulk_equipment_assignments.sql",
);

describe("optimisation des actions groupées", () => {
  it("enregistre les entraînements seniors sans rappeler la fonction unitaire", () => {
    expect(seniorTrainingMigration).not.toContain(
      "public.save_current_rider_training_plan(",
    );
    expect(seniorTrainingMigration).toContain(
      "rider_training_plan_versions_team_season_latest_idx",
    );
    expect(seniorTrainingMigration).toContain("final_assignments as (");
    expect(seniorTrainingMigration).toContain(
      "on conflict (rider_id, season_id, effective_from_day_number)",
    );
    expect(seniorTrainingMigration).toContain("set statement_timeout = '0'");
  });

  it("synchronise la journée junior une seule fois puis effectue une mise à jour ensembliste", () => {
    expect(
      occurrenceCount(
        youthTrainingMigration,
        "perform public.sync_active_season_day();",
      ),
    ).toBe(1);
    expect(
      occurrenceCount(
        youthTrainingMigration,
        "perform public.activate_due_youth_training_modes(",
      ),
    ).toBe(1);
    expect(youthTrainingMigration).not.toContain(
      "public.save_current_youth_training_settings(",
    );
    expect(youthTrainingMigration).toContain(
      "update public.youth_academy_riders as academy",
    );
    expect(youthTrainingMigration).toContain("set statement_timeout = '0'");
  });

  it("régularise le matériel une fois et applique directement le stock final", () => {
    expect(
      occurrenceCount(
        equipmentMigration,
        "perform public.settle_due_equipment_assignments(",
      ),
    ).toBe(1);
    expect(equipmentMigration).not.toContain(
      "public.unequip_current_team_rider(",
    );
    expect(equipmentMigration).not.toContain(
      "public.equip_current_team_rider(",
    );
    expect(equipmentMigration).toContain("final_assignments as (");
    expect(equipmentMigration).toContain(
      "rider_equipment_assignments_item_rider_idx",
    );
    expect(equipmentMigration).toContain("set statement_timeout = '0'");
  });

  it.each([
    "app/jeu/entrainement/page.tsx",
    "app/jeu/centre-de-formation/page.tsx",
    "app/jeu/materiel/page.tsx",
    "app/jeu/materiel/equiper/page.tsx",
  ])("laisse aux actions de %s le temps d’achever leur transaction", (path) => {
    expect(read(path)).toContain("export const maxDuration = 300;");
  });
});

function occurrenceCount(source: string, needle: string) {
  return source.split(needle).length - 1;
}

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
