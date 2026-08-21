import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InfrastructureBuildingCard } from "./infrastructure-building-card";
import { TEAM_INFRASTRUCTURE_DEFINITIONS } from "@/lib/game/infrastructure";

const definition = TEAM_INFRASTRUCTURE_DEFINITIONS.training_center;
const nextLevel = definition.levels[0];

function renderCard(balance = nextLevel.cost) {
  return renderToStaticMarkup(
    <InfrastructureBuildingCard
      definition={definition}
      currentLevel={0}
      nextLevel={nextLevel}
      architects={[]}
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
