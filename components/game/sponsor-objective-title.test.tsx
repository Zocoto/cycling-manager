import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SponsorObjectiveTargetDetails } from "@/types/sponsor-objective";

import { SponsorObjectiveTitle } from "./sponsor-objective-title";

describe("SponsorObjectiveTitle", () => {
  it("ajoute l’aperçu et le lien de course aux objectifs de performance", () => {
    const targetDetails: SponsorObjectiveTargetDetails = {
      kind: "race_result",
      raceId: "race-1",
      raceEditionId: "11111111-1111-4111-8111-111111111111",
      raceSlug: "tour-de-bretagne",
      raceLabel: "Tour de Bretagne",
      countryCode: "FR",
      achievementType: "top_n",
      targetRank: 5,
      requiredCount: 1,
    };

    const markup = renderToStaticMarkup(
      <SponsorObjectiveTitle targetDetails={targetDetails}>
        Terminer dans le top 5 du Tour de Bretagne
      </SponsorObjectiveTitle>,
    );

    expect(markup).toContain('href="/jeu/courses/tour-de-bretagne"');
    expect(markup).toContain("data-race-preview-trigger");
    expect(markup).toContain("data-sponsor-race-objective-link");
    expect(markup).toContain("Aperçu · course");
  });

  it("laisse les autres objectifs sous forme de texte", () => {
    const targetDetails: SponsorObjectiveTargetDetails = {
      kind: "season_wins",
      minimumWinCount: 3,
      winScope: "all",
    };

    const markup = renderToStaticMarkup(
      <SponsorObjectiveTitle targetDetails={targetDetails}>
        Remporter trois courses
      </SponsorObjectiveTitle>,
    );

    expect(markup).toContain("<p");
    expect(markup).not.toContain("href=");
    expect(markup).not.toContain("data-race-preview-trigger");
  });

  it("ouvre la fiche et l’aperçu du coureur demandé par le sponsor", () => {
    const targetDetails: SponsorObjectiveTargetDetails = {
      kind: "rider_recruitment",
      riderId: "11111111-1111-4111-8111-111111111111",
      riderName: "Jean Kerbrat",
      countryCode: "FR",
      sportingProfile: "Coureur de pavés",
      overallRating: 68,
      accessibilityMaximumOverall: 72,
    };

    const markup = renderToStaticMarkup(
      <SponsorObjectiveTitle targetDetails={targetDetails}>
        Recruter Jean Kerbrat
      </SponsorObjectiveTitle>,
    );

    expect(markup).toContain(
      'href="/jeu/coureurs/11111111-1111-4111-8111-111111111111"',
    );
    expect(markup).toContain("data-sponsor-rider-objective-link");
    expect(markup).toContain("Aperçu · coureur");
  });
});
