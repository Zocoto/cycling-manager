import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { STAFF_TALENTS_BY_ROLE } from "@/lib/game/staff-talents";

const projectRoot = process.cwd();
const migrationPath = resolve(
  projectRoot,
  "supabase/migrations/20260909140000_fix_staff_affix_effect_parity.sql",
);
const parityMigration = readFileSync(migrationPath, "utf8").replaceAll(
  "\r\n",
  "\n",
);

function readProductionCorpus(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return readProductionCorpus(path);
      if (
        !statSync(path).isFile() ||
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".test.tsx")
      ) {
        return [];
      }
      if (!/\.(sql|ts|tsx)$/.test(entry.name)) return [];
      const source = readFileSync(path, "utf8");
      return path.endsWith("20260727160000_create_unique_staff_talents.sql")
        ? [
            source.replace(
              /insert into public\.staff_talent_catalog[\s\S]*?;\s*create table public\.staff_member_talents/,
              "create table public.staff_member_talents",
            ),
          ]
        : [source];
    })
    .join("\n");
}

describe("staff affix effect parity", () => {
  it("remplace l'affixe de maintenance et le désactive dans le catalogue", () => {
    expect(parityMigration).toContain(
      "set talent_code = 'architect_construction_cost'",
    );
    expect(parityMigration).toContain(
      "where code = 'architect_maintenance_cost'",
    );
    expect(parityMigration).toContain("set is_active = false");
  });

  it("expose en lot les effets exacts utilisés par les devis médicaux et architectes", () => {
    expect(parityMigration).toContain(
      "get_team_medical_staff_effective_quotes",
    );
    expect(parityMigration).toContain(
      "get_team_architect_effective_quotes",
    );
    expect(parityMigration).toContain("nutrition_supplement_capacity");
    expect(parityMigration).toContain("nutrition_supplement_effectiveness");
    expect(parityMigration).toContain("get_team_doctor_protocol_price");
    expect(parityMigration).toContain(
      "get_team_doctor_protocol_effectiveness",
    );
    expect(parityMigration).toContain("get_team_doctor_protocol_form_loss");
    expect(parityMigration).toContain("get_architect_adjusted_reduction");
  });

  it("conserve au moins un consommateur de production pour chaque affixe actif", () => {
    const corpus = [
      "app",
      "components",
      "lib",
      "services",
      "supabase/migrations",
    ]
      .map((directory) => readProductionCorpus(resolve(projectRoot, directory)))
      .join("\n");
    const activeCodes = Object.values(STAFF_TALENTS_BY_ROLE).flat();

    for (const code of activeCodes) {
      const occurrences = corpus.split(code).length - 1;
      expect(
        occurrences,
        `${code} doit être référencé par son catalogue et un consommateur`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
