import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderFavoriteRacesCard } from "./rider-favorite-races-card";

describe("RiderFavoriteRacesCard", () => {
  it("shows three linked races without exposing affinity triggers", () => {
    const markup = renderToStaticMarkup(
      <RiderFavoriteRacesCard
        races={[
          {
            raceId: "race-1",
            name: "Tour des grandes ascensions",
            slug: "tour-des-grandes-ascensions",
            countryName: "France",
            countryCode: "FR",
            categoryCode: "elite",
            dominantProfile: "mountain",
            geographyCode: "home",
            historySeasons: 3,
            historyPodiums: 2,
            historyVictories: 1,
          },
          {
            raceId: "race-2",
            name: "Classique des pavés",
            slug: "classique-des-paves",
            countryName: "Belgique",
            countryCode: "BE",
            categoryCode: "world",
            dominantProfile: "cobbles",
            geographyCode: "neighbor",
            historySeasons: 0,
            historyPodiums: 0,
            historyVictories: 0,
          },
          {
            raceId: "race-3",
            name: "Sprint continental",
            slug: "sprint-continental",
            countryName: "Italie",
            countryCode: "IT",
            categoryCode: "continental",
            dominantProfile: "sprint",
            geographyCode: "continent",
            historySeasons: 2,
            historyPodiums: 0,
            historyVictories: 0,
          },
        ]}
      />,
    );

    expect(markup).toContain("Courses préférées");
    expect(markup).toContain("+2 toutes stats");
    expect(markup).not.toContain("Bonus actif sur ces courses uniquement");
    expect(markup).toContain("/jeu/courses/tour-des-grandes-ascensions");
    expect(markup).toContain("Pavés");
    expect(markup).toContain("France");
    expect(markup).not.toContain("Son pays");
    expect(markup).not.toContain("Pays voisin");
    expect(markup).not.toContain("Même continent");
    expect(markup).not.toContain("Profil adapté");
    expect(markup).not.toContain("saisons disputées");
    expect(markup).not.toContain("victoire");
    expect(markup).not.toContain("podium");
    expect(markup.match(/<li\b/g)).toHaveLength(3);
    expect(markup).toContain("min-w-0");
    expect(markup).toContain("break-words");
  });
});
