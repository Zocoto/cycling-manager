import { describe, expect, it } from "vitest";

import { createTutorialCatalog } from "@/lib/tutorial/catalog";
import type { TutorialDefinition } from "@/types/tutorial";

function createValidTutorial(
  overrides: Partial<TutorialDefinition> = {},
): TutorialDefinition {
  return {
    key: "dashboard-introduction",
    version: 1,
    type: "contextual",
    title: "Découvrir le bureau",
    description: "Présentation technique de la rubrique.",
    autoStart: false,
    replayable: true,
    steps: [
      {
        key: "welcome",
        route: "/jeu",
        title: "Bienvenue",
        content: "Contenu de test.",
        placement: "center",
      },
      {
        key: "director-card",
        route: "/jeu",
        targetId: "dashboard-director-card",
        title: "Votre profil",
        content: "Contenu de test.",
        placement: "right",
      },
    ],
    ...overrides,
  };
}

describe("createTutorialCatalog", () => {
  it("crée un catalogue indexé par la clé du didacticiel", () => {
    const definition = createValidTutorial();

    const catalog = createTutorialCatalog([definition]);

    expect(catalog["dashboard-introduction"]).toEqual(
      definition,
    );
  });

  it("accepte plusieurs didacticiels aux clés distinctes", () => {
    const dashboardTutorial = createValidTutorial();

    const rosterTutorial = createValidTutorial({
      key: "roster-introduction",
      title: "Découvrir l’effectif",
      steps: [
        {
          key: "roster-list",
          route: "/jeu/effectif",
          targetId: "roster-rider-list",
          title: "Votre effectif",
          content: "Contenu de test.",
        },
      ],
    });

    const catalog = createTutorialCatalog([
      dashboardTutorial,
      rosterTutorial,
    ]);

    expect(Object.keys(catalog)).toEqual([
      "dashboard-introduction",
      "roster-introduction",
    ]);
  });

  it("refuse une clé de didacticiel invalide", () => {
    const definition = createValidTutorial({
      key: "Didacticiel invalide",
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'La clé de didacticiel "Didacticiel invalide" est invalide.',
    );
  });

  it("refuse une version inférieure à 1", () => {
    const definition = createValidTutorial({
      version: 0,
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'La version du didacticiel "dashboard-introduction" doit être positive.',
    );
  });

  it("refuse un didacticiel sans étape", () => {
    const definition = createValidTutorial({
      steps: [],
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'Le didacticiel "dashboard-introduction" ne contient aucune étape.',
    );
  });

  it("refuse deux didacticiels possédant la même clé", () => {
    const firstDefinition = createValidTutorial();
    const secondDefinition = createValidTutorial();

    expect(() =>
      createTutorialCatalog([
        firstDefinition,
        secondDefinition,
      ]),
    ).toThrow(
      'Le didacticiel "dashboard-introduction" est déclaré plusieurs fois.',
    );
  });

  it("refuse deux étapes possédant la même clé", () => {
    const definition = createValidTutorial({
      steps: [
        {
          key: "duplicate-step",
          route: "/jeu",
          title: "Première étape",
          content: "Contenu de test.",
        },
        {
          key: "duplicate-step",
          route: "/jeu",
          title: "Deuxième étape",
          content: "Contenu de test.",
        },
      ],
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'La clé d’étape "duplicate-step" est déclarée plusieurs fois dans le didacticiel "dashboard-introduction".',
    );
  });

  it("refuse une route ne commençant pas par une barre oblique", () => {
    const definition = createValidTutorial({
      steps: [
        {
          key: "invalid-route",
          route: "jeu/effectif",
          title: "Route invalide",
          content: "Contenu de test.",
        },
      ],
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'La route "jeu/effectif" du didacticiel "dashboard-introduction" doit commencer par "/".',
    );
  });

  it("refuse un identifiant de cible invalide", () => {
    const definition = createValidTutorial({
      steps: [
        {
          key: "invalid-target",
          route: "/jeu",
          targetId: "Cible invalide",
          title: "Cible invalide",
          content: "Contenu de test.",
        },
      ],
    });

    expect(() =>
      createTutorialCatalog([definition]),
    ).toThrow(
      'La cible "Cible invalide" du didacticiel "dashboard-introduction" est invalide.',
    );
  });
});