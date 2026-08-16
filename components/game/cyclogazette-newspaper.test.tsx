import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";

import { CyclogazetteNewspaper } from "./cyclogazette-newspaper";

const teamVisual = {
  name: "Veloria Mobilités",
  logoPath: "/sponsors/veloria/logo.png",
  sponsorName: "Veloria",
  jersey: {
    primaryColor: "#1E5A46",
    secondaryColor: "#F1C84B",
    accentColor: "#FFFFFF",
    pattern: "diagonal" as const,
    status: "sponsored" as const,
    imagePath: "/sponsors/veloria/jersey.png",
  },
  jerseyArtwork: {
    kind: "sponsor" as const,
    imagePath: "/sponsors/veloria/jersey.png",
  },
  colors: {
    primary: "#1E5A46",
    secondary: "#F1C84B",
    accent: "#FFFFFF",
    background: "#F8F3E4",
    text: "#102D25",
  },
};

const edition: CyclogazetteEdition = {
  id: "edition-1",
  issueNumber: 12,
  seasonName: "2",
  dayNumber: 5,
  issueDate: "2026-08-02",
  title: "La Cyclogazette",
  subtitle: "Timo Willems impose sa pointe de vitesse",
  publishedAt: "2026-08-02T18:00:00.000Z",
  content: {
    lead: {
      id: "victory-1",
      kind: "victory",
      title: "Timo Willems règne sur le Circuit de Mazurie",
      detail: "Le sprinteur de Veloria Mobilités s’impose au terme d’un final maîtrisé.",
      happenedAt: "2026-08-02T16:00:00.000Z",
      href: "/jeu/resultats/circuit-de-mazurie",
      visual: {
        person: {
          kind: "rider",
          profileKey: null,
          seed: "timo-willems",
          label: "Timo Willems",
        },
        team: teamVisual,
        raceProfile: [
          {
            segmentNumber: 1,
            distanceKm: 10,
            terrain: "flat",
            averageGradientPct: 0,
            surface: "asphalt",
            prime: null,
          },
          {
            segmentNumber: 2,
            distanceKm: 10,
            terrain: "climb",
            averageGradientPct: 3.2,
            surface: "asphalt",
            prime: null,
          },
        ],
      },
    },
    raceStories: [],
    raceHighlights: [
      {
        id: "incident-1",
        kind: "race_recap",
        raceEventKind: "incident",
        title: "Une bordure piège plusieurs favoris",
        detail: "Le vent a coupé le peloton en trois groupes.",
        happenedAt: "2026-08-02T15:50:00.000Z",
        visual: {
          person: {
            kind: "rider",
            profileKey: null,
            seed: "rider-caught",
            label: "Coureur piégé",
          },
          team: teamVisual,
        },
      },
    ],
    mercatoStories: [],
    reactions: [
      {
        interviewId: "interview-1",
        directorName: "Roger Letesteur",
        directorAvatarKey: null,
        teamId: "team-1",
        teamName: "Veloria Mobilités",
        raceName: "Circuit de Mazurie",
        stageName: "Circuit de Mazurie",
        question: "Quand avez-vous compris que la victoire était possible ?",
        answer: "À cinq kilomètres, toute l’équipe était encore parfaitement placée.",
        closingNote: "On savoure ce succès collectif.",
        answers: [
          {
            questionId: "win-belief",
            question: "Quand avez-vous compris que la victoire était possible ?",
            answer: "À cinq kilomètres, toute l’équipe était encore parfaitement placée.",
          },
          {
            questionId: "tactics-leader",
            question: "Comment avez-vous préparé le sprint ?",
            answer: "Le train a protégé Timo jusque dans le dernier virage.",
          },
        ],
      },
    ],
  },
};

describe("CyclogazetteNewspaper", () => {
  it("met la course et le vainqueur en Une avec le maillot de son équipe", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={edition} />,
    );

    expect(markup).toContain("Les vainqueurs des étapes");
    expect(markup).toContain("Vainqueur à la Une");
    expect(markup).toContain("Timo Willems règne sur le Circuit de Mazurie");
    expect(markup).toContain("Maillot vainqueur · Veloria Mobilités");
    expect(markup).toContain("Maillot de Veloria Mobilités");
    expect(markup).toContain("Les forçats de la route");
    expect(markup).toContain("Incident de course");
    expect(markup).not.toContain("lg:col-span-8");
    expect(markup).not.toContain("lg:col-span-4");
  });

  it("équilibre les articles sans grande colonne latérale vide", () => {
    const markup = renderToStaticMarkup(<CyclogazetteNewspaper edition={edition} />);
    expect(markup.match(/flex-\[1_1_290px\]/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("affiche la question et permet de déplier toutes les réponses du DS", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={edition} />,
    );

    expect(markup).toContain(
      "Quand avez-vous compris que la victoire était possible ?",
    );
    expect(markup).toContain("Détail de l’interview");
    expect(markup).toContain("Comment avez-vous préparé le sprint ?");
    expect(markup).toContain("Le dernier mot du DS");
  });

  it("devient Cyclo Gazetta sur papier rose de J2 à J7", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={{ ...edition, dayNumber: 7 }} />,
    );

    expect(markup).toContain('data-gazette-theme="giro"');
    expect(markup).toContain("Cyclo Gazetta");
    expect(markup).toContain("Edizione rosa");
    expect(markup).toContain("Il giornale del Giro");
    expect(markup).toContain("--gazette-paper:#F2B8C6");
  });

  it("reprend La Cyclogazette et son papier classique dès J8", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={{ ...edition, dayNumber: 8 }} />,
    );

    expect(markup).toContain('data-gazette-theme="classic"');
    expect(markup).toContain("La Cyclogazette");
    expect(markup).not.toContain("Cyclo Gazetta");
    expect(markup).not.toContain("Edizione rosa");
    expect(markup).toContain("--gazette-paper:#F4EBD2");
  });
});
