import { describe, expect, it } from "vitest";

import {
  hasDynamicTutorialRouteSegment,
  matchesTutorialRoute,
  resolveTutorialProgressRoute,
} from "@/lib/tutorial/routes";

describe("tutorial routes", () => {
  it("reconnaît une fiche coureur concrète depuis sa route dynamique", () => {
    expect(
      matchesTutorialRoute(
        "/jeu/coureurs/[identifiant]",
        "/jeu/coureurs/4e4c2da7-830f-4d7b-8a2e-785f9fc768a4",
      ),
    ).toBe(true);
  });

  it("refuse une autre rubrique ou un nombre de segments différent", () => {
    expect(
      matchesTutorialRoute(
        "/jeu/coureurs/[identifiant]",
        "/jeu/equipes/4e4c2da7-830f-4d7b-8a2e-785f9fc768a4",
      ),
    ).toBe(false);
    expect(
      matchesTutorialRoute(
        "/jeu/coureurs/[identifiant]",
        "/jeu/coureurs/identifiant/historique",
      ),
    ).toBe(false);
  });

  it("distingue les routes statiques des routes à résoudre", () => {
    expect(hasDynamicTutorialRouteSegment("/jeu/effectif")).toBe(false);
    expect(
      hasDynamicTutorialRouteSegment("/jeu/coureurs/[identifiant]"),
    ).toBe(true);
  });
  it("conserve la route concrète d’une fiche lors d’une reprise", () => {
    expect(
      resolveTutorialProgressRoute({
        routePattern: "/jeu/coureurs/[identifiant]",
        savedRoute: "/jeu/coureurs/abc-123",
        preserveSavedRoute: true,
      }),
    ).toBe("/jeu/coureurs/abc-123");
    expect(
      resolveTutorialProgressRoute({
        routePattern: "/jeu/coureurs/[identifiant]",
        savedRoute: "/jeu/equipes/abc-123",
        preserveSavedRoute: true,
      }),
    ).toBe("/jeu/coureurs/[identifiant]");
  });

  it("distingue les onglets portés par les paramètres d’URL", () => {
    expect(
      matchesTutorialRoute(
        "/jeu/entrainement?onglet=reconnaissance",
        "/jeu/entrainement?onglet=reconnaissance",
      ),
    ).toBe(true);
    expect(
      matchesTutorialRoute(
        "/jeu/entrainement",
        "/jeu/entrainement?onglet=reconnaissance",
      ),
    ).toBe(false);
    expect(
      matchesTutorialRoute(
        "/jeu/entrainement?onglet=reconnaissance",
        "/jeu/entrainement",
      ),
    ).toBe(false);
  });

  it("compare les paramètres indépendamment de leur ordre", () => {
    expect(
      matchesTutorialRoute(
        "/jeu/entrainement?onglet=reconnaissance&source=centre",
        "/jeu/entrainement?source=centre&onglet=reconnaissance",
      ),
    ).toBe(true);
  });});
