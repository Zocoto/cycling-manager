import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InfrastructureBuildingCard } from "./infrastructure-building-card";
import {
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  getTeamInfrastructureCodesByStartingCost,
} from "@/lib/game/infrastructure";
import type { InfrastructureArchitect } from "@/services/team-infrastructures";

const definition = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center;
const nextLevel = definition.levels[0];
const architect: InfrastructureArchitect = {
  contractId: "11111111-1111-4111-8111-111111111111",
  firstName: "Louise",
  lastName: "Martin",
  level: 3,
  specialty: "balanced",
  specialtyLabel: "Équilibré",
  hasParallelConstructionTalent: false,
  buildingEfficiencyBonusPercentage: 0,
  costReductionPercentage: 12,
  durationReductionPercentage: 12,
};

function renderCard(
  balance = nextLevel.cost,
  architects: InfrastructureArchitect[] = [],
) {
  return renderToStaticMarkup(
    <InfrastructureBuildingCard
      definition={definition}
      currentLevel={0}
      nextLevel={nextLevel}
      architects={architects}
      activeProjects={[]}
      directorLevel={10}
      balance={balance}
      currency="EUR"
    />,
  );
}

describe("InfrastructureBuildingCard", () => {
  it("allows construction when no architect is available", () => {
    const markup = renderCard();
    const submitButton = markup.match(
      /<button[^>]*type="submit"[^>]*>Lancer le niveau 1<\/button>/,
    )?.[0];

    expect(markup).toContain("Architecte (optionnel)");
    expect(markup).toContain("Sans architecte");
    expect(submitButton).toBeDefined();
    expect(submitButton).not.toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
  });

  it("still blocks construction when a real prerequisite is missing", () => {
    const markup = renderCard(nextLevel.cost - 1);
    const submitButton = markup.match(
      /<button[^>]*type="submit"[^>]*>Lancer le niveau 1<\/button>/,
    )?.[0];

    expect(markup).toContain("Tr\u00e9sorerie insuffisante.");
    expect(submitButton).toMatch(/\sdisabled(?:=""|(?=[\s>]))/);
  });

  it("offers the team architect on every standard building card", () => {
    const standardCodes = getTeamInfrastructureCodesByStartingCost().filter(
      (code) => code !== "recruitment_data_room" && code !== "staff_academy",
    );

    for (const code of standardCodes) {
      const standardDefinition = TEAM_INFRASTRUCTURE_DEFINITIONS[code];
      const standardNextLevel = standardDefinition.levels[0]!;
      const markup = renderToStaticMarkup(
        <InfrastructureBuildingCard
          definition={standardDefinition}
          currentLevel={0}
          nextLevel={standardNextLevel}
          architects={[architect]}
          activeProjects={[]}
          directorLevel={50}
          balance={10_000_000}
          currency="EUR"
        />,
      );

      expect(markup, code).toContain(`data-architect-selector="architect-${code}"`);
      expect(markup, code).toContain("Louise Martin");
      expect(markup, code).toContain(`value="${architect.contractId}"`);
    }
  });

  it("blocks a level 2 upgrade until the manager reaches level 20", () => {
    const levelTwo = definition.levels[1]!;
    const markup = renderToStaticMarkup(
      <InfrastructureBuildingCard
        definition={definition}
        currentLevel={1}
        nextLevel={levelTwo}
        architects={[]}
        activeProjects={[]}
        directorLevel={19}
        balance={levelTwo.cost}
        currency="EUR"
      />,
    );

    expect(markup).toContain(
      "Le niveau 20 de Directeur Sportif est requis pour construire le niveau 2.",
    );
    expect(markup).toMatch(/<button[^>]*disabled/);
  });
});
