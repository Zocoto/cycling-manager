import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260831200000_reward_team_time_trials_by_team.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const service = readFileSync(
  resolve(process.cwd(), "services/race-results.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

const restorationMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260901000000_restore_past_team_time_trial_rewards.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("récompenses des CLM par équipes", () => {
  it("classe une fois chaque équipe et applique le barème à son rang", () => {
    expect(migration).toContain("min(result.elapsed_time_ms) as team_time_ms");
    expect(migration).toContain("partition by team_time.stage_id");
    expect(migration).toContain("as team_rank");
    expect(migration).toContain("when context.team_rank = 1 then 12000");
    expect(migration).toContain("when context.team_rank = 2 then 80");
  });

  it("journalise le gain sur l'équipe sans fabriquer de bénéficiaire coureur", () => {
    const functionDefinition = migration.slice(
      migration.indexOf(
        "create or replace function public.apply_team_time_trial_stage_reward",
      ),
      migration.indexOf(
        "revoke all on function public.apply_team_time_trial_stage_reward",
      ),
    );

    expect(functionDefinition).toContain(
      "source_stage.stage_type = 'team_time_trial'",
    );
    expect(functionDefinition).toMatch(/rider_id,[\s\S]*?country_id,[\s\S]*?null,[\s\S]*?null,/);
    expect(functionDefinition).not.toContain("rider_season_summaries");
    expect(functionDefinition).toContain(
      "experience_points = experience_points + greatest(0, p_experience_points)",
    );
  });

  it("neutralise les anciens gains individuels avant la régularisation", () => {
    expect(migration).toContain("ttt_legacy_rider_rewards");
    expect(migration).toContain("official-stage-prize:%:stage:");
    expect(migration).toContain("official-stage-sporting:%:stage:");
    expect(migration).toContain("delete from public.reward_events as reward");
    expect(migration).toContain("official-ttt-stage:");
  });

  it("court-circuite le règlement individuel uniquement pour les TTT", () => {
    expect(service).toContain('stage.stageType === "team_time_trial"');
    expect(service).toContain(
      "shouldRewardTeamTimeTrialByTeam(stage.departureAt)",
    );
    expect(service).toContain("await persistTeamTimeTrialStageRewards");
    expect(service).toContain("continue;");
    expect(service).toContain('"apply_team_time_trial_stage_reward"');
    expect(service).toContain("p_experience_points: reward.experience");
  });

  it("restaure les gains historiques et borne la bascule au lendemain", () => {
    expect(restorationMigration).toContain("2026-08-31 22:00:00+00");
    expect(restorationMigration).toContain("ttt_collective_rewards_to_restore");
    expect(restorationMigration).toContain(
      "public.apply_race_roster_competition_reward",
    );
    expect(restorationMigration).toContain("official-stage-prize:");
    expect(restorationMigration).toContain("official-stage-sporting:");
    expect(restorationMigration).toContain(
      "delete from public.reward_events as reward",
    );
  });
});
