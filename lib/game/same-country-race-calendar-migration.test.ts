import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260925153000_space_same_country_standard_races.sql",
  ),
  "utf8",
);

describe("same-country race calendar spacing", () => {
  it("repairs every planned season before enabling the guard", () => {
    expect(migration).toContain("normalize_standard_race_country_spacing");
    expect(migration).toContain("where season.status = 'planned'");
    expect(migration).toContain("race.slug = 'mur-de-catalogne'");
    expect(migration).toContain("Des collisions entre courses du même pays subsistent");
  });

  it("keeps the dense-calendar exception narrow and explicit", () => {
    expect(migration).toContain("race_count >= 8");
    expect(migration).toContain("race_format = 'one_day'");
    expect(migration).toContain("stage.profile_type = 'cobbles'");
    expect(migration).toContain("is_grand_tour");
  });

  it("guards both direct schedules and federation-created races", () => {
    expect(migration).toContain("create constraint trigger enforce_standard_race_country_spacing");
    expect(migration).toContain("deferrable initially deferred");
    expect(migration).toContain("enforce_federation_race_project_country_spacing");
    expect(migration).toContain("Une course du même pays");
  });
});
