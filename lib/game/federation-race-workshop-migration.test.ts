import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904150000_create_federation_race_workshop.sql",
  ),
  "utf8",
);
const workflowMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260914100000_rebuild_federation_race_workflow.sql",
  ),
  "utf8",
);
const action = readFileSync(
  join(process.cwd(), "app/jeu/federations/governance-actions.ts"),
  "utf8",
);
const panel = readFileSync(
  join(process.cwd(), "components/game/federation-race-creation-panel.tsx"),
  "utf8",
);

describe("federation race workshop", () => {
  it("gates one exceptional creation behind S4, the presidency, the office and score", () => {
    expect(migration).toContain("v_season.game_year < 4");
    expect(migration).toContain("term.governance_mode = 'elected'");
    expect(migration).toContain("race_organization_office");
    expect(migration).toContain("get_national_federation_race_creation_score");
    expect(migration).toContain("v_completed_objectives * 15");
    expect(migration).toContain("v_existing_races * 10");
    expect(migration).toContain("unique (country_id, submitted_season_id)");
  });

  it("excludes Elite and World and creates the complete next-season profile", () => {
    expect(migration).toContain(
      "p_category_code not in ('continental', 'national', 'regional')",
    );
    expect(migration).toContain("select public.ensure_transfer_next_season");
    expect(migration).toContain("insert into public.race_editions");
    expect(migration).toContain("insert into public.stages");
    expect(migration).toContain("insert into public.stage_segments");
    expect(migration).toContain("averageGradientPct");
    expect(migration).toContain("activate_scheduled_national_federation_races");
  });

  it("validates the same bounded blueprint in the action and exposes it in governance", () => {
    expect(action).toContain("raceBlueprintSchema");
    expect(action).toContain("save_national_federation_race_draft");
    expect(panel).toContain("Créer une course du pays");
    expect(panel).toContain("Homologation fédérale · active en Saison 4");
    expect(panel).toContain("Ajouter un tronçon");
    expect(panel).toContain("Bureau d’organisation");
  });

  it("uses a draft, a costly 24-hour member vote and an autonomous settlement", () => {
    expect(workflowMigration).toContain("status in ('draft', 'voting', 'scheduled', 'active', 'rejected', 'cancelled')");
    expect(workflowMigration).toContain("now() + interval '24 hours'");
    expect(workflowMigration).toContain("creation_cost");
    expect(workflowMigration).toContain("reputation_cost");
    expect(workflowMigration).toContain("annual_maintenance_cost");
    expect(workflowMigration).toContain("national_federation_race_electorate");
    expect(workflowMigration).toContain("private.create_team_operational_message");
    expect(workflowMigration).toContain("settle_due_national_federation_race_votes");
    expect(workflowMigration).toContain("settle_due_national_federation_race_maintenance");
  });

  it("protects international dates and preserves approved races in future seasons", () => {
    expect(workflowMigration).toContain("'national_road', 'national_time_trial', 'continental_championship'");
    expect(workflowMigration).toContain("'world_championship', 'nations_cup'");
    expect(workflowMigration).toContain("'nations_cup_junior'");
    expect(workflowMigration).toContain("La vague de J% est déjà complète");
    expect(workflowMigration).toContain("prevent_cancelled_federation_race_edition");
    expect(workflowMigration).toContain("preserve_federation_race_stage_schedule");
    expect(panel).toContain("Calendrier territorial");
    expect(panel).toContain("Soumettre au vote pendant 24 h");
  });
});
