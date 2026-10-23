import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import type { NationalChampionshipGroup } from "./national-championship-results-directory";
import { InternationalChampionshipResultsAccess } from "./international-championship-results-access";

import {
  RaceLiveDirectory,
  isEditionInResultsScope,
} from "./race-live-directory";

describe("RaceLiveDirectory", () => {
  it("affiche le jour courant, replie le passé et masque les courses futures", () => {
    const pastEdition = createEdition({
      id: "course-passee",
      name: "Classique passée",
      dayNumbers: [3],
    });
    const currentTour = createEdition({
      id: "tour-en-cours",
      name: "Tour en cours",
      dayNumbers: [2, 4, 5],
    });
    const futureEdition = createEdition({
      id: "course-future",
      name: "Course de demain",
      dayNumbers: [5],
    });
    const calendar = createCalendar({
      currentDayNumber: 4,
      editions: [pastEdition, currentTour, futureEdition],
    });

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={calendar}
        nowIso="2026-07-29T20:00:00Z"
      />,
    );

    expect(markup).toContain('data-race-period="today"');
    expect(markup).toContain('data-race-period="past"');
    expect(markup).toContain("Courses passées");
    expect(markup).toContain("Classique passée");
    expect(markup).not.toContain("Course de demain");
    expect(markup).toContain('href="/jeu/resultats/tour-en-cours/2"');
    expect(markup).not.toContain("Résumé des étapes");
  });

  it("affiche séparément toutes les étapes d'un même tour disputées le même jour", () => {
    const tour = createEdition({
      id: "ruta-de-las-sierras",
      name: "Ruta de las Sierras",
      dayNumbers: [4, 4],
    });
    tour.stages[0].daySlot = "early";
    tour.stages[0].departureAt = "2026-07-29T12:00:00.000Z";
    tour.stages[1].daySlot = "late";
    tour.stages[1].departureAt = "2026-07-29T16:00:00.000Z";

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({
          currentDayNumber: 4,
          editions: [tour],
        })}
        nowIso="2026-07-29T18:00:00.000Z"
      />,
    );

    expect(markup).toContain('data-stage-number="1"');
    expect(markup).toContain('data-stage-number="2"');
    expect(markup).toContain(
      'href="/jeu/resultats/ruta-de-las-sierras/1"',
    );
    expect(markup).toContain(
      'href="/jeu/resultats/ruta-de-las-sierras/2"',
    );
    expect(markup).toContain("E1 · Étape 1");
    expect(markup).toContain("E2 · Étape 2");
    expect(markup).toContain("2 replays aujourd’hui");
  });

  it("sépare les courses de l’équipe des courses non courues", () => {
    const teamEdition = createEdition({
      id: "course-equipe",
      name: "Course de mon équipe",
      dayNumbers: [4],
    });
    const unriddenEdition = createEdition({
      id: "course-non-courue",
      name: "Course à suivre",
      dayNumbers: [4],
      registered: false,
    });
    const calendar = createCalendar({
      currentDayNumber: 4,
      editions: [teamEdition, unriddenEdition],
    });

    expect(isEditionInResultsScope(teamEdition, "team")).toBe(true);
    expect(isEditionInResultsScope(teamEdition, "unridden")).toBe(false);
    expect(isEditionInResultsScope(unriddenEdition, "team")).toBe(false);
    expect(isEditionInResultsScope(unriddenEdition, "unridden")).toBe(true);

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={calendar}
        nowIso="2026-07-29T20:00:00Z"
        initialScope="unridden"
      />,
    );

    expect(markup).toContain("Courses non courues");
    expect(markup).toContain("Course à suivre");
    expect(markup).toContain(
      'href="/jeu/resultats/course-non-courue/1"',
    );
    expect(markup).not.toContain("Course de mon équipe");
  });

  it("range les championnats nationaux résolus avec les courses passées", () => {
    const pastEdition = createEdition({
      id: "course-passee",
      name: "Classique passée",
      dayNumbers: [3],
    });
    const nationalEdition = createEdition({
      id: "cn-fr-route",
      name: "Championnat de France",
      dayNumbers: [4],
      registered: false,
    });
    nationalEdition.competitionType = "national_road";
    nationalEdition.status = "completed";
    nationalEdition.stages[0]!.status = "completed";
    const nationalGroup: NationalChampionshipGroup = {
      competitionType: "national_road",
      title: "CN sur route",
      discipline: "route",
      dayNumber: 4,
      editions: [nationalEdition],
    };

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({
          currentDayNumber: 5,
          editions: [pastEdition],
        })}
        nowIso="2026-07-30T20:00:00Z"
        pastNationalChampionshipGroups={[nationalGroup]}
      />,
    );

    expect(markup).toContain("Courses passées");
    expect(markup).toContain("2 courses");
    expect(markup).toContain('data-race-period="past"');
    expect(markup).toContain(
      'data-race-competition="national-championship"',
    );
    expect(markup).toContain("CN sur route");
    expect(markup.indexOf("CN sur route")).toBeLessThan(
      markup.indexOf("Classique passée"),
    );
  });

  it("ne mélange pas les CN de l’équipe aux courses non courues", () => {
    const nationalEdition = createEdition({
      id: "cn-fr-clm",
      name: "Championnat de France CLM",
      dayNumbers: [4],
      registered: false,
    });
    nationalEdition.competitionType = "national_time_trial";
    nationalEdition.status = "completed";
    const nationalGroup: NationalChampionshipGroup = {
      competitionType: "national_time_trial",
      title: "CN contre-la-montre",
      discipline: "contre-la-montre",
      dayNumber: 4,
      editions: [nationalEdition],
    };

    const markup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({ currentDayNumber: 5, editions: [] })}
        nowIso="2026-07-30T20:00:00Z"
        initialScope="unridden"
        pastNationalChampionshipGroups={[nationalGroup]}
      />,
    );

    expect(markup).not.toContain("CN contre-la-montre");
    expect(markup).not.toContain("Courses passées");
  });

  it("affiche la manche Nations Cup de l’équipe à J24 puis dans l’historique", () => {
    const nationsCupEdition = createEdition({
      id: "nations-cup-vallee-division-2-groupe-b",
      name: "Nations Cup · Vallée · Division 2 · Groupe B",
      dayNumbers: [24],
      registered: false,
    });
    nationsCupEdition.competitionType = "nations_cup";
    nationsCupEdition.currentTeamInternationalRiderCount = 1;

    expect(isEditionInResultsScope(nationsCupEdition, "team")).toBe(true);
    expect(isEditionInResultsScope(nationsCupEdition, "unridden")).toBe(false);

    const beforeMarkup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({
          currentDayNumber: 23,
          editions: [nationsCupEdition],
        })}
        nowIso="2026-08-17T20:00:00Z"
      />,
    );
    const raceDayMarkup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({
          currentDayNumber: 24,
          editions: [nationsCupEdition],
        })}
        nowIso="2026-08-18T20:00:00Z"
      />,
    );
    const historyMarkup = renderToStaticMarkup(
      <RaceLiveDirectory
        calendar={createCalendar({
          currentDayNumber: 25,
          editions: [nationsCupEdition],
        })}
        nowIso="2026-08-19T20:00:00Z"
      />,
    );

    expect(beforeMarkup).not.toContain(nationsCupEdition.name);
    expect(raceDayMarkup).toContain('data-race-period="today"');
    expect(raceDayMarkup).toContain(nationsCupEdition.name);
    expect(raceDayMarkup).toContain(
      'href="/jeu/resultats/nations-cup-vallee-division-2-groupe-b/1"',
    );
    expect(historyMarkup).toContain('data-race-period="past"');
    expect(historyMarkup).toContain("Courses passées");
    expect(historyMarkup).toContain(nationsCupEdition.name);
  });

  it("ne remplit pas les résultats avec les manches Nations Cup sans coureur de l’équipe", () => {
    const nationsCupEdition = createEdition({
      id: "nations-cup-sprint-division-1-groupe-a",
      name: "Nations Cup · Sprint · Division 1 · Groupe A",
      dayNumbers: [24],
      registered: false,
    });
    nationsCupEdition.competitionType = "nations_cup";
    nationsCupEdition.currentTeamInternationalRiderCount = 0;

    expect(isEditionInResultsScope(nationsCupEdition, "team")).toBe(false);
    expect(isEditionInResultsScope(nationsCupEdition, "unridden")).toBe(false);
  });

  it.each(["continental_championship", "world_championship"] as const)(
    "rend %s accessible sans inscription de club, y compris dans les archives",
    (competitionType) => {
      const edition = createChampionship({ competitionType, timeTrial: false });
      edition.engagedRiderCount = 0;
      edition.currentTeamInternationalRiderCount = 0;
      edition.status = "completed";
      edition.stages[0].status = "completed";

      for (const scope of ["team", "unridden"] as const) {
        expect(isEditionInResultsScope(edition, scope)).toBe(true);
        const markup = renderToStaticMarkup(
          <RaceLiveDirectory
            calendar={createCalendar({ currentDayNumber: 5, editions: [edition] })}
            nowIso="2026-07-30T20:00:00Z"
            initialScope={scope}
          />,
        );
        expect(markup).toContain("Courses passées");
        expect(markup).toContain(`href="/jeu/resultats/${edition.slug}/1"`);
        expect(markup).not.toContain('id="championnats-internationaux-resultats"');
      }
    },
  );

  it.each(["continental_championship", "world_championship"] as const)(
    "affiche les accès CLM et route de %s uniquement leur jour, même après leur fin",
    (competitionType) => {
      const clm = createChampionship({ competitionType, timeTrial: true });
      const road = createChampionship({ competitionType, timeTrial: false });
      clm.status = "completed";
      clm.stages[0].status = "completed";
      const editions = [clm, road];
      const renderAccess = (day: number, nowIso: string) => renderToStaticMarkup(
        <InternationalChampionshipResultsAccess
          calendar={createCalendar({ currentDayNumber: day, editions })}
          now={new Date(nowIso)}
        />,
      );

      expect(renderAccess(3, "2026-07-28T20:00:00Z")).toBe("");
      const raceDay = renderAccess(4, "2026-07-29T14:00:00Z");
      expect(raceDay).toContain(`href="/jeu/resultats/${clm.slug}/1"`);
      expect(raceDay).toContain(`href="/jeu/resultats/${road.slug}/1"`);
      expect(raceDay).toContain("Résultats");
      expect(raceDay).toContain("18 h");
      expect(raceDay.match(/<h3/g)).toHaveLength(1);

      expect(renderAccess(4, "2026-07-29T16:01:00Z")).toContain("En direct");
      road.status = "completed";
      road.stages[0].status = "completed";
      const evening = renderAccess(4, "2026-07-29T21:59:00Z");
      expect(evening.match(/>Résultats</g)).toHaveLength(2);
      expect(renderAccess(5, "2026-07-30T06:00:00Z")).toBe("");
    },
  );

  it("ne montre le raccourci route des Mondiaux que le jour de cette discipline", () => {
    const clm = createChampionship({ competitionType: "world_championship", timeTrial: true });
    const road = createChampionship({ competitionType: "world_championship", timeTrial: false });
    road.stages[0].dayNumber = 5;
    const markup = renderToStaticMarkup(
      <InternationalChampionshipResultsAccess
        calendar={createCalendar({ currentDayNumber: 5, editions: [clm, road] })}
        now={new Date("2026-07-30T14:00:00Z")}
      />,
    );
    expect(markup).toContain(`href="/jeu/resultats/${road.slug}/1"`);
    expect(markup).not.toContain(`href="/jeu/resultats/${clm.slug}/1"`);
  });

  it("écarte du raccourci les épreuves annulées, juniors et ordinaires", () => {
    const cancelledEdition = createChampionship({ competitionType: "continental_championship", timeTrial: false });
    cancelledEdition.status = "cancelled";
    const cancelledStage = createChampionship({ competitionType: "world_championship", timeTrial: false });
    cancelledStage.stages[0].status = "cancelled";
    const junior = createChampionship({ competitionType: "world_championship", timeTrial: true });
    junior.isJuniorChampionship = true;
    const ordinary = createEdition({ id: "ordinary", name: "Course ordinaire", dayNumbers: [4] });
    const markup = renderToStaticMarkup(
      <InternationalChampionshipResultsAccess
        calendar={createCalendar({ currentDayNumber: 4, editions: [cancelledEdition, cancelledStage, junior, ordinary] })}
        now={new Date("2026-07-29T14:00:00Z")}
      />,
    );
    expect(markup).toBe("");
  });

  it("conserve les accès du jour dans les deux portées de résultats", () => {
    const edition = createChampionship({ competitionType: "continental_championship", timeTrial: true });
    for (const scope of ["team", "unridden"] as const) {
      const markup = renderToStaticMarkup(
        <RaceLiveDirectory
          calendar={createCalendar({ currentDayNumber: 4, editions: [edition] })}
          nowIso="2026-07-29T14:00:00Z"
          initialScope={scope}
        />,
      );
      const panelStart = markup.indexOf('id="championnats-internationaux-resultats"');
      const filtersStart = markup.indexOf("Portée des résultats et directs");
      expect(panelStart).toBeGreaterThanOrEqual(0);
      expect(panelStart).toBeLessThan(filtersStart);
      expect(markup.slice(panelStart, filtersStart)).toContain(`href="/jeu/resultats/${edition.slug}/1"`);
    }
  });
});

function createChampionship({
  competitionType,
  timeTrial,
}: {
  competitionType: "continental_championship" | "world_championship";
  timeTrial: boolean;
}) {
  const baseSlug = competitionType === "world_championship"
    ? "championnats-du-monde"
    : "championnats-continentaux-europe";
  const edition = createEdition({
    id: `${baseSlug}${timeTrial ? "-contre-la-montre" : ""}`,
    name: `${competitionType === "world_championship" ? "Championnats du monde" : "Championnats d’Europe"}${timeTrial ? " CLM" : ""}`,
    dayNumbers: [4],
    registered: false,
  });
  edition.competitionType = competitionType;
  edition.stages[0].stageType = timeTrial ? "individual_time_trial" : "road";
  edition.stages[0].daySlot = timeTrial ? "early" : "late";
  edition.stages[0].departureAt = timeTrial ? "2026-07-29T12:00:00Z" : "2026-07-29T16:00:00Z";
  return edition;
}

function createCalendar({
  currentDayNumber,
  editions,
}: {
  currentDayNumber: number;
  editions: RaceCalendarEdition[];
}): SeasonRaceCalendar {
  return {
    seasonId: "season-1",
    seasonName: "Saison test",
    gameYear: 1,
    startsOn: "2026-07-26",
    endsOn: "2026-08-22",
    currentDayNumber,
    days: [],
    events: [],
    editions,
  };
}

function createEdition({
  id,
  name,
  dayNumbers,
  registered = true,
}: {
  id: string;
  name: string;
  dayNumbers: number[];
  registered?: boolean;
}): RaceCalendarEdition {
  return {
    id,
    raceId: `race-${id}`,
    slug: id,
    name,
    shortName: name,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "National",
    prestigeRank: 4,
    raceFormat: dayNumbers.length > 1 ? "stage_race" : "one_day",
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "closed",
    minimumReputation: 0,
    minimumRosterSize: 5,
    maximumRosterSize: 7,
    engagedRiderCount: 5,
    engagedRiders: [],
    currentTeamRegistration: registered
      ? {
          status: "accepted",
          rosterCount: 5,
        }
      : null,
    stages: dayNumbers.map((dayNumber, index) => ({
      id: `${id}-stage-${index + 1}`,
      dayNumber,
      stageNumber: index + 1,
      name: `Étape ${index + 1}`,
      stageType: "road",
      status: dayNumber < 4 ? "completed" : "planned",
      profileType: "mixed",
      distanceKm: 150,
      daySlot: "early",
      departureAt: null,
      segments: [],
    })),
  };
}
