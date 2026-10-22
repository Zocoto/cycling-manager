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
  academyRiderId: null,
  teamId: "team-1",
  sportingDirectorId: null,
  recipientName: "Anaïs Martin",
  teamName: "Vélo Club",
  statValue: 1234,
  statLabel: "points UCI",
  awardedAt: "2026-08-31T20:00:00.000Z",
};

describe("CyclogazetteAwards", () => {
  it.each([4,5,8])("présente la cérémonie de la saison %s sans texte spécifique à S2", (gameYear) => {
    const markup=renderToStaticMarkup(<CyclogazetteAwards awards={[{...award,gameYear,seasonName:`Saison ${gameYear}`}]} mode="gala"/>);
    expect(markup).toContain(`Soirée des awards · Saison ${gameYear}`);
    expect(markup).not.toContain("deuxième campagne");
    expect(markup).not.toContain("Saison 2");
  });
  it("affiche les nouvelles distinctions et leurs statistiques précises", () => {
    const markup=renderToStaticMarkup(<CyclogazetteAwards mode="gala" awards={[
      {...award,id:'homegrown',key:'homegrown_squad',recipientType:'team',recipientName:'Club école',statValue:66.67,statLabel:'% · 2/3'},
      {...award,id:'national',key:'national_identity',recipientType:'team',recipientName:'Club local',statValue:75,statLabel:'% · 3/4'},
      {...award,id:'international',key:'international_squad',recipientType:'team',recipientName:'Club monde',statValue:9,statLabel:'nationalités'},
    ]}/>);
    expect(markup).toContain("ADN du club");expect(markup).toContain("Fierté nationale");
    expect(markup).toContain("Peloton sans frontières");expect(markup).toContain("66,67 % · 2/3");
    expect(markup).toContain("9 nationalités");
  });
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
    expect(markup).toContain("palmarès complet");
    expect(markup).toContain("/jeu/gazette?onglet=awards");
  });

  it("affiche le mot réel du lauréat et lui réserve le bouton d’édition", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteAwards
        awards={[
          {
            ...award,
            winnerComment: "Une saison gagnée avec tout le collectif.",
            canViewerComment: true,
          },
        ]}
        mode="day-one"
      />,
    );

    expect(markup).toContain('data-award-winner-comment="award-1"');
    expect(markup).toContain("Une saison gagnée avec tout le collectif.");
    expect(markup).toContain("Modifier");
  });
});
