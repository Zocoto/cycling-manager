import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814020000_schedule_training_after_last_season_session.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const rollover = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260811130000_implement_atomic_season_rollover.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const actions = readFileSync(
  resolve(process.cwd(), "app/jeu/entrainement/actions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const page = readFileSync(
  resolve(process.cwd(), "app/jeu/entrainement/page.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("training scheduling after the final season session", () => {
  it("stores the post-J28 choice in a pending day 29 slot", () => {
    expect(migration).toContain(
      "check (effective_from_day_number between 1 and 29)",
    );
    expect(migration).toContain("return least(v_day.day_number + 1, 29)");
    expect(migration).not.toContain("if v_day.day_number >= 28");
  });

  it("carries the pending settings to next season day 1", () => {
    expect(rollover).toContain(
      "setting.team_id, v_target.id, setting.minimum_form, 1",
    );
    expect(rollover).toContain(
      "order by setting.team_id, setting.effective_from_day_number desc",
    );
    expect(rollover).toContain(
      "plan.rider_id, plan.team_id, v_target.id, plan.intensity, plan.domain",
    );
    expect(rollover).toContain(
      "order by plan.rider_id, plan.effective_from_day_number desc",
    );
  });

  it("keeps the helper volatile because it synchronizes the game day", () => {
    expect(migration).toContain("language plpgsql\nvolatile");
    expect(migration).toContain("perform public.sync_active_season_day()");
  });

  it("presents day 29 as the following day at 08:00", () => {
    expect(actions).toContain("effectiveDayNumber === 29");
    expect(actions).toContain("formatTrainingEffect(Number(data))");
    expect(page).toContain("minimumFormEffectiveFromDayNumber === 29");
    expect(page).toContain("rider.plan.effectiveFromDayNumber === 29");
  });
});
