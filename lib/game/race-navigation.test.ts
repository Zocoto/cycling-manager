import { describe, expect, it } from "vitest";

import {
  getRaceProfileHref,
  getRaceRegistrationHref,
  isRaceCalendarHref,
  isRaceRegistrationHref,
  shouldUseRaceCalendarDocumentNavigation,
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

  it.each([
    "/jeu/calendrier",
    "/jeu/calendrier/",
    "/jeu/calendrier?inscription=confirmee",
    "/jeu/calendrier#courses",
    "/jeu/calendrier/?wildcard=demandee&course=tour-des-alpes#courses",
  ])("identifie le calendrier canonique %s", (href) => {
    expect(isRaceCalendarHref(href)).toBe(true);
  });

  it.each([
    "/jeu/calendrier-autre",
    "/jeu/calendrier/course",
    "/jeu/preparation-course",
    "/jeu/resultats",
    "/jeu",
    "https://autre.example/jeu/calendrier",
    "//autre.example/jeu/calendrier",
    "javascript:alert(1)",
    "",
  ])("ne confond pas %s avec le calendrier canonique", (href) => {
    expect(isRaceCalendarHref(href)).toBe(false);
  });

  it.each([
    ["/jeu/courses/tour-des-alpes", "/jeu/calendrier"],
    ["/jeu/courses/tour-des-alpes/", "/jeu/calendrier"],
    ["/jeu/courses/criterium-de-la-decouverte", "/jeu/calendrier/"],
  ])("sécurise uniquement le retour %s → %s", (current, target) => {
    expect(shouldUseRaceCalendarDocumentNavigation(current, target)).toBe(true);
  });

  it.each([
    ["/jeu", "/jeu/calendrier"],
    ["/jeu/calendrier", "/jeu/calendrier"],
    ["/jeu/preparation-course", "/jeu/calendrier"],
    ["/jeu/resultats/tour-des-alpes", "/jeu/calendrier"],
    ["/jeu/courses", "/jeu/calendrier"],
    ["/jeu/courses/tour-des-alpes/historique/4", "/jeu/calendrier"],
    ["/jeu/courses/tour-des-alpes", "/jeu/preparation-course"],
    ["/jeu/courses/tour-des-alpes", "/jeu/calendrier/course"],
    ["/jeu/courses/tour-des-alpes", "/jeu/resultats/tour-des-alpes"],
  ])("préserve la navigation ordinaire %s → %s", (current, target) => {
    expect(shouldUseRaceCalendarDocumentNavigation(current, target)).toBe(false);
  });
});
