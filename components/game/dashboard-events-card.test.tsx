import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardEventsCard } from "./dashboard-events-card";

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
});
