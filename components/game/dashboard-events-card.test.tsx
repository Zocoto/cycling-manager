import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardEventsCard } from "./dashboard-events-card";
import type { DashboardEvent } from "@/lib/game/dashboard-events";

function createDashboardEvent(index: number): DashboardEvent {
  return {
    id: `event-${index}`,
    category: "race",
    priority: "update",
    title: `Actualité ${index}`,
    description: `Description ${index}`,
    href: "/jeu/resultats",
    actionLabel: "Consulter",
    dayNumber: index,
    happenedAt: null,
  };
}

describe("DashboardEventsCard", () => {
  it("n’affiche plus le compteur « à traiter » dans le bandeau supérieur", () => {
    const markup = renderToStaticMarkup(
      <DashboardEventsCard
        events={[
          {
            id: "contract-expiry:rider-1",
            category: "contract",
            priority: "action",
            title: "Contrat à renouveler",
            description: "Aucun contrat pour la saison suivante.",
            href: "/jeu/coureurs/rider-1",
            actionLabel: "Voir le contrat",
            badgeLabel: "Contrat",
            dayNumber: 21,
            happenedAt: null,
          },
        ]}
      />
    );

    expect(markup).toContain("1 actualité");
    expect(markup).toContain("Contrat à renouveler");
    expect(markup.toLocaleLowerCase("fr")).not.toContain("à traiter");
  });

  it("limite toujours le fil à cinq actualités visibles", () => {
    const markup = renderToStaticMarkup(
      <DashboardEventsCard
        events={Array.from(
          { length: 7 },
          (_, index) =>
            createDashboardEvent(index + 1),
        )}
      />
    );

    expect(markup).toContain("7 actualités");
    expect(markup).toContain("Actualité 5");
    expect(markup).not.toContain("Actualité 6");
    expect(markup).not.toContain("Actualité 7");
    expect(markup).toContain("Plus anciennes");
    expect(markup).toContain("Plus récentes");
    expect(markup).toContain("Actualités 1 à 5 sur");
  });

  it("n’affiche pas de navigation avec cinq actualités ou moins", () => {
    const markup = renderToStaticMarkup(
      <DashboardEventsCard
        events={Array.from(
          { length: 5 },
          (_, index) =>
            createDashboardEvent(index + 1),
        )}
      />
    );

    expect(markup).toContain("Actualité 5");
    expect(markup).not.toContain("Plus anciennes");
    expect(markup).not.toContain("Plus récentes");
  });
});
