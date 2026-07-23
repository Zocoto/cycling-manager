import { describe, expect, it } from "vitest";

import {
  buildContractRenewalReminderEvents,
  buildDashboardEventFeed,
  type DashboardEvent,
} from "@/lib/game/dashboard-events";
import type { GameObjective } from "@/lib/game/objectives";

const operationalEvent: DashboardEvent = {
  id: "injury:rider-1",
  category: "health",
  priority: "critical",
  title: "Coureur blessé",
  description: "Une blessure demande votre attention.",
  href: "/jeu/coureurs/rider-1",
  actionLabel: "Voir le coureur",
  dayNumber: 7,
  happenedAt: "2026-07-22T08:00:00.000Z",
};

const readyObjective: GameObjective = {
  key: "first-win",
  type: "primary",
  group: "results",
  title: "Première victoire",
  description: "Gagner une course.",
  currentValue: 1,
  targetValue: 1,
  progressPercent: 100,
  reward: {
    cash: 10_000,
    experience: 100,
    reputation: 5,
    itemName: null,
    itemKind: null,
  },
  displayOrder: 1,
  completed: true,
  claimedAt: null,
};

describe("dashboard events", () => {
  it("place les urgences médicales avant les actions et les informations", () => {
    const events = buildDashboardEventFeed({
      currentDayNumber: 7,
      currency: "EUR",
      operationalEvents: [operationalEvent],
      objectives: [readyObjective],
      transactions: [
        {
          id: "payment-1",
          dayNumber: 7,
          amount: 25_000,
          category: "sponsor",
          status: "posted",
          description: "Versement du sponsor",
          sourceReference: "test:sponsor-payment-1",
          postedAt: "2026-07-22T09:00:00.000Z",
        },
      ],
    });

    expect(events[0]?.id).toBe("injury:rider-1");
    expect(events.some((event) => event.id === "objective:first-win")).toBe(
      true
    );
    expect(
      events.some((event) => event.id === "sponsor-payment:payment-1")
    ).toBe(true);
  });

  it("rappelle les deux championnats nationaux à l’approche de J8 et J9", () => {
    const events = buildDashboardEventFeed({
      currentDayNumber: 7,
      currency: "EUR",
      operationalEvents: [],
      objectives: [],
      transactions: [],
    });

    expect(
      events.some((event) => event.id === "national-championship:time-trial")
    ).toBe(true);
    expect(
      events.some((event) => event.id === "national-championship:road")
    ).toBe(true);
  });

  it("retire les rappels CN une fois les épreuves passées", () => {
    const events = buildDashboardEventFeed({
      currentDayNumber: 10,
      currency: "EUR",
      operationalEvents: [],
      objectives: [],
      transactions: [],
    });

    expect(events).toEqual([]);
  });

  it("ignore les anciennes échéances sponsor", () => {
    const events = buildDashboardEventFeed({
      currentDayNumber: 12,
      currency: "EUR",
      operationalEvents: [],
      objectives: [],
      transactions: [
        {
          id: "old-payment",
          dayNumber: 7,
          amount: 25_000,
          category: "sponsor",
          status: "posted",
          description: "Ancien versement",
          sourceReference: "test:old-sponsor-payment",
          postedAt: "2026-07-20T09:00:00.000Z",
        },
      ],
    });

    expect(events).toEqual([]);
  });

  it("rappelle à partir de J21 les contrats sans saison suivante", () => {
    const riders = [
      {
        riderId: "rider-expiring",
        firstName: "Erik",
        lastName: "Van Dijk",
        hasNextSeasonContract: false,
      },
      {
        riderId: "rider-renewed",
        firstName: "Milan",
        lastName: "De Smet",
        hasNextSeasonContract: true,
      },
    ];

    expect(
      buildContractRenewalReminderEvents({
        currentDayNumber: 20,
        riders,
      })
    ).toEqual([]);

    const reminders = buildContractRenewalReminderEvents({
      currentDayNumber: 21,
      riders,
    });

    expect(reminders).toHaveLength(1);
    expect(reminders[0]).toMatchObject({
      id: "contract-expiry:rider-expiring",
      category: "contract",
      priority: "action",
      title: "Contrat de Erik Van Dijk à renouveler",
      href: "/jeu/coureurs/rider-expiring",
      badgeLabel: "Contrat",
    });
  });
});
