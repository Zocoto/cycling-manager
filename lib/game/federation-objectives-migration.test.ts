import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260918170000_refresh_federation_objective_score.sql"),
  "utf8",
);

describe("federation objective score parity", () => {
  it("n’annule pas les autres mesures si la naturalisation n’est pas lisible côté API", () => {
    expect(migration).toContain("grant select on table public.rider_naturalizations to service_role");
    expect(migration).toContain("manually_submitted_at is not null");
  });

  it("compte le rang de la poule senior et seulement les Mondiaux de la saison", () => {
    expect(migration).toContain("own.group_code is null then own.division_rank else own.group_rank");
    expect(migration).toContain("least(5, ceil(coalesce(v_nations_cup_pool_size, 0) * 0.6)");
    expect(migration).toContain("edition.season_id = p_season_id");
    expect(migration).toContain("race.competition_type = 'world_championship'");
  });

  it("réserve deux variantes stables à partir de la saison 4", () => {
    for (const variant of [
      "naturalizations", "championships", "continental", "junior_championships",
      "cycling_school", "team_uci", "rider_uci",
    ]) {
      expect(migration).toContain(`'${variant}'`);
    }
    expect(migration).toContain("get_byte(uuid_send(p_country_id), 0) + v_season.game_year");
    expect(migration).toContain("if v_season.game_year <= 3 then");
  });
});
