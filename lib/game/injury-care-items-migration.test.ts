import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260827110000_add_injury_care_items.sql",
  ),
  "utf8",
);
const actions = fs.readFileSync(
  path.join(process.cwd(), "app/jeu/objectifs/actions.ts"),
  "utf8",
);

describe("injury care items migration", () => {
  it("creates only the five useful levels for three-to-five-day injuries", () => {
    for (const [level, hours] of [
      [1, 2],
      [2, 6],
      [3, 12],
      [4, 24],
      [5, 48],
    ]) {
      expect(migration).toContain(
        `'{"recoveryHours":${hours},"level":${level}}'::jsonb`,
      );
    }
    expect(migration).not.toContain('"level":6');
    expect(migration).not.toContain('"recoveryHours":72');
    expect(migration).toContain(
      "check (requested_recovery_hours between 1 and 48)",
    );
    expect(migration).toContain("where reward.effect_kind = 'injury_care'");
  });

  it("consumes either inventory source and locks the active injury", () => {
    expect(migration).toContain(
      "create or replace function public.redeem_injury_care_reward",
    );
    expect(migration).toContain("for update of inventory");
    expect(migration).toContain("for update of injury");
    expect(migration).toContain("delete from public.team_item_inventory");
    expect(migration).toContain("update public.daily_reward_inventory");
    expect(actions).toContain('"redeem_injury_care_reward"');
  });

  it("preserves fixed fatigue injuries and never overshoots the current time", () => {
    expect(migration).toContain(
      "if v_injury.diagnosis_code = 'fatigue_exhaustion' then",
    );
    expect(migration).toContain(
      "v_previous_recovery - make_interval(hours => v_recovery_hours)",
    );
    expect(migration).toContain("v_adjusted_recovery := greatest(");
    expect(migration).toContain("completed_injury");
  });

  it("keeps an auditable history and enriches the existing roster query", () => {
    expect(migration).toContain(
      "create table public.rider_injury_care_item_applications",
    );
    expect(migration).toContain(
      "create or replace function public.get_current_team_item_target_values",
    );
    expect(migration).toContain("'remainingHours'");
    expect(migration).toContain("'canShorten'");
  });
});
