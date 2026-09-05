import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CyclogazetteEdition } from "@/lib/game/cyclogazette";
import type { CyclogazetteInterviewReactionStates } from "@/lib/game/cyclogazette-interview-reactions";

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
          age: 31,
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
            age: 27,
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

const interviewReactions: CyclogazetteInterviewReactionStates = {
  "interview-1": {
    canReact: true,
    answers: {
      "win-belief": [{ emoji: "😂", count: 2, reactedByViewer: false }],
    },
  },
};

describe("CyclogazetteNewspaper", () => {
  it("place le palmarès d'ouverture avant la Une", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, dayNumber: 1 }}
        seasonOpeningAwards={<aside>Palmarès de la saison passée</aside>}
      />,
    );

    expect(markup.indexOf("Palmarès de la saison passée")).toBeLessThan(
      markup.indexOf("Les vainqueurs des étapes"),
    );
  });

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
      <CyclogazetteNewspaper
        edition={edition}
        interviewReactions={interviewReactions}
      />,
    );

    expect(markup).toContain(
      "Quand avez-vous compris que la victoire était possible ?",
    );
    expect(markup).toContain("Détail de l’interview");
    expect(markup).toContain("Comment avez-vous préparé le sprint ?");
    expect(markup).toContain("Le dernier mot du DS");
    expect(markup).toContain("Votre impression");
    expect(markup.match(/data-interview-answer-reactions="win-belief"/g)).toHaveLength(2);
    expect(markup).toContain("Trait d’humour · 2");
    expect(markup).toContain("Réponse marquante");
    expect(markup).toContain('aria-label="Pas d’accord"');
    expect(markup).toContain('aria-label="Pas convaincu"');
    expect(markup).toContain('aria-label="Ça fâche"');
    expect(markup).toContain('aria-label="Mauvais perdant"');
    expect(markup.match(/data-reaction-sentiment="negative"/g)).toHaveLength(
      12,
    );
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
    expect(markup).toContain('data-gazetta-tricolore="true"');
    expect(markup).toContain("Pubblicità italiana");
    expect(markup).toContain("Pasta Passista");
    expect(markup).toContain("Cronaca rosa");
    expect(markup).toContain("Le chat Coppi neutralise le peloton");
    expect(markup).toContain("Un mécanicien gonfle un ravioli à huit bars");
    expect(markup).toContain("Une attaque déclenchée par le mot « pasta »");
  });

  it("fait tourner les réclames et les brèves italiennes selon le numéro", () => {
    const tiramisuMarkup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 13, dayNumber: 5 }}
      />,
    );
    const pizzaMarkup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 14, dayNumber: 5 }}
      />,
    );

    expect(tiramisuMarkup).toContain("Tiramisù Domestique");
    expect(tiramisuMarkup).toContain("Le bus des DS doublé par une Vespa");
    expect(tiramisuMarkup).toContain(
      "Un sprinteur porte plainte contre la tour de Pise",
    );
    expect(tiramisuMarkup).toContain(
      "Le classement général bouleversé par un tiramisù",
    );
    expect(pizzaMarkup).toContain("Pizza a Ruota");
  });

  it("adopte la maquette d’un quotidien sportif français pendant le Tour", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 12, dayNumber: 9 }}
      />,
    );

    expect(markup).toContain('data-gazette-theme="tour"');
    expect(markup).toContain('data-gazette-masthead="tour"');
    expect(markup).toContain("LA CYCLOGAZETTE");
    expect(markup).toContain("Édition spéciale");
    expect(markup).toContain("Le quotidien du Tour");
    expect(markup).toContain("--gazette-paper:#F5F4EF");
    expect(markup).toContain("--gazette-accent:#E30613");
    expect(markup).toContain('data-gazette-tricolore="france"');
    expect(markup).toContain('data-gazette-tour-rubriques="true"');
    expect(markup).toContain("Maillot jaune");
    expect(markup).toContain('data-gazette-section-title="sports-daily"');
    expect(markup).toContain('data-gazette-french-chronicle="true"');
    expect(markup).toContain("La réclame du Tour");
    expect(markup).toContain("Baguette Braquet");
    expect(markup).toContain("Une baguette se glisse dans l’échappée");
    expect(markup).toContain("Le béret déclaré plus aérodynamique qu’un casque");
    expect(markup).toContain(
      "Trois croissants attribués au classement de la montagne",
    );
  });

  it("fait tourner les histoires de chocolatine, choucroute et cassoulet", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 13, dayNumber: 15 }}
      />,
    );

    expect(markup).toContain("Croissant de l’Échappée");
    expect(markup).toContain(
      "Pain au chocolat ou chocolatine : le peloton coupé en deux",
    );
    expect(markup).toContain("La choucroute remplace le gel énergétique");
    expect(markup).toContain("Le cassoulet provoque un vent de côté");
  });

  it("retrouve la maquette classique après le Tour français", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={{ ...edition, dayNumber: 16 }} />,
    );

    expect(markup).toContain('data-gazette-theme="classic"');
    expect(markup).not.toContain('data-gazette-french-chronicle="true"');
    expect(markup).not.toContain("La réclame du Tour");
    expect(markup).toContain("--gazette-paper:#F4EBD2");
  });

  it("adopte une maquette façon quotidien sportif espagnol de J17 à J22", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 12, dayNumber: 17 }}
      />,
    );

    expect(markup).toContain('data-gazette-theme="vuelta"');
    expect(markup).toContain('data-gazette-masthead="vuelta"');
    expect(markup).toContain("CICLO MARCA");
    expect(markup).toContain("Edición roja");
    expect(markup).toContain("El diario de la Vuelta");
    expect(markup).toContain("--gazette-paper:#F5F3EE");
    expect(markup).toContain("--gazette-accent:#D71920");
    expect(markup).toContain('data-gazette-tricolore="spain"');
    expect(markup).toContain('data-gazette-tour-rubriques="vuelta"');
    expect(markup).toContain("Maillot rojo");
    expect(markup).toContain("Los favoritos");
    expect(markup).toContain('data-gazette-spanish-chronicle="true"');
    expect(markup).toContain("Publicidad de la Vuelta");
    expect(markup).toContain("Paella Pelotón");
    expect(markup).toContain(
      "Des castagnettes prises pour un dérailleur électronique",
    );
    expect(markup).toContain(
      "Le jambon ibérique passe le contrôle aérodynamique",
    );
    expect(markup).toContain(
      "Don Quichotte attaque les éoliennes du dernier col",
    );
  });

  it("fait tourner trois brèves parmi les dix histoires espagnoles", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{ ...edition, issueNumber: 13, dayNumber: 22 }}
      />,
    );

    expect(markup).toContain("Tapas de Meta");
    expect(markup).toContain("Un bidon de sangria saisi avant le sprint");
    expect(markup).toContain(
      "Une paella neutralise la zone de ravitaillement",
    );
    expect(markup).toContain("Les tapas provoquent une bordure au comptoir");
    expect(markup.match(/Vuelta confidencial/g)).toHaveLength(3);
  });

  it("retrouve la maquette classique après le Tour espagnol", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={{ ...edition, dayNumber: 23 }} />,
    );

    expect(markup).toContain('data-gazette-theme="classic"');
    expect(markup).not.toContain('data-gazette-spanish-chronicle="true"');
    expect(markup).not.toContain("Publicidad de la Vuelta");
  });

  it("publie les nouveaux dossiers éditoriaux avec leurs liens directs", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper
        edition={{
          ...edition,
          content: {
            ...edition.content,
            featureStories: [
              {
                id: "startlist:1",
                kind: "startlist",
                kicker: "Start-list · J18",
                kickerEn: "Start list · Day 18",
                title: "Les favoris sortent du bois",
                titleEn: "The favourites step forward",
                body: "Une sélection ambitieuse se présente au départ.",
                bodyEn: "An ambitious selection lines up at the start.",
                href: "/jeu/courses/ruta-de-las-sierras",
              },
              {
                id: "injury:1",
                kind: "injury",
                kicker: "Carnet de convalescence",
                kickerEn: "Recovery diary",
                title: "Dans la roue de la convalescence",
                titleEn: "Following the road to recovery",
                body: "Le coureur prépare déjà son retour.",
                bodyEn: "The rider is already preparing a comeback.",
              },
            ],
          },
        }}
      />,
    );

    expect(markup).toContain('data-gazette-editorial-features="true"');
    expect(markup).toContain('data-gazette-feature-kind="startlist"');
    expect(markup).toContain('data-gazette-feature-kind="injury"');
    expect(markup).toContain("Les histoires qui préparent demain");
    expect(markup).toContain("Les favoris sortent du bois");
    expect(markup).toContain('href="/jeu/courses/ruta-de-las-sierras"');
  });

  it("reprend La Cyclogazette et son papier classique dès J8", () => {
    const markup = renderToStaticMarkup(
      <CyclogazetteNewspaper edition={{ ...edition, dayNumber: 8 }} />,
    );

    expect(markup).toContain('data-gazette-theme="classic"');
    expect(markup).toContain("La Cyclogazette");
    expect(markup).not.toContain("Cyclo Gazetta");
    expect(markup).not.toContain("Edizione rosa");
    expect(markup).not.toContain("Pubblicità italiana");
    expect(markup).not.toContain("Cronaca rosa");
    expect(markup).toContain("--gazette-paper:#F4EBD2");
  });
});
