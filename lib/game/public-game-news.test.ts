import { describe, expect, it } from "vitest";

import {
  createPublicGameNewsSnapshot,
  formatPublicGameNewsDate,
  formatPublicGameNewsTotal,
  type PublicGameNewsItem,
} from "./public-game-news";

describe("public game news", () => {
  it("classe les événements du plus récent au plus ancien", () => {
    const items: PublicGameNewsItem[] = [
      {
        id: "arrival:1",
        kind: "arrival",
        title: "Arrivée",
        detail: "Détail",
        happenedAt: "2026-07-20T09:00:00.000Z",
      },
      {
        id: "victory:1",
        kind: "victory",
        title: "Victoire",
        detail: "Détail",
        happenedAt: "2026-07-21T09:00:00.000Z",
      },
      {
        id: "movement:1",
        kind: "movement",
        title: "Mouvement",
        detail: "Détail",
        happenedAt: "2026-07-21T08:00:00.000Z",
      },
    ];

    const snapshot = createPublicGameNewsSnapshot({
      items,
      totals: { directors: 1, victories: 1, movements: 1 },
      isLive: true,
    });

    expect(snapshot.items.map((item) => item.id)).toEqual([
      "victory:1",
      "movement:1",
      "arrival:1",
    ]);
  });

  it("écarte les dates invalides et limite le tableau à sept événements", () => {
    const items: PublicGameNewsItem[] = Array.from({ length: 9 }, (_, index) => ({
      id: `arrival:${index}`,
      kind: "arrival",
      title: "Arrivée",
      detail: "Détail",
      happenedAt: new Date(Date.UTC(2026, 6, index + 1)).toISOString(),
    }));
    items.push({
      id: "invalid",
      kind: "victory",
      title: "Invalide",
      detail: "Détail",
      happenedAt: "pas-une-date",
    });

    const snapshot = createPublicGameNewsSnapshot({
      items,
      totals: { directors: 9, victories: 0, movements: 0 },
      isLive: true,
    });

    expect(snapshot.items).toHaveLength(7);
    expect(snapshot.items[0]?.id).toBe("arrival:8");
    expect(snapshot.items.some((item) => item.id === "invalid")).toBe(false);
  });

  it("place les recrutements de staff entre les transferts et les arrivées de DS", () => {
    const happenedAt = "2026-07-21T09:00:00.000Z";
    const snapshot = createPublicGameNewsSnapshot({
      items: [
        {
          id: "arrival:1",
          kind: "arrival",
          title: "Arrivée",
          detail: "Détail",
          happenedAt,
        },
        {
          id: "staff:1",
          kind: "staff",
          title: "Staff",
          detail: "Détail",
          happenedAt,
        },
        {
          id: "movement:1",
          kind: "movement",
          title: "Transfert",
          detail: "Détail",
          happenedAt,
        },
      ],
      totals: { directors: 1, victories: 0, movements: 2 },
      isLive: true,
    });

    expect(snapshot.items.map((item) => item.id)).toEqual([
      "movement:1",
      "staff:1",
      "arrival:1",
    ]);
  });

  it("présente les dates récentes sous une forme lisible", () => {
    const now = new Date("2026-07-21T12:00:00.000Z");

    expect(formatPublicGameNewsDate("2026-07-21T11:59:30.000Z", now)).toBe(
      "À l’instant"
    );
    expect(formatPublicGameNewsDate("2026-07-21T11:42:00.000Z", now)).toBe(
      "Il y a 18 min"
    );
    expect(formatPublicGameNewsDate("2026-07-21T08:00:00.000Z", now)).toBe(
      "Il y a 4 h"
    );
    expect(formatPublicGameNewsDate("2026-07-20T08:00:00.000Z", now)).toBe(
      "Hier"
    );
  });

  it("différencie une donnée indisponible d’un compteur vide", () => {
    expect(formatPublicGameNewsTotal(null)).toBe("—");
    expect(formatPublicGameNewsTotal(0)).toBe("0");
    expect(formatPublicGameNewsTotal(1_250)).toMatch(/1.250|1\s250/);
  });
});
