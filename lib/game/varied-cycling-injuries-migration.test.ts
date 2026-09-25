import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { RIDER_INJURY_DIAGNOSES } from "./health-center";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925140000_diversify_cycling_crash_injuries.sql",
  ),
  "utf8",
);
const healthCenterMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260721120000_create_health_center.sql",
  ),
  "utf8",
);
const injuryItemsMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260827110000_add_injury_care_items.sql",
  ),
  "utf8",
);

describe("varied cycling crash injuries migration", () => {
  it("accepts every current diagnosis and medical injury type", () => {
    for (const [code, diagnosis] of Object.entries(RIDER_INJURY_DIAGNOSES)) {
      expect(migration).toContain(`'${code}'`);
      expect(migration).toContain(`'${diagnosis.type}'`);
      expect(migration).toContain(diagnosis.label);
    }
    for (const code of [
      "legacy_fracture",
      "legacy_concussion",
      "legacy_contusion",
      "legacy_abrasions",
    ]) {
      expect(migration).toContain(`'${code}'`);
    }
  });

  it("extends daily medical penalties and both SQL-generated labels", () => {
    expect(migration).toContain("public.settle_current_health_and_form()");
    expect(migration).toContain("and injury.diagnosis_code <> ''fatigue_exhaustion''");
    expect(migration).toContain(
      "public.get_current_team_race_roster_options_before_reconnaissance(uuid)",
    );
    expect(migration).toContain("public.get_current_team_item_target_values()");
    expect(migration).toContain(
      "public.get_rider_injury_label(injury.diagnosis_code)",
    );
    expect(migration).toContain(
      "public.get_rider_injury_label(active_injury.diagnosis_code)",
    );
  });

  it("patches guarded medical blocks while tolerating SQL whitespace changes", () => {
    expect(migration.match(/pg_catalog\.regexp_replace/g)).toHaveLength(3);
    expect(migration).toContain("v_patched = v_definition");
    expect(migration).toContain("Le filtre des pénalités de blessure a changé.");
    expect(migration).toContain("Le libellé médical des inscriptions a changé.");
    expect(migration).toContain("Le libellé médical des objets de soin a changé.");
    expect(healthCenterMigration).toContain("injury.diagnosis_code in (");
    expect(healthCenterMigration).toContain("case injury.diagnosis_code");
    expect(injuryItemsMigration).toContain("case active_injury.diagnosis_code");
  });
});
