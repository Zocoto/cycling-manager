import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260818100000_restore_valitoni_vamonosss_roster.sql",
  ),
  "utf8",
);

describe("régénération bêta-test de l’effectif de Valitoni", () => {
  it("verrouille l’intervention sur le bon directeur et la bonne équipe", () => {
    expect(migration).toContain(
      "58cd307a-1f7f-4680-a519-eb6e7ba5498e",
    );
    expect(migration).toContain(
      "7f8aabc9-a95d-4387-b918-e9db63dc13ca",
    );
    expect(migration).toContain("lower('Valitoni')");
    expect(migration).toContain("lower('Vamonosss')");
    expect(migration).toContain("into strict");
  });

  it("refuse de compléter une équipe qui possède déjà un effectif", () => {
    expect(migration).toMatch(
      /from public\.rider_contracts[\s\S]*?contract\.team_id = v_team_id[\s\S]*?contract\.status in \('active', 'planned'\)[\s\S]*?raise exception/,
    );
  });

  it("génère sept identités avec le profil officiel norvégien", () => {
    expect(migration).toContain("country.iso_alpha2 = 'NO'");
    expect(migration).toContain("profile.name_profile_code = 'nordic'");
    expect(migration.match(/::bigint,/g)).toHaveLength(7);
    expect(migration).toContain("cardinality(v_created_rider_ids) <> 7");
  });

  it("reprend les contrats et les âges de l’onboarding", () => {
    expect(migration).toContain("18 + ((v_entry.rider_slot - 1 + v_age_offset) % 7)");
    expect(migration).toContain("'initial',");
    expect(migration).toContain("'active',");
    expect(migration).toContain("salary_per_season");
  });

  it("applique la randomisation officielle aux treize caractéristiques", () => {
    const axes = [
      "mountain",
      "hills",
      "flat",
      "time_trial",
      "cobbles",
      "sprint",
      "acceleration",
      "downhill",
      "endurance",
      "resistance",
      "recovery",
      "breakaway",
      "prologue",
    ];

    for (const axis of axes) {
      expect(migration).toContain(
        `rating.${axis}, v_team_id, rating.rider_id, '${axis}'`,
      );
    }
  });
});
