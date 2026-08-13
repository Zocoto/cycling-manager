import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814040000_apply_season_break_recovery.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("season break recovery", () => {
  it("recovers half of the missing form and resets fatigue on target-season day one", () => {
    expect(migration).toContain(
      "coalesce(previous_condition.form, 75)\n          + (100 - coalesce(previous_condition.form, 75)) * 0.5",
    );
    expect(migration).toContain("least(\n      100,");
    expect(migration).toContain("'season_break'");
    expect(migration).toContain("fatigue = excluded.fatigue");
    expect(migration).toContain("condition_day.season_id = p_source_season_id");
  });

  it("heals every active injury belonging to a rider carried into the target season", () => {
    expect(migration).toContain("update public.rider_injuries as injury");
    expect(migration).toContain("set status = 'recovered'");
    expect(migration).toContain("injury.status = 'active'");
    expect(migration).toContain("rating.season_id = p_target_season_id");
  });

  it("wires the rule into the atomic rollover and remains safe to replay", () => {
    expect(migration).toContain(
      "perform public.apply_season_break_recovery(v_source.id, v_target.id);",
    );
    expect(migration).toContain("on conflict (rider_id, season_day_id) do update set");
    expect(migration).toContain("v_target_game_year <> v_source_game_year + 1");
    expect(migration).toContain(
      "revoke all on function public.apply_season_break_recovery(uuid, uuid)",
    );
  });
});
