import { describe, expect, it } from "vitest";

import {
  buildDashboardAssistantLines,
  formatDashboardAssistantDate,
  getDashboardRaceRosterAlerts,
  type DashboardAssistantSnapshot,
} from "@/lib/game/dashboard-assistant";

const snapshot: DashboardAssistantSnapshot = {
  gameDate: "2026-08-28",
  minimumForm: 50,
  untreatedInjuryCount: 2,
  lowFormCount: 3,
  completedScoutingCount: 1,
  zeroTrainingCount: 4,
  seniorSessionCount: 20,
  seniorCompletedCount: 17,
  seniorSkippedCount: 3,
  seniorProgressCount: 5,
  juniorRiderCount: 6,
  juniorSessionCount: 6,
  juniorProgressCount: 2,
  auctionCount: 12,
  dailyAuctionCount: 10,
  directorAuctionCount: 2,
  nextAuctionCloseAt: "2026-08-28T16:30:00.000Z",
  pendingSelectionCount: 1,
  pendingDirectOfferCount: 2,
  contractRenewalCount: 3,
  youthAlertCount: 1,
  watchedAuctionClosingCount: 2,
  staffMarketCount: 25,
  preparationReminderCount: 1,
  journalItems: [],
};

describe("dashboard DS assistant", () => {
  it("keeps one compact actionable line per alert category", () => {
    const groups = buildDashboardAssistantLines({
      snapshot,
      raceRosterAlerts: [
        {
          id: "race-roster-alert:tour-test",
          metric: "5/7",
          title: "Start-list à corriger · Tour test",
          detail: "2 coureurs manquent avant le départ à J18.",
          href: "/jeu/courses/tour-test#inscription",
          dayNumber: 18,
        },
      ],
      raceRosterAlertCount: 1,
      rewardCount: 3,
      cashBalance: 100_000,
    });

    expect(groups.alerts.map((line) => line.id)).toEqual([
      "race-roster-alert:tour-test",
      "untreated-injuries",
      "pending-selections",
      "pending-direct-offers",
      "completed-scouting",
      "low-form",
      "zero-training",
      "contract-renewals",
      "youth-alerts",
    ]);
    expect(groups.alerts.every((line) => line.href)).toBe(true);
    expect(groups.alerts[0]).toEqual(
      expect.objectContaining({
        title: "Start-list à corriger · Tour test",
        href: "/jeu/courses/tour-test#inscription",
      }),
    );
    expect(groups.alerts.at(-1)).toEqual(
      expect.objectContaining({
        id: "youth-alerts",
        title: "junior de 18 ans à recruter",
      }),
    );
    expect(groups.information.map((line) => line.id)).toEqual([
      "senior-training",
      "junior-training",
      "auctions",
      "watched-auctions-closing",
      "staff-market",
      "race-preparation-reminder",
      "rewards",
    ]);
    expect(groups.information[0]?.detail).toContain("17/20 séances");
    expect(groups.information[2]?.detail).toContain("10 quotidiennes");
  });

  it("replaces empty alert categories with one all-clear line", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        untreatedInjuryCount: 0,
        lowFormCount: 0,
        completedScoutingCount: 0,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
      },
      raceRosterAlertCount: 0,
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({ id: "all-clear", tone: "success", href: null }),
    ]);
  });

  it("formats the game day in French without depending on the server locale", () => {
    expect(formatDashboardAssistantDate("2026-08-28")).toBe(
      "Vendredi 28 août",
    );
  });

  it("creates one direct registration alert per incomplete start-list", () => {
    const alerts = getDashboardRaceRosterAlerts({
      seasonId: "season-1",
      seasonName: "Saison 2",
      gameYear: 2,
      startsOn: "2026-08-01",
      endsOn: "2026-08-28",
      currentDayNumber: 15,
      days: [],
      events: [],
      editions: [
        {
          id: "race-1",
          raceId: "race",
          slug: "boucle-test",
          name: "Boucle test",
          shortName: null,
          countryName: "France",
          countryCode: "FR",
          categoryCode: "regional",
          categoryName: "Régionale",
          prestigeRank: 1,
          raceFormat: "one_day",
          competitionType: "standard",
          registrationClosesAt: null,
          wildcardClosesAt: null,
          withdrawalClosesAt: null,
          registrationPolicy: "open",
          minimumReputation: null,
          minimumRosterSize: 7,
          maximumRosterSize: 8,
          engagedRiderCount: 5,
          engagedRiders: [],
          currentTeamRegistration: { status: "accepted", rosterCount: 5 },
          stages: [
            {
              id: "stage-1",
              dayNumber: 16,
              stageNumber: 1,
              name: "Étape",
              stageType: "road",
              status: "planned",
              profileType: "flat",
              distanceKm: 150,
              daySlot: "early",
              departureAt: null,
              segments: [],
            },
          ],
        },
      ],
    });

    expect(alerts).toEqual([
      expect.objectContaining({
        metric: "5/7",
        href: "/jeu/courses/boucle-test#inscription",
        dayNumber: 16,
      }),
    ]);
  });
});
