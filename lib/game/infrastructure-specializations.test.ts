import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  getInfrastructureSpecializationPowerPercentage,
  getInfrastructureSpecializationProposal,
  isInfrastructureSpecializationChoice,
} from "./infrastructure-specializations";

const root = process.cwd();

describe("infrastructure specializations", () => {
  it("covers every standard team and federation building with three balanced choices", () => {
    expect(TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS).toHaveLength(13);
    expect(FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS).toHaveLength(9);
    for (const proposal of [
      ...TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
      ...FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
    ]) {
      expect(proposal.options).toHaveLength(3);
      expect(new Set(proposal.options.map((option) => option.code)).size).toBe(3);
      expect(proposal.options.every((option) => option.powerBudget === 100)).toBe(true);
    }
  });

  it("scales the specialization at levels 3, 4 and 5", () => {
    expect(getInfrastructureSpecializationPowerPercentage(2)).toBe(0);
    expect(getInfrastructureSpecializationPowerPercentage(3)).toBe(60);
    expect(getInfrastructureSpecializationPowerPercentage(4)).toBe(80);
    expect(getInfrastructureSpecializationPowerPercentage(5)).toBe(100);
    expect(getInfrastructureSpecializationPowerPercentage(7)).toBe(100);
  });

  it("validates a choice against its scope and building", () => {
    expect(
      isInfrastructureSpecializationChoice(
        "team",
        "training_center",
        "individualization",
      ),
    ).toBe(true);
    expect(
      isInfrastructureSpecializationChoice(
        "federation",
        "training_center",
        "individualization",
      ),
    ).toBe(false);
    expect(
      getInfrastructureSpecializationProposal(
        "federation",
        "national_detection_network",
      )?.options[0].code,
    ).toBe("territorial_coverage");
  });

  it("persists choices through authenticated, season-bounded RPCs", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260907200000_create_infrastructure_specializations.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("create table public.team_infrastructure_specializations");
    expect(migration).toContain(
      "create table public.national_federation_infrastructure_specializations",
    );
    expect(migration).toContain(
      "create or replace function public.choose_current_team_infrastructure_specialization",
    );
    expect(migration).toContain(
      "create or replace function public.choose_national_federation_infrastructure_specialization",
    );
    expect(migration).toContain("v_existing.last_selected_season_id = v_context.season_id");
    expect(migration).toContain("v_existing.last_selected_season_id = v_season.id");
    expect(migration).toContain("v_current_game_day + 7");
    expect(migration).toContain("season.game_year >= 3");
  });

  it("embeds a collapsed specialization section inside each real building card", () => {
    const teamPage = readFileSync(
      join(root, "app/jeu/infrastructures/page.tsx"),
      "utf8",
    );
    const federationCatalog = readFileSync(
      join(root, "components/game/federation-infrastructure-catalog.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(root, "components/game/infrastructure-specialization-panel.tsx"),
      "utf8",
    );
    const federationCard = federationCatalog.slice(
      federationCatalog.indexOf("function FederationInfrastructureCard"),
      federationCatalog.indexOf("function ActiveProjectPanel"),
    );

    expect(teamPage).toMatch(
      /<InfrastructureBuildingCard[\s\S]*?<InfrastructureSpecializationPanel[\s\S]*?<\/InfrastructureBuildingCard>/,
    );
    expect(teamPage).toMatch(
      /<DataRoomConstructionCard[\s\S]*?<InfrastructureSpecializationPanel[\s\S]*?<\/DataRoomConstructionCard>/,
    );
    expect(teamPage).toMatch(
      /<StaffAcademyCard[\s\S]*?<InfrastructureSpecializationPanel[\s\S]*?<\/StaffAcademyCard>/,
    );
    expect(federationCard).toContain("<InfrastructureSpecializationPanel");
    expect(panel).toContain('<details className="group border-t');
    expect(panel).toContain("<summary");
    expect(panel).not.toContain("shadow-[0_12px_32px");
    expect(teamPage).not.toContain("laboratoire-specialisations");
  });
});
