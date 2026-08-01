import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  RACE_CATEGORY_CODES,
  type RaceCalendarEdition,
  type SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

import { SeasonCalendar } from "./season-calendar";

describe("SeasonCalendar", () => {
  it("hachure les inscriptions closes dans toutes les catégories sans hachurer une course ouverte", () => {
    const closedEditions =
      RACE_CATEGORY_CODES.map(
        (categoryCode, index) =>
          createEdition({
            id: `closed-${categoryCode}`,
            name: `Course ${categoryCode}`,
            categoryCode,
            dayNumber: 1,
            daySlot:
              index % 2 === 0
                ? "early"
                : "late",
            registrationClosesAt:
              "2026-07-26T10:00:00Z",
            accepted: true,
          })
      );
    const openEdition = createEdition({
      id: "open-national",
      name: "Course ouverte",
      categoryCode: "national",
      dayNumber: 2,
      daySlot: "early",
      registrationClosesAt:
        "2026-07-27T08:00:00Z",
      accepted: false,
    });
    const calendar: SeasonRaceCalendar = {
      seasonId: "season-1",
      seasonName: "Saison test",
      gameYear: 1,
      startsOn: "2026-07-26",
      endsOn: "2026-08-22",
      currentDayNumber: 1,
      days: Array.from(
        { length: 28 },
        (_, index) => ({
          id: `day-${index + 1}`,
          dayNumber: index + 1,
          calendarDate: new Date(
            Date.UTC(2026, 6, 26 + index)
          )
            .toISOString()
            .slice(0, 10),
          label: null,
        })
      ),
      events: [],
      editions: [
        ...closedEditions,
        openEdition,
      ],
    };

    const markup = renderToStaticMarkup(
      <SeasonCalendar
        calendar={calendar}
        reputationPoints={100}
        nowIso="2026-07-26T10:00:00Z"
      />
    );

    expect(markup).toContain(
      "Hachuré : inscriptions closes"
    );
    expect(
      markup.match(
        /data-registration-status="closed"/g
      )?.length
    ).toBeGreaterThanOrEqual(
      RACE_CATEGORY_CODES.length
    );
    expect(markup).toContain(
      'data-registration-status="not-closed"'
    );
    expect(markup).toContain(
      "repeating-linear-gradient"
    );

    for (const edition of closedEditions) {
      expect(markup).toContain(
        `${edition.name} · Inscriptions closes`
      );
    }
  });

  it("met en valeur les trois Grands Tours avec leur liseré national", () => {
    const calendar: SeasonRaceCalendar = {
      seasonId: "season-grand-tours",
      seasonName: "Saison des Grands Tours",
      gameYear: 1,
      startsOn: "2026-08-01",
      endsOn: "2026-08-28",
      currentDayNumber: 1,
      days: Array.from({ length: 28 }, (_, index) => ({
        id: `day-${index + 1}`,
        dayNumber: index + 1,
        calendarDate: new Date(Date.UTC(2026, 7, 1 + index))
          .toISOString()
          .slice(0, 10),
        label: null,
      })),
      events: [],
      editions: [
        createEdition({
          id: "corsa-delle-regioni",
          name: "Corsa delle Regioni",
          categoryCode: "elite",
          countryCode: "IT",
          dayNumber: 1,
          daySlot: "early",
          registrationClosesAt: "2026-08-02T08:00:00Z",
          accepted: false,
          isGrandTour: true,
          raceFormat: "stage_race",
        }),
        createEdition({
          id: "boucle-des-provinces",
          name: "Boucle des Provinces",
          categoryCode: "elite",
          countryCode: "FR",
          dayNumber: 2,
          daySlot: "early",
          registrationClosesAt: "2026-08-03T08:00:00Z",
          accepted: false,
          isGrandTour: true,
          raceFormat: "stage_race",
        }),
        createEdition({
          id: "ruta-de-las-sierras",
          name: "Ruta de las Sierras",
          categoryCode: "elite",
          countryCode: "ES",
          dayNumber: 3,
          daySlot: "early",
          registrationClosesAt: "2026-08-04T08:00:00Z",
          accepted: false,
          isGrandTour: true,
          raceFormat: "stage_race",
        }),
      ],
    };

    const markup = renderToStaticMarkup(
      <SeasonCalendar
        calendar={calendar}
        reputationPoints={100}
        nowIso="2026-08-01T07:00:00Z"
      />,
    );

    expect(markup).toContain('data-grand-tour-accent="italy"');
    expect(markup).toContain('data-grand-tour-accent="france"');
    expect(markup).toContain('data-grand-tour-accent="spain"');
    expect(markup).toContain("0 0 0 2px #F0A1BB");
    expect(markup).toContain("0 0 0 2px #F2C94C");
    expect(markup).toContain("0 0 0 2px #E05252");
  });

  it("retire les courses révolues du calendrier", () => {
    const pastEdition = createEdition({
      id: "course-passee",
      name: "Course passée invisible",
      categoryCode: "national",
      dayNumber: 4,
      daySlot: "early",
      registrationClosesAt:
        "2026-07-28T08:00:00Z",
      accepted: true,
    });
    const upcomingEdition = createEdition({
      id: "course-a-venir",
      name: "Course à venir visible",
      categoryCode: "national",
      dayNumber: 6,
      daySlot: "early",
      registrationClosesAt:
        "2026-07-30T08:00:00Z",
      accepted: true,
    });
    const calendar: SeasonRaceCalendar = {
      seasonId: "season-1",
      seasonName: "Saison test",
      gameYear: 1,
      startsOn: "2026-07-26",
      endsOn: "2026-08-22",
      currentDayNumber: 5,
      days: Array.from(
        { length: 28 },
        (_, index) => ({
          id: `day-${index + 1}`,
          dayNumber: index + 1,
          calendarDate: new Date(
            Date.UTC(2026, 6, 26 + index)
          )
            .toISOString()
            .slice(0, 10),
          label: null,
        })
      ),
      events: [],
      editions: [pastEdition, upcomingEdition],
    };

    const markup = renderToStaticMarkup(
      <SeasonCalendar
        calendar={calendar}
        reputationPoints={100}
        nowIso="2026-07-30T07:00:00Z"
      />
    );

    expect(markup).not.toContain(
      "Course passée invisible"
    );
    expect(markup).toContain(
      "Course à venir visible"
    );
    expect(markup).toContain(
      "/jeu/courses/course-a-venir#inscription"
    );
    expect(markup).toContain(
      'data-navigation-mode="document"'
    );
    expect(markup).not.toContain(
      "data-race-preview-trigger"
    );
  });
});

function createEdition({
  id,
  name,
  categoryCode,
  dayNumber,
  daySlot,
  registrationClosesAt,
  accepted,
  countryCode = "FR",
  isGrandTour = false,
  raceFormat = "one_day",
}: {
  id: string;
  name: string;
  categoryCode: RaceCalendarEdition["categoryCode"];
  dayNumber: number;
  daySlot: "early" | "late";
  registrationClosesAt: string;
  accepted: boolean;
  countryCode?: string;
  isGrandTour?: boolean;
  raceFormat?: RaceCalendarEdition["raceFormat"];
}): RaceCalendarEdition {
  return {
    id,
    raceId: `race-${id}`,
    slug: id,
    name,
    shortName: name,
    countryName:
      countryCode === "IT"
        ? "Italie"
        : countryCode === "ES"
          ? "Espagne"
          : "France",
    countryCode,
    categoryCode,
    categoryName: categoryCode,
    prestigeRank:
      RACE_CATEGORY_CODES.indexOf(
        categoryCode
      ) + 1,
    raceFormat,
    competitionType: "standard",
    isGrandTour,
    registrationClosesAt,
    wildcardClosesAt: registrationClosesAt,
    withdrawalClosesAt:
      registrationClosesAt,
    registrationPolicy: "open",
    minimumReputation: 0,
    minimumRosterSize: 5,
    maximumRosterSize: 8,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: accepted
      ? {
          status: "accepted",
          rosterCount: 6,
        }
      : null,
    stages: [
      {
        id: `stage-${id}`,
        dayNumber,
        stageNumber: 1,
        name,
        stageType: "road",
        status: "planned",
        profileType: "flat",
        distanceKm: 145,
        daySlot,
        departureAt: null,
        segments: [],
      },
    ],
  };
}
