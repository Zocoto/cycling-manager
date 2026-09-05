import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SeasonAward } from "@/services/season-awards";

import { CyclogazetteAwards } from "./cyclogazette-awards";

const award: SeasonAward = {
  id: "award-1",
  seasonId: "season-2",
  seasonName: "Saison 2",
  gameYear: 2,
  key: "rider_of_year",
  title: "Coureur de l’année",
  description: "Le numéro un de la saison.",
  recipientType: "rider",
  riderId: "rider-1",
  teamId: "team-1",
  sportingDirectorId: null,
  recipientName: "Anaïs Martin",
  teamName: "Vélo Club",
  statValue: 1234,
  statLabel: "points UCI",
  awardedAt: "2026-08-31T20:00:00.000Z",
};

describe("CyclogazetteAwards", () => {
  it("affiche le palmarès permanent dans la Gazette", () => {
    const markup = renderToStaticMarkup(<CyclogazetteAwards awards={[award]} />);

    expect(markup).toContain("Awards du peloton");
    expect(markup).toContain("Anaïs Martin");
    expect(markup).toMatch(/1.234 points UCI/u);
    expect(markup).toContain("/jeu/coureurs/rider-1");
  });

  it("présente une édition spéciale au J1", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteAwards awards={[award]} mode="day-one" />,
    );

    expect(markup).toContain('data-gazette-day-one-awards="true"');
    expect(markup).toContain("Spécial ouverture de saison");
    expect(markup).toContain("/jeu/gazette?onglet=awards");
  });
});
