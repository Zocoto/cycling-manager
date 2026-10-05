import { describe, expect, it } from "vitest";

import {
  getCyclingHollowTeaserStory,
  includeCyclingHollowTeaserStory,
  type CyclogazetteFeatureStory,
} from "./cyclogazette";

const ordinaryStory: CyclogazetteFeatureStory = {
  id: "story:ordinary",
  kind: "startlist",
  kicker: "Start-list",
  kickerEn: "Start list",
  title: "Le favori prend la parole",
  titleEn: "The favourite speaks",
  body: "Le peloton se prépare.",
  bodyEn: "The peloton is getting ready.",
};

describe("teaser Cycling Hollow dans La Cyclogazette", () => {
  it("ajoute la brève après le dossier principal dans l’édition du soir", () => {
    const stories = includeCyclingHollowTeaserStory(
      [ordinaryStory],
      "2026-10-04",
    );

    expect(stories).toHaveLength(2);
    expect(stories[0]).toBe(ordinaryStory);
    expect(stories[1]).toMatchObject({
      kind: "event_teaser",
      title: "La nuit, un étrange cycliste suit le peloton",
    });
    expect(stories[1].body).toContain("l’Équipier sans tête");
  });

  it.each(["2026-10-03", "2026-10-09", "2026-11-01", "2027-10-05"])("ne publie pas le feuilleton hors de sa campagne : %s", (date) => {
    expect(
      includeCyclingHollowTeaserStory([ordinaryStory], date),
    ).toEqual([ordinaryStory]);
  });

  it.each([
    ["2026-10-05", "L’équipier qui n’est jamais rentré"],
    ["2026-10-06", "Une roue tournait dans l’atelier fermé"],
    ["2026-10-07", "Il avait une citrouille pour visage"],
    ["2026-10-08", "À minuit, ne prenez pas sa roue"],
  ])("publie un épisode distinct jusqu’à J28 : %s", (date, title) => {
    const episode = getCyclingHollowTeaserStory(date);
    expect(episode).toMatchObject({ title, kind: "event_teaser", id: `event:cycling-hollow:${date}` });
    expect(episode?.titleEn).toBeTruthy();
    expect(episode?.bodyEn).toBeTruthy();
    expect(episode?.href).toBeUndefined();
    const stories = includeCyclingHollowTeaserStory([ordinaryStory], date);
    expect(stories[0]).toBe(ordinaryStory);
    expect(stories[1]).toBe(episode);
    expect(includeCyclingHollowTeaserStory(stories, date)).toEqual(stories);
  });

  it("garde le texte et la position réellement publiés dans les archives", () => {
    const archivedEpisode = { ...getCyclingHollowTeaserStory("2026-10-04")!, body: "Le texte publié, conservé sans réécriture." };
    const archive = [ordinaryStory, archivedEpisode];
    expect(includeCyclingHollowTeaserStory(archive, "2026-10-08")).toEqual(archive);
  });

  it("ne complète pas une archive lors d’une simple lecture", () => {
    expect(includeCyclingHollowTeaserStory([ordinaryStory], "2026-10-05", { includeScheduled: false })).toEqual([ordinaryStory]);
  });

  it("préserve le dossier sportif principal et réserve une seule place sur six", () => {
    const sports = Array.from({ length: 6 }, (_, index) => ({ ...ordinaryStory, id: `sport:${index}` }));
    const stories = includeCyclingHollowTeaserStory(sports, "2026-10-08");
    expect(stories).toHaveLength(6);
    expect(stories[0]).toBe(sports[0]);
    expect(stories.filter((story) => story.kind === "event_teaser")).toHaveLength(1);
    expect(stories.slice(2)).toEqual(sports.slice(1, 5));
  });

  it("annonce J1 S4 sans exposer le pilote ni activer les gains", () => {
    const finale = getCyclingHollowTeaserStory("2026-10-08");
    expect(finale?.body).toContain("minuit");
    expect(finale?.body).toContain("J1 de la saison 4");
    expect(finale?.body).toContain("deux bonbons");
    expect(finale?.body).toContain("une boutique");
    expect(finale?.body).toContain("roues rouges et noires");
    expect(getCyclingHollowTeaserStory("__proto__")).toBeNull();
  });

  it("reste idempotent et conserve au maximum six dossiers", () => {
    const firstPass = includeCyclingHollowTeaserStory(
      Array.from({ length: 6 }, (_, index) => ({
        ...ordinaryStory,
        id: `story:${index}`,
      })),
      "2026-10-04",
    );
    const secondPass = includeCyclingHollowTeaserStory(
      firstPass,
      "2026-10-04",
    );

    expect(secondPass).toHaveLength(6);
    expect(
      secondPass.filter((story) => story.kind === "event_teaser"),
    ).toHaveLength(1);
  });
});
