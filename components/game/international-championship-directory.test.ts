import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildInternationalChampionshipGroups } from "@/components/game/international-championship-directory";
import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  RaceDaySlot,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import {
  getInternationalChampionshipDirectoryHref,
  getInternationalChampionshipStartlistHref,
} from "@/lib/game/international-championship-navigation";

const pageSource = readFileSync(
  new URL("../../app/jeu/championnats-internationaux/page.tsx", import.meta.url),
  "utf8",
);
const directorySource = readFileSync(
  new URL("./international-championship-directory.tsx", import.meta.url),
  "utf8",
);
const selectionsSource = readFileSync(
  new URL("../../app/jeu/selections-internationales/page.tsx", import.meta.url),
  "utf8",
);
const profileSource = readFileSync(
  new URL("../../app/jeu/courses/[slug]/race-profile-content.tsx", import.meta.url),
  "utf8",
);

describe("annuaire des championnats internationaux", () => {
  it("regroupe tous les CC et CM et les trie par journée puis créneau", () => {
    const calendar = createCalendar([
      createEdition("world-road", "world_championship", 27, "late"),
      createEdition("africa-road", "continental_championship", 22, "late"),
      createEdition("africa-tt", "continental_championship", 22, "early"),
      createEdition("ordinary", "standard", 3, "early"),
    ]);

    const groups = buildInternationalChampionshipGroups(calendar);

    expect(groups.map((group) => group.key)).toEqual([
      "continental_championship",
      "world_championship",
    ]);
    expect(groups[0]?.editions.map((edition) => edition.slug)).toEqual([
      "africa-tt",
      "africa-road",
    ]);
    expect(groups[1]?.editions.map((edition) => edition.slug)).toEqual([
      "world-road",
    ]);
  });

  it("expose des liens distincts vers l'annuaire, les détails et la startlist", () => {
    expect(getInternationalChampionshipDirectoryHref("africa-tt")).toBe(
      "/jeu/championnats-internationaux#africa-tt",
    );
    expect(getInternationalChampionshipStartlistHref("africa-tt")).toBe(
      "/jeu/courses/africa-tt#peloton",
    );
    expect(directorySource).toContain("Voir les détails");
    expect(directorySource).toContain("Voir la startlist");
    expect(pageSource).toContain("Voir mes convocations");
  });

  it("conserve une navigation bidirectionnelle entre profils et convocations", () => {
    expect(selectionsSource).toContain("INTERNATIONAL_CHAMPIONSHIPS_HREF");
    expect(selectionsSource).toContain("Profils et startlists");
    expect(selectionsSource).toContain("selection.championshipSlug");
    expect(selectionsSource).toContain("Voir le profil et la startlist");
    expect(profileSource).toContain("INTERNATIONAL_SELECTIONS_HREF");
    expect(profileSource).toContain("Retour aux CC & CM");
    expect(profileSource).toContain("Voir mes convocations");
  });
});

function createCalendar(editions: RaceCalendarEdition[]): SeasonRaceCalendar {
  return {
    seasonId: "season-2",
    seasonName: "Saison 2",
    gameYear: 2,
    startsOn: "2026-08-14",
    endsOn: "2026-09-10",
    currentDayNumber: 21,
    days: [],
    events: [],
    editions,
  };
}

function createEdition(
  slug: string,
  competitionType: RaceCompetitionType,
  dayNumber: number,
  daySlot: RaceDaySlot,
): RaceCalendarEdition {
  return {
    id: `edition-${slug}`,
    status: "planned",
    raceId: `race-${slug}`,
    slug,
    name: slug,
    shortName: null,
    countryName: "Test",
    countryCode: "FR",
    categoryCode: competitionType === "standard" ? "elite" : "world",
    categoryName: "Test",
    prestigeRank: 1,
    raceFormat: "one_day",
    competitionType,
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "closed",
    minimumReputation: null,
    minimumRosterSize: 1,
    maximumRosterSize: 200,
    engagedRiderCount: 0,
    engagedRiders: [],
    currentTeamRegistration: null,
    stages: [
      {
        id: `stage-${slug}`,
        dayNumber,
        stageNumber: 1,
        name: slug,
        stageType: slug.endsWith("tt") ? "individual_time_trial" : "road",
        status: "planned",
        profileType: slug.endsWith("tt") ? "time_trial" : "flat",
        distanceKm: 42,
        daySlot,
        departureAt: null,
        segments: [],
      },
    ],
  };
}
