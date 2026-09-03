import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  buildDashboardAssistantLines,
  formatDashboardAssistantDate,
  getDashboardLowReputationRegistrationAlerts,
  getDashboardRaceRosterAlerts,
  type DashboardAssistantSnapshot,
} from "@/lib/game/dashboard-assistant";
import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

const snapshot: DashboardAssistantSnapshot = {
  gameDate: "2026-08-28",
  minimumForm: 50,
  untreatedInjuryCount: 2,
  lowFormCount: 3,
  completedScoutingCount: 1,
  availableScoutCount: 2,
  zeroTrainingCount: 4,
  seniorSessionCount: 20,
  seniorCompletedCount: 17,
  seniorSkippedCount: 3,
  seniorProgressCount: 5,
  juniorRiderCount: 6,
  juniorSessionCount: 6,
  juniorProgressCount: 2,
  juniorManualTrainingDueCount: 2,
  juniorManualTrainingSlot: "manual_am",
  auctionCount: 12,
  dailyAuctionCount: 10,
  directorAuctionCount: 2,
  nextAuctionCloseAt: "2026-08-28T16:30:00.000Z",
  pendingSelectionCount: 1,
  pendingDirectOfferCount: 2,
  contractRenewalCount: 3,
  youthAlertCount: 1,
  nextSeasonRosterProjectedCount: 33,
  nextSeasonRosterOverflowCount: 0,
  watchedAuctionClosingCount: 2,
  staffMarketCount: 25,
  preparationReminderCount: 1,
  riderRecruitmentMatchCount: 2,
  staffRecruitmentMatchCount: 1,
  sponsorSignatureAvailable: false,
  sponsorRenewalAvailable: false,
  sponsorJerseyChangeAvailable: false,
  sponsorTargetSeasonName: null,
  journalItems: [],
};

describe("dashboard DS assistant", () => {
  it("keeps one compact actionable line per alert category", () => {
    const groups = buildDashboardAssistantLines({
      snapshot,
      raceRosterAlerts: [
        {
          id: "race-roster-alert:tour-test",
          raceName: "Tour test",
          metric: "5/7",
          title: "Start-list à corriger · Tour test",
          detail: "2 coureurs manquent avant le départ à J18.",
          href: "/jeu/courses/tour-test#inscription",
          dayNumber: 18,
          prestigeRank: 2,
        },
      ],
      rewardCount: 3,
      cashBalance: 100_000,
    });

    expect(groups.alerts.map((line) => line.id)).toEqual([
      "race-roster-alerts",
      "untreated-injuries",
      "junior-manual-training",
      "pending-selections",
      "pending-direct-offers",
      "rider-recruitment-matches",
      "staff-recruitment-matches",
      "completed-scouting",
      "available-scouts",
      "low-form",
      "zero-training",
      "contract-renewals",
      "youth-alerts",
    ]);
    expect(groups.alerts.every((line) => line.href)).toBe(true);
    expect(
      groups.alerts.find((line) => line.id === "junior-manual-training"),
    ).toEqual(
      expect.objectContaining({
        metric: "2",
        title: "entraînements juniors à réaliser",
        detail: expect.stringContaining("matin"),
        href: "/jeu/centre-de-formation?onglet=ecole",
      }),
    );
    expect(
      groups.alerts.find((line) => line.id === "available-scouts"),
    ).toEqual(
      expect.objectContaining({
        metric: "2",
        title: "scouts disponibles",
        href: "/jeu/centre-de-formation?onglet=scouting",
      }),
    );
    expect(groups.alerts[0]).toEqual(
      expect.objectContaining({
        title: "start-list à corriger",
        detail: expect.stringContaining("Tour test"),
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
        availableScoutCount: 0,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        riderRecruitmentMatchCount: 0,
        staffRecruitmentMatchCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
        juniorManualTrainingDueCount: 0,
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({ id: "all-clear", tone: "success", href: null }),
    ]);
  });

  it("warns before J1 when firm arrivals and scheduled promotions exceed 35 riders", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        untreatedInjuryCount: 0,
        lowFormCount: 0,
        completedScoutingCount: 0,
        availableScoutCount: 0,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        riderRecruitmentMatchCount: 0,
        staffRecruitmentMatchCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
        juniorManualTrainingDueCount: 0,
        nextSeasonRosterProjectedCount: 38,
        nextSeasonRosterOverflowCount: 3,
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({
        id: "next-season-roster-overflow",
        metric: "3",
        title: "places de trop prévues à J1",
        detail: expect.stringContaining("38/35"),
        href: "/jeu/centre-de-formation?onglet=ecole",
      }),
    ]);
    expect(groups.alerts[0]?.detail).toContain(
      "juniors aux moyennes les plus faibles",
    );
  });

  it("adds the three actionable sponsoring reminders for the next season", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        sponsorSignatureAvailable: true,
        sponsorRenewalAvailable: true,
        sponsorJerseyChangeAvailable: true,
        sponsorTargetSeasonName: "Saison 3",
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(
      groups.alerts.filter((line) => line.id.startsWith("sponsor-")),
    ).toEqual([
      expect.objectContaining({
        title: "Signature Sponsoring possible",
        href: "/jeu/sponsoring",
      }),
      expect.objectContaining({
        title: "Renouvellement sponsor disponible",
        href: "/jeu/sponsoring",
      }),
      expect.objectContaining({
        title: "Changement de maillot S3 possible",
        href: "/jeu/sponsoring",
      }),
    ]);
  });

  it("adapts the manual junior reminder to the evening slot", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        untreatedInjuryCount: 0,
        lowFormCount: 0,
        completedScoutingCount: 0,
        availableScoutCount: 0,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        riderRecruitmentMatchCount: 0,
        staffRecruitmentMatchCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
        juniorManualTrainingDueCount: 1,
        juniorManualTrainingSlot: "manual_pm",
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({
        id: "junior-manual-training",
        title: "entraînement junior à réaliser",
        detail: expect.stringContaining("soir"),
        href: "/jeu/centre-de-formation?onglet=ecole",
      }),
    ]);
  });

  it("uses a singular reminder for one available scout", () => {
    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        untreatedInjuryCount: 0,
        lowFormCount: 0,
        completedScoutingCount: 0,
        availableScoutCount: 1,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        riderRecruitmentMatchCount: 0,
        staffRecruitmentMatchCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
        juniorManualTrainingDueCount: 0,
      },
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({
        id: "available-scouts",
        metric: "1",
        title: "scout disponible",
        href: "/jeu/centre-de-formation?onglet=scouting",
      }),
    ]);
  });

  it("formats the game day in French without depending on the server locale", () => {
    expect(formatDashboardAssistantDate("2026-08-28")).toBe(
      "Vendredi 28 août",
    );
  });

  it("targets the closest invalid start-list, then the highest category and stable order", () => {
    const closestNational = createRaceEdition({
      id: "closest-national",
      slug: "closest-national",
      name: "Course nationale proche",
      dayNumber: 11,
      prestigeRank: 4,
    });
    closestNational.status = "registration_closed";
    const eliteBeta = createRaceEdition({
      id: "elite-beta",
      slug: "elite-beta",
      name: "Beta Elite",
      dayNumber: 12,
      prestigeRank: 1,
    });
    const eliteAlpha = createRaceEdition({
      id: "elite-alpha",
      slug: "elite-alpha",
      name: "Alpha Elite",
      dayNumber: 12,
      prestigeRank: 1,
    });
    const worldAardvark = createRaceEdition({
      id: "world-aardvark",
      slug: "world-aardvark",
      name: "Aardvark Mondial",
      dayNumber: 12,
      prestigeRank: 2,
    });
    const calendar = createRaceCalendar([
      worldAardvark,
      eliteBeta,
      eliteAlpha,
      closestNational,
    ]);

    expect(
      getDashboardRaceRosterAlerts(calendar).map((alert) => alert.href),
    ).toEqual([
      "/jeu/courses/closest-national#inscription",
      "/jeu/courses/elite-alpha#inscription",
      "/jeu/courses/elite-beta#inscription",
      "/jeu/courses/world-aardvark#inscription",
    ]);

    closestNational.currentTeamRegistration!.rosterCount =
      closestNational.minimumRosterSize;
    expect(getDashboardRaceRosterAlerts(calendar)[0]?.href).toBe(
      "/jeu/courses/elite-alpha#inscription",
    );

    eliteAlpha.currentTeamRegistration!.rosterCount =
      eliteAlpha.minimumRosterSize;
    expect(getDashboardRaceRosterAlerts(calendar)[0]?.href).toBe(
      "/jeu/courses/elite-beta#inscription",
    );
  });

  it("signale aux nouveaux DS les inscriptions accessibles sans requête supplémentaire", () => {
    const closeRace = createRaceEdition({
      id: "accessible-close",
      slug: "accessible-close",
      name: "Course découverte proche",
      dayNumber: 12,
      prestigeRank: 4,
    });
    closeRace.currentTeamRegistration = null;
    closeRace.minimumReputation = 10;
    const farRace = createRaceEdition({
      id: "accessible-far",
      slug: "accessible-far",
      name: "Course découverte lointaine",
      dayNumber: 18,
      prestigeRank: 4,
    });
    farRace.currentTeamRegistration = null;
    farRace.minimumReputation = 0;
    const lockedRace = createRaceEdition({
      id: "locked",
      slug: "locked",
      name: "Course verrouillée",
      dayNumber: 11,
      prestigeRank: 1,
    });
    lockedRace.currentTeamRegistration = null;
    lockedRace.minimumReputation = 40;
    const calendar = createRaceCalendar([farRace, lockedRace, closeRace]);

    const alerts = getDashboardLowReputationRegistrationAlerts(calendar, 12);

    expect(alerts.map((alert) => alert.href)).toEqual([
      "/jeu/courses/accessible-close#inscription",
      "/jeu/courses/accessible-far#inscription",
    ]);
    expect(getDashboardLowReputationRegistrationAlerts(calendar, 30)).toEqual(
      [],
    );

    const groups = buildDashboardAssistantLines({
      snapshot: {
        ...snapshot,
        untreatedInjuryCount: 0,
        lowFormCount: 0,
        completedScoutingCount: 0,
        availableScoutCount: 0,
        zeroTrainingCount: 0,
        pendingSelectionCount: 0,
        pendingDirectOfferCount: 0,
        riderRecruitmentMatchCount: 0,
        staffRecruitmentMatchCount: 0,
        contractRenewalCount: 0,
        youthAlertCount: 0,
        juniorManualTrainingDueCount: 0,
      },
      raceRegistrationAlerts: alerts,
      rewardCount: 0,
      cashBalance: 100_000,
    });

    expect(groups.alerts).toEqual([
      expect.objectContaining({
        id: "low-reputation-registrations",
        metric: "2",
        detail: expect.stringContaining("augmenter votre réputation"),
        href: "/jeu/courses/accessible-close#inscription",
      }),
    ]);
  });

  it("keeps closed registrations in the lightweight dashboard calendar", () => {
    const source = readFileSync(
      new URL("../../services/dashboard-race-calendar.ts", import.meta.url),
      "utf8",
    );

    expect(source).toMatch(
      /\.in\("status", \[\s*"planned",\s*"registration_open",\s*"registration_closed",\s*\]\)/,
    );
  });

  it("ignores a past one-day race even when its notification is still unread", () => {
    const pastRace = createRaceEdition({
      id: "past-race",
      slug: "past-race",
      name: "Course passée",
      dayNumber: 9,
      prestigeRank: 4,
    });

    expect(getDashboardRaceRosterAlerts(createRaceCalendar([pastRace]))).toEqual(
      [],
    );
  });

  it("ignores a stage race whose first stage has already started", () => {
    const stageRace = createRaceEdition({
      id: "started-tour",
      slug: "started-tour",
      name: "Tour commencé",
      dayNumber: 9,
      prestigeRank: 2,
    });
    stageRace.raceFormat = "stage_race";
    stageRace.stages.push({
      ...stageRace.stages[0]!,
      id: "stage-started-tour-2",
      dayNumber: 11,
      stageNumber: 2,
      name: "Étape 2",
    });

    expect(
      getDashboardRaceRosterAlerts(createRaceCalendar([stageRace])),
    ).toEqual([]);
  });

  it("keeps a same-day correction only before an explicit departure time", () => {
    const todayRace = createRaceEdition({
      id: "today-race",
      slug: "today-race",
      name: "Course du jour",
      dayNumber: 10,
      prestigeRank: 4,
    });
    todayRace.stages[0]!.departureAt = "2026-08-10T12:00:00.000Z";
    const calendar = createRaceCalendar([todayRace]);

    expect(
      getDashboardRaceRosterAlerts(
        calendar,
        new Date("2026-08-10T11:59:59.000Z"),
      ),
    ).toHaveLength(1);
    expect(
      getDashboardRaceRosterAlerts(
        calendar,
        new Date("2026-08-10T12:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("does not guess on the current day when the departure time is missing", () => {
    const todayRace = createRaceEdition({
      id: "today-without-time",
      slug: "today-without-time",
      name: "Course du jour sans heure",
      dayNumber: 10,
      prestigeRank: 4,
    });

    expect(
      getDashboardRaceRosterAlerts(createRaceCalendar([todayRace])),
    ).toEqual([]);
  });
});

function createRaceCalendar(
  editions: RaceCalendarEdition[],
): SeasonRaceCalendar {
  return {
    seasonId: "season",
    seasonName: "Saison test",
    gameYear: 2026,
    startsOn: "2026-08-01",
    endsOn: "2026-09-01",
    currentDayNumber: 10,
    days: [],
    events: [],
    editions,
  };
}

function createRaceEdition({
  id,
  slug,
  name,
  dayNumber,
  prestigeRank,
}: {
  id: string;
  slug: string;
  name: string;
  dayNumber: number;
  prestigeRank: number;
}): RaceCalendarEdition {
  return {
    id,
    status: "registration_open",
    raceId: `race-${id}`,
    slug,
    name,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode:
      prestigeRank === 1 ? "elite" : prestigeRank === 2 ? "world" : "national",
    categoryName:
      prestigeRank === 1
        ? "Elite"
        : prestigeRank === 2
          ? "Mondial"
          : "National",
    prestigeRank,
    raceFormat: "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 6,
    maximumRosterSize: 8,
    engagedRiderCount: 5,
    engagedRiders: [],
    currentTeamRegistration: {
      status: "accepted",
      rosterCount: 5,
    },
    stages: [
      {
        id: `stage-${id}`,
        dayNumber,
        stageNumber: 1,
        name,
        stageType: "road",
        status: "planned",
        profileType: "flat",
        distanceKm: 150,
        daySlot: "early",
        departureAt: null,
        segments: [],
      },
    ],
  };
}
