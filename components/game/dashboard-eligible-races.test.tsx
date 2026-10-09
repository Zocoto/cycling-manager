import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

import {
  DashboardEligibleRaces,
  getOpenEligibleDashboardRaces,
} from "./dashboard-eligible-races";

describe("dashboard eligible races", () => {
  const extendedEliteEdition = (): RaceCalendarEdition => ({
    ...createEdition("corsa-delle-regioni", {
      minimumReputation: 0,
      minimumRosterSize: 8,
      startDay: 2,
      isGrandTour: true,
    }),
    name: "Corsa delle Regioni",
    categoryCode: "elite",
    categoryName: "Élite",
    status: "registration_open",
    registrationClosesAt: "2026-10-10T06:00:00.000Z",
    wildcardClosesAt: "2026-10-09T12:00:00.000Z",
  });
  const extendedEliteCalendar = () => ({
    ...createCalendar([extendedEliteEdition()]),
    currentDayNumber: 1,
  });

  it("conserve la Corsa pour les équipes Élite après la clôture des wildcards", () => {
    const calendar = extendedEliteCalendar();
    const now = new Date("2026-10-09T15:00:00.000Z");
    const races = getOpenEligibleDashboardRaces({
      calendar, divisionCode: "elite", reputationPoints: 500,
      riderCount: 9, now, horizonDays: 4,
    });
    expect(races.map(({ edition }) => edition.slug)).toEqual(["corsa-delle-regioni"]);
    const markup = renderToStaticMarkup(<DashboardEligibleRaces
      calendar={calendar} divisionCode="elite" reputationPoints={500}
      riderCount={9} now={now}
    />);
    expect(markup).toContain("Corsa delle Regioni");
    expect(markup).toContain("/jeu/courses/corsa-delle-regioni#inscription");
    expect(markup).toContain("S’inscrire");
  });

  it.each(["world", "continental", "amateur", undefined])(
    "ne prolonge pas une candidature wildcard pour la division %s", (divisionCode) => {
      expect(getOpenEligibleDashboardRaces({
        calendar: extendedEliteCalendar(), divisionCode, reputationPoints: 500,
        riderCount: 9, now: new Date("2026-10-09T15:00:00.000Z"), horizonDays: 4,
      })).toEqual([]);
    },
  );

  it("retire la Corsa à la clôture exacte des inscriptions Élite", () => {
    for (const date of ["2026-10-10T06:00:00.000Z", "2026-10-10T06:00:01.000Z"]) {
      expect(getOpenEligibleDashboardRaces({
        calendar: extendedEliteCalendar(), divisionCode: "elite", reputationPoints: 500,
        riderCount: 9, now: new Date(date), horizonDays: 4,
      })).toEqual([]);
    }
    expect(getOpenEligibleDashboardRaces({
      calendar: extendedEliteCalendar(), divisionCode: "elite", reputationPoints: 500,
      riderCount: 9, now: new Date("2026-10-10T05:59:59.999Z"), horizonDays: 4,
    })).toHaveLength(1);
  });

  it("préserve les limites d’effectif et exclut les courses déjà démarrées", () => {
    const options = {
      calendar: extendedEliteCalendar(), divisionCode: "elite", reputationPoints: 500,
      riderCount: 7, now: new Date("2026-10-09T15:00:00.000Z"), horizonDays: 4,
    };
    expect(getOpenEligibleDashboardRaces(options)).toEqual([]);
    for (const status of ["cancelled", "completed", "in_progress"] as const) {
      const calendar = extendedEliteCalendar();
      calendar.editions[0].status = status;
      expect(getOpenEligibleDashboardRaces({ ...options, calendar, riderCount: 9 })).toEqual([]);
    }
  });

  it("ne garde que les inscriptions ouvertes et accessibles à l’équipe", () => {
    const calendar = createCalendar([
      createEdition("eligible", {
        minimumReputation: 100,
        minimumRosterSize: 6,
        startDay: 12,
      }),
      createEdition("reputation-locked", {
        minimumReputation: 200,
        minimumRosterSize: 6,
        startDay: 13,
      }),
      createEdition("roster-locked", {
        minimumReputation: 0,
        minimumRosterSize: 10,
        startDay: 14,
      }),
      createEdition("closed", {
        minimumReputation: 0,
        minimumRosterSize: 6,
        registrationPolicy: "closed",
        startDay: 15,
      }),
    ]);

    expect(
      getOpenEligibleDashboardRaces({
        calendar,
        reputationPoints: 125,
        riderCount: 8,
        now: new Date("2026-07-10T10:00:00.000Z"),
        horizonDays: 4,
      }).map((race) => race.edition.id),
    ).toEqual(["eligible"]);
  });

  it("mène directement au panneau d’inscription de la course", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("eligible", {
            minimumReputation: 100,
            minimumRosterSize: 6,
            startDay: 12,
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain("Course eligible");
    expect(markup).toContain("/jeu/courses/eligible#inscription");
    expect(markup).toContain("Calendrier court terme");
    expect(markup).toContain("Inscriptions à suivre");
    expect(markup).not.toContain("data-race-preview-trigger");
    expect(markup).toContain("data-dashboard-race-scroll");
    expect(markup).toContain("overflow-y-auto");
  });

  it("affiche toutes les inscriptions éligibles des quatre prochains jours", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("premiere", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 11,
          }),
          createEdition("deuxieme", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 12,
          }),
          createEdition("troisieme", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 13,
          }),
          createEdition("quatrieme", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 14,
          }),
          createEdition("hors-fenetre", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 15,
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain("Course premiere");
    expect(markup).toContain("Course deuxieme");
    expect(markup).toContain("Course troisieme");
    expect(markup).toContain("Course quatrieme");
    expect(markup).not.toContain("Course hors-fenetre");
  });

  it("signale visuellement une course qui est un objectif sponsor", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("objectif-sponsor", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 12,
            isSponsorObjective: true,
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain("Course objectif-sponsor");
    expect(markup).toContain('aria-label="Objectif sponsor"');
    expect(markup).toContain("bg-[#F5EEFF]");
    expect(markup).toContain("bg-[#8B5CF6]");
  });

  it("hiérarchise les Grands Tours et les Monuments parmi les courses élite", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("boucle-des-provinces", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 12,
            isGrandTour: true,
          }),
          createEdition("enfer-des-dunes", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 13,
            isMonument: true,
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain('data-race-importance="grand_tour"');
    expect(markup).toContain('data-race-importance="monument"');
    expect(markup).toContain("Grand Tour : Course boucle-des-provinces");
    expect(markup).toContain('aria-label="Course majeure : Grand Tour"');
    expect(markup).toContain('aria-label="Course majeure : Monument"');
    expect(markup).toContain("bg-[#FFF9DF]");
    expect(markup).toContain("bg-[#FFF1EB]");
  });

  it("conserve et signale une inscription acceptée devenue incomplète", () => {
    const calendar = createCalendar([
      createEdition("a-corriger", {
        minimumReputation: 200,
        minimumRosterSize: 6,
        registrationPolicy: "closed",
        startDay: 12,
        currentTeamRegistration: {
          status: "accepted",
          rosterCount: 5,
        },
      }),
    ]);

    const races = getOpenEligibleDashboardRaces({
      calendar,
      reputationPoints: 0,
      riderCount: 5,
      now: new Date("2026-07-10T10:00:00.000Z"),
      horizonDays: 4,
    });
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={calendar}
        reputationPoints={0}
        riderCount={5}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(races).toHaveLength(1);
    expect(races[0]?.needsRegistrationAttention).toBe(true);
    expect(markup).toContain('aria-label="Attention, inscription à revoir"');
    expect(markup).toContain("Start-list à revoir");
    expect(markup).toContain("5/6 coureurs");
    expect(markup).toContain("À corriger");
    expect(markup).toContain("bg-[#FFF0F1]");
    expect(markup).toContain("/jeu/courses/a-corriger#inscription");
  });

  it("ne signale pas une inscription dont le contingent reste conforme", () => {
    const markup = renderToStaticMarkup(
      <DashboardEligibleRaces
        calendar={createCalendar([
          createEdition("conforme", {
            minimumReputation: 0,
            minimumRosterSize: 6,
            startDay: 12,
            currentTeamRegistration: {
              status: "accepted",
              rosterCount: 6,
            },
          }),
        ])}
        reputationPoints={125}
        riderCount={8}
        now={new Date("2026-07-10T10:00:00.000Z")}
      />,
    );

    expect(markup).toContain("Voir l’inscription");
    expect(markup).not.toContain("Attention, inscription à revoir");
    expect(markup).not.toContain("Start-list à revoir");
  });
});

function createCalendar(editions: RaceCalendarEdition[]): SeasonRaceCalendar {
  return {
    seasonId: "season-1",
    seasonName: "Saison 1",
    gameYear: 2026,
    startsOn: "2026-07-01",
    endsOn: "2026-07-31",
    currentDayNumber: 10,
    days: Array.from({ length: 31 }, (_, index) => ({
      id: `day-${index + 1}`,
      dayNumber: index + 1,
      calendarDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
      label: null,
    })),
    events: [],
    editions,
  };
}

function createEdition(
  id: string,
  {
    minimumReputation,
    minimumRosterSize,
    registrationPolicy = "open",
    startDay,
    isSponsorObjective = false,
    isGrandTour = false,
    isMonument = false,
    currentTeamRegistration = null,
  }: {
    minimumReputation: number;
    minimumRosterSize: number;
    registrationPolicy?: RaceCalendarEdition["registrationPolicy"];
    startDay: number;
    isSponsorObjective?: boolean;
    isGrandTour?: boolean;
    isMonument?: boolean;
    currentTeamRegistration?: RaceCalendarEdition["currentTeamRegistration"];
  },
): RaceCalendarEdition {
  return {
    id,
    status: "planned",
    raceId: `race-${id}`,
    slug: id,
    name: `Course ${id}`,
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "continental",
    categoryName: "Continentale",
    prestigeRank: 10,
    raceFormat: "one_day",
    competitionType: "standard",
    isGrandTour,
    isMonument,
    isSponsorObjective,
    registrationClosesAt: "2026-07-11T22:00:00.000Z",
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy,
    minimumReputation,
    minimumRosterSize,
    maximumRosterSize: 8,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration,
    stages: [
      {
        id: `${id}-stage-1`,
        dayNumber: startDay,
        stageNumber: 1,
        name: "Étape 1",
        stageType: "road",
        status: "planned",
        profileType: "mixed",
        distanceKm: 180,
        daySlot: "early",
        departureAt: null,
        segments: [],
      },
    ],
  };
}
