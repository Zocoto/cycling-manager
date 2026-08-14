import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260809160000_expose_ratings_and_block_time_trial_race_preparation.sql",
  ),
  "utf8",
);

const timeTrialMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260814160000_add_time_trial_race_preparations.sql",
  ),
  "utf8",
);

const workspace = readFileSync(
  join(
    process.cwd(),
    "components/game/race-preparation-workspace.tsx",
  ),
  "utf8",
);

describe("race preparation console migration", () => {
  it("exposes every current rider rating", () => {
    for (const rating of [
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
    ]) {
      expect(migration).toContain(`rating.${rating}::integer`);
    }
  });

  it("blocks both time-trial formats and prologues at database level", () => {
    expect(migration).toContain("reject_time_trial_race_preparation");
    expect(migration).toContain("'individual_time_trial'");
    expect(migration).toContain("'team_time_trial'");
    expect(migration).toContain("'prologue'");
    expect(migration).toContain("race_stage_strategies_reject_time_trial");
    expect(migration).toContain("race_roster_stage_roles_reject_time_trial");
  });

  it("shows rider ratings beside the role selector", () => {
    expect(workspace).toContain("<RiderRatingsGrid ratings={rider.ratings} />");
    expect(workspace).toContain('aria-label="Notes du coureur"');
    expect(workspace).toContain("RACE_PREPARATION_RATING_AXES.map");
  });

  it("replaces the historical block with a dedicated time-trial form", () => {
    expect(workspace).toContain("<TimeTrialPreparationForm");
    expect(workspace).toContain("Total des relais");
    expect(workspace).toContain("TIME_TRIAL_EFFORT_MODES.map");
    expect(workspace).not.toContain("Chrono : pas de planification");
  });

  it("persists complete time-trial plans and enforces a 100 percent relay total", () => {
    expect(timeTrialMigration).toContain(
      "create table public.race_time_trial_rider_plans",
    );
    expect(timeTrialMigration).toContain(
      "save_current_team_time_trial_preparation",
    );
    expect(timeTrialMigration).toContain("v_relay_total is distinct from 100");
    expect(timeTrialMigration).toContain("calculate_prepared_stage_form_cost");
  });
});
