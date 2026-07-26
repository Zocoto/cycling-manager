import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DashboardEvent } from "@/lib/game/dashboard-events";

import { DashboardEventsCard } from "./dashboard-events-card";

function createEvent(
  overrides: Partial<DashboardEvent> = {}
): DashboardEvent {
  return {
    id: "event-1",
    category: "race",
    priority: "update",
    title: "Course terminée",
    description: "Les résultats sont disponibles.",
    href: "/jeu/resultats/course",
    actionLabel: "Voir les résultats",
    dayNumber: 9,
    happenedAt: null,
    ...overrides,
  };
}

describe("DashboardEventsCard", () => {
  it("n’affiche plus le compteur « à traiter » dans le bandeau supérieur", () => {
    const markup = renderToStaticMarkup(
      <DashboardEventsCard
        events={[
          createEvent({
            id: "contract-expiry:rider-1",
            category: "contract",
            priority: "action",
            title: "Contrat à renouveler",
            description: "Aucun contrat pour la saison suivante.",
            href: "/jeu/coureurs/rider-1",
            actionLabel: "Voir le contrat",
            badgeLabel: "Contrat",
            dayNumber: 21,
          }),
        ]}
      />
    );

    expect(markup).toContain("1 actualité");
    expect(markup).toContain("Contrat à renouveler");
    expect(markup.toLocaleLowerCase("fr")).not.toContain("à traiter");
  });

  it("regroupe les événements similaires dans des lignes repliées par défaut", () => {
    const events = [
      createEvent({
        id: "injury:rider-1",
        category: "health",
        priority: "critical",
        title: "Premier coureur blessé",
      }),
      createEvent({
        id: "injury:rider-2",
        category: "health",
        priority: "critical",
        title: "Deuxième coureur blessé",
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        createEvent({
          id: `race-finished:${index + 1}`,
          title: `Course ${index + 1} terminée`,
        })
      ),
    ];
    const markup = renderToStaticMarkup(
      <DashboardEventsCard events={events} />
    );

    expect(markup).toContain("10 actualités");
    expect(markup).toContain("Santé de l’effectif");
    expect(markup).toContain("Courses et résultats");
    expect(markup.match(/<summary/g)).toHaveLength(2);
    expect(markup.match(/<details/g)).toHaveLength(2);
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|>)/);
  });

  it("ne dépasse jamais cinq lignes principales sans perdre les détails", () => {
    const categories: DashboardEvent["category"][] = [
      "health",
      "race",
      "contract",
      "training",
      "scouting",
      "finance",
      "academy",
      "infrastructure",
      "objective",
    ];
    const events = categories.map((category, index) =>
      createEvent({
        id: `${category}:${index}`,
        category,
        title: `Événement ${category}`,
      })
    );
    const markup = renderToStaticMarkup(
      <DashboardEventsCard events={events} />
    );

    expect(markup.match(/<summary/g)).toHaveLength(5);

    for (const event of events) {
      expect(markup).toContain(event.title);
    }
  });
});
