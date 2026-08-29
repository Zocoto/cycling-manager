import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getGameObjectiveLongTermTier } from "@/lib/game/objectives";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260829130000_add_hl_thl_training_health_objectives.sql",
  ),
  "utf8",
);

describe("HL and THL training and wellness objectives", () => {
  it.each([
    ["training_sessions", "completed_training_sessions", 500, 2500],
    ["nutrition_interventions", "nutrition_interventions", 100, 500],
    ["nutrition_form", "nutrition_form_gained", 500, 2500],
    ["physio_form_saved", "physio_form_saved", 500, 2500],
    ["treated_injuries", "treated_injuries", 25, 100],
  ] as const)(
    "adds durable %s milestones",
    (objectivePrefix, metricKey, hlTarget, thlTarget) => {
      expect(migration).toContain(`'${objectivePrefix}_hl'`);
      expect(migration).toContain(`'${objectivePrefix}_thl'`);
      expect(migration).toContain(`'${metricKey}', ${hlTarget}`);
      expect(migration).toContain(`'${metricKey}', ${thlTarget}`);
    },
  );

  it("counts each treated injury once across protocols and care items", () => {
    expect(migration).toContain(
      "count(distinct care.rider_injury_id)::integer",
    );
    expect(migration).toContain("from public.rider_injury_treatments");
    expect(migration).toContain(
      "from public.rider_injury_care_item_applications",
    );
  });

  it("reuses historical facts and indexes medical ownership lookups", () => {
    expect(migration).toContain(
      "rider_injury_treatments_team_season_injury_idx",
    );
    expect(migration).toContain(
      "rider_injury_care_applications_team_season_injury_idx",
    );
    expect(migration).toContain(
      "calculate_game_objective_progress_pre_hl_thl_wellness",
    );
  });

  it("exposes explicit HL and THL badges without altering ordinary objectives", () => {
    expect(getGameObjectiveLongTermTier("training_sessions_hl")).toBe("HL");
    expect(getGameObjectiveLongTermTier("training_sessions_thl")).toBe("THL");
    expect(getGameObjectiveLongTermTier("training_sessions_100")).toBeNull();
  });
});
