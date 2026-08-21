import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821223000_add_sponsor_national_and_development_philosophies.sql",
  ),
  "utf8",
);

describe("sponsor philosophy expansion migration", () => {
  it("autorise les objectifs de formation sans remplacer le barème agrégé", () => {
    expect(migration).toContain("'youth_development'");
    expect(migration).toContain(
      "evaluate_sponsor_objectives_for_contract_pre_philosophies_20260821",
    );
    expect(migration).toContain(
      "create function public.evaluate_sponsor_objectives_for_contract_legacy_20260813",
    );
  });

  it("mesure chaque engagement depuis les données réelles de la saison", () => {
    for (const metric of [
      "promotions",
      "development_roster",
      "junior_race_wins",
      "homegrown_sales",
    ]) {
      expect(migration).toContain(`v_metric = '${metric}'`);
    }

    expect(migration).toContain("public.youth_academy_riders");
    expect(migration).toContain("public.development_team_roster");
    expect(migration).toContain("public.development_race_results");
    expect(migration).toContain("public.transfer_market_listings");
    expect(migration).toContain("listing.status = 'settled'");
    expect(migration).toContain(
      "academy.promoted_rider_id = listing.rider_id",
    );
  });

  it("répercute immédiatement les objectifs juniors sur la satisfaction", () => {
    expect(migration).toContain("satisfaction_score = v_satisfaction_score");
    expect(migration).toContain("developmentMetric");
  });
});
