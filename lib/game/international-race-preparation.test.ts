import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const preparationPage = read("app/jeu/preparation-course/page.tsx");
const workspace = read("components/game/race-preparation-workspace.tsx");
const calendarService = read("services/race-calendar.ts");
const raceProfile = read("app/jeu/courses/[slug]/race-profile-content.tsx");
const preparationTriggerMigration = read(
  "supabase/migrations/20260809160000_expose_ratings_and_block_time_trial_race_preparation.sql",
);
const migration = read(
  "supabase/migrations/20260904022000_disable_international_road_team_preparation.sql",
);
const federationEquipmentMigration = read(
  "supabase/migrations/20260920170000_create_federation_equipment_and_race_preparation.sql",
);
const federationRoadGuardMigration = read(
  "supabase/migrations/20260925123000_allow_federation_international_road_preparation.sql",
);

describe("international race preparation boundaries", () => {
  it("removes every international race from the club preparation workspace", () => {
    expect(preparationPage).toContain("isRacePreparationStageAvailable");
    expect(preparationPage).toContain("flatMap((edition)");
    expect(workspace).toContain("if (!isPreparationAvailable) return null");
  });

  it("keeps international profiles routed through federation selections", () => {
    const internationalPanelIndex = raceProfile.indexOf(
      "if (isInternationalChampionshipEdition(edition))",
    );
    const preparationLinkIndex = raceProfile.indexOf(
      "`/jeu/preparation-course?course=${edition.slug}`",
    );

    expect(internationalPanelIndex).toBeGreaterThan(-1);
    expect(preparationLinkIndex).toBeGreaterThan(internationalPanelIndex);
  });

  it("keeps club tactics blocked while allowing linked federation road plans", () => {
    expect(preparationTriggerMigration).toContain(
      "race_stage_strategies_reject_time_trial",
    );
    expect(preparationTriggerMigration).toContain(
      "race_roster_stage_roles_reject_time_trial",
    );
    expect(migration).toContain(
      "create or replace function public.reject_time_trial_race_preparation()",
    );
    expect(migration).toContain("'continental_championship'");
    expect(migration).toContain("'world_championship'");
    expect(migration).toContain(
      "Course internationale : les consignes collectives sont gerees par la selection nationale.",
    );
    expect(federationRoadGuardMigration).toContain(
      "create or replace function public.reject_time_trial_race_preparation()",
    );
    expect(federationRoadGuardMigration).toContain(
      "national_federation_selection_race_links",
    );
    expect(federationRoadGuardMigration).toContain(
      "registration.team_season_id is null",
    );
    expect(federationRoadGuardMigration).toContain(
      "slot.rider_category = 'professional'",
    );
    expect(federationRoadGuardMigration).toContain(
      "and not v_is_federation_registration",
    );
    expect(federationRoadGuardMigration).toContain("'nations_cup'");
    expect(federationRoadGuardMigration).toContain(
      "'individual_time_trial'",
    );
  });

  it("feeds federation time-trial plans to international simulations", () => {
    const timeTrialPlanBlock = calendarService.slice(
      calendarService.indexOf("...(timeTrialPlansByStageId.has(stage.id)"),
      calendarService.indexOf("segments: removeOneDayRaceMountainPrimes"),
    );

    expect(timeTrialPlanBlock).toContain("timeTrialPlans:");
    expect(timeTrialPlanBlock).not.toContain("competition_type");
    expect(federationEquipmentMigration).toContain(
      "save_national_federation_time_trial_preparation",
    );
    expect(federationEquipmentMigration).toContain(
      "Ce contre-la-montre international est préparé par la sélection nationale.",
    );
  });

  it("feeds federation road roles and strategies to international simulations", () => {
    expect(calendarService).toContain("riderRoleOverrides:");
    expect(calendarService).toContain("teamStrategies:");
    expect(federationEquipmentMigration).toContain(
      "save_national_federation_race_preparation",
    );
    expect(federationRoadGuardMigration).not.toContain(
      "drop trigger race_stage_strategies_reject_time_trial",
    );
    expect(federationRoadGuardMigration).not.toContain(
      "drop trigger race_roster_stage_roles_reject_time_trial",
    );
  });

  it("does not create dashboard reminders for disabled road plans", () => {
    expect(migration).toContain("get_current_dashboard_assistant_summary()");
    expect(migration).toContain("stage.stage_type in (");
    expect(migration).toContain("or race.competition_type not in (");
  });
});
