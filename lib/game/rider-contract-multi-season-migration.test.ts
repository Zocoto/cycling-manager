import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260918180000_multi_season_rider_contract_renewals.sql",
  ),
  "utf8",
);
const action = readFileSync(
  join(process.cwd(), "app/jeu/transferts/actions.ts"),
  "utf8",
);
const roster = readFileSync(
  join(process.cwd(), "components/game/team-contract-management.tsx"),
  "utf8",
);
const riderProfile = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("multi-season rider renewals", () => {
  it("limits the requested term to S+2 and protects another team's future contract", () => {
    expect(migration).toContain("p_target_end_game_year > v_context.game_year + 2");
    expect(migration).toContain("future.status in ('planned', 'active')");
    expect(migration).toContain("future.id <> v_active.id");
    expect(migration).toContain("raise exception 'Un autre contrat couvre déjà cette période.'");
  });

  it("keeps today's salary unchanged and prices two guaranteed seasons at +25%", () => {
    expect(migration).toContain("and p_target_end_game_year = v_context.game_year + 2");
    expect(migration).toContain("round(v_base_salary * 1.25, 2)");
    expect(migration).toContain("v_existing.homegrown_salary_before_discount");
    expect(migration).toContain("set end_season_id = v_target_season_id");
    expect(migration).not.toMatch(/update\s+public\.rider_contracts[\s\S]*?where\s+contract\.id\s*=\s*v_active\.id/);
  });

  it("validates the requested end year server-side and exposes both choices", () => {
    expect(action).toContain('"renew_current_team_rider_until"');
    expect(action).toContain("Number.isInteger(targetEndSeasonYear)");
    expect(roster).toContain("rider.renewalOffers.map");
    expect(riderProfile).toContain("management.renewalOptions.map");
  });
});
