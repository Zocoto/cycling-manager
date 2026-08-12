import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const rewardsMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812140000_expand_development_team_rewards.sql",
  ),
  "utf8",
);

describe("Récompenses Development Team", () => {
  it("ajoute des paliers de participation, podiums et victoires", () => {
    for (const objective of [
      "development_first_registration",
      "development_calendar_complete",
      "development_first_podium",
      "development_podiums_10",
      "development_first_stage_win",
      "development_stage_wins_5",
      "development_victories_3",
      "development_victories_10",
    ]) {
      expect(rewardsMigration).toContain(`'${objective}'`);
    }
  });

  it("récompense aussi la formation collective et les grands titres", () => {
    expect(rewardsMigration).toContain("development_profile_wins_4");
    expect(rewardsMigration).toContain("development_unique_winners_3");
    expect(rewardsMigration).toContain("development_world_podiums_3");
    expect(rewardsMigration).toContain("development_double_world_title");
  });

  it("réserve les objets rares aux paliers exigeants", () => {
    expect(rewardsMigration).toContain("'mountain-focus'");
    expect(rewardsMigration).toContain("'acceleration-focus'");
    expect(rewardsMigration).toContain("'medallion-panache'");
    expect(rewardsMigration).toContain("'potential-notebook'");
    expect(rewardsMigration).toContain(
      "'development_double_world_title', 'secondary', 'development_team'",
    );
  });

  it("calcule les métriques uniquement sur les Development Teams du DS", () => {
    expect(rewardsMigration).toContain("development_race_podiums");
    expect(rewardsMigration).toContain("development_stage_wins");
    expect(rewardsMigration).toContain("development_profile_wins");
    expect(rewardsMigration).toContain("development_unique_winners");
    expect(rewardsMigration).toContain("development_world_podiums");
    expect(rewardsMigration).toContain(
      "assignment.sporting_director_id = p_director_id",
    );
  });
});
