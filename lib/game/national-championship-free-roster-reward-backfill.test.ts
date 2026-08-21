import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821210000_backfill_managed_cn_free_roster_rewards.sql",
  ),
  "utf8",
);

describe("national championship free-roster reward backfill", () => {
  it("targets only rewarded CN results displayed as free riders", () => {
    expect(migration).toContain(
      "race.competition_type in ('national_road', 'national_time_trial')",
    );
    expect(migration).toContain("result.final_rank between 1 and 5");
    expect(migration).toContain("registration.team_season_id is null");
    expect(migration).toContain(
      "registration.historical_team_name = 'Coureurs libres'",
    );
  });

  it("requires a contract and manager that predate the championship", () => {
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain(
      "coalesce(contract.signed_at, contract.created_at) <= stage.departure_at",
    );
    expect(migration).toContain("assignment.role = 'general_manager'");
    expect(migration).toContain(
      "assignment.created_at <= stage.departure_at",
    );
  });

  it("uses the official CN scale without awarding UCI points", () => {
    expect(migration).toContain("when 1 then 125");
    expect(migration).toContain("when 2 then 75");
    expect(migration).toContain("when 3 then 45");
    expect(migration).toContain("when 1 then 10000::numeric");
    expect(migration).toContain("when 2 then 5000::numeric");
    expect(migration).toContain("when 3 then 2500::numeric");
    expect(migration).toMatch(/candidate\.cash_prize,\s+0,\s+candidate\.description/);
  });

  it("applies set-based aggregates only to newly inserted rewards", () => {
    expect(migration).toContain(
      "on conflict (source_reference) do nothing",
    );
    expect(migration).toContain("cn_free_roster_rewards_inserted");
    expect(migration).toContain(
      "join cn_free_roster_rewards_inserted as inserted",
    );
    expect(migration).not.toContain("perform public.apply_competition_reward");
    expect(migration).not.toContain("refresh_uci_rankings");
  });

  it("reports every actual catch-up by director and rider", () => {
    expect(migration).toContain("candidate.sporting_director_name");
    expect(migration).toContain("candidate.rider_name");
    expect(migration).toContain("RATTRAPAGE CN | DS:");
    expect(migration).toContain("RATTRAPAGE CN - TOTAL");
    expect(migration).toContain(
      "join cn_free_roster_rewards_inserted as inserted",
    );
  });

  it("does not rewrite historical registrations or results", () => {
    expect(migration).not.toContain("update public.race_registrations");
    expect(migration).not.toContain("update public.race_results");
    expect(migration).toContain(
      "'reward:' || candidate.source_reference",
    );
  });
});
