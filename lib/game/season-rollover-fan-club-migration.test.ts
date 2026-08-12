import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260811132000_settle_fan_club_at_season_end.sql",
  ),
  "utf8",
);

describe("season-end fan club settlement", () => {
  it("settles J28 sales before the financial closure trigger", () => {
    expect(migration).toContain("settle_team_fan_club_sales_for_day(new.id, 28)");
    expect(migration).toContain("aab_team_season_fan_club_sales_closure");
    expect([
      "bbb_team_season_financial_closure",
      "aab_team_season_fan_club_sales_closure",
      "aaa_team_season_sponsor_objective_closure",
    ].sort()).toEqual([
      "aaa_team_season_sponsor_objective_closure",
      "aab_team_season_fan_club_sales_closure",
      "bbb_team_season_financial_closure",
    ]);
    expect(migration).toContain("set cash_balance = cash_balance + v_total_revenue");
    expect(migration).toContain("last_settled_game_day = v_game_day");
  });

  it("keeps the global helper private and fixes training volatility", () => {
    expect(migration).toContain(
      "alter function public.get_training_effective_day_number(uuid) volatile",
    );
    expect(migration).toMatch(
      /revoke all on function public\.settle_team_fan_club_sales_for_day\(uuid, integer\)[\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toContain("to service_role");
  });
});
