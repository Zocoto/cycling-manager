import { describe, expect, it } from "vitest";

import {
  getRaceProfileHref,
  getRaceRegistrationHref,
  isRaceRegistrationHref,
} from "./race-navigation";

describe("race navigation", () => {
  it("construit les liens de course depuis une source unique", () => {
    expect(getRaceProfileHref(" tour-des-alpes ")).toBe(
      "/jeu/courses/tour-des-alpes",
    );
    expect(getRaceRegistrationHref("tour-des-alpes")).toBe(
      "/jeu/courses/tour-des-alpes#inscription",
    );
  });

  it.each([
    "/jeu/courses/tour-des-alpes#inscription",
    "/jeu/courses/tour-des-alpes?origine=calendrier#inscription",
  ])("identifie %s comme une action d'inscription", (href) => {
    expect(isRaceRegistrationHref(href)).toBe(true);
  });

  it.each([
    "/jeu/courses/tour-des-alpes",
    "/jeu/courses/tour-des-alpes#peloton",
    "/jeu/resultats/tour-des-alpes#inscription",
    "/jeu/courses#inscription",
  ])("ne confond pas %s avec une action d'inscription", (href) => {
    expect(isRaceRegistrationHref(href)).toBe(false);
  });
});
