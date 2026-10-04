import { describe, expect, it } from "vitest";

import {
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

  it("ne publie pas le teaser dans les autres éditions", () => {
    expect(
      includeCyclingHollowTeaserStory([ordinaryStory], "2026-10-05"),
    ).toEqual([ordinaryStory]);
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
