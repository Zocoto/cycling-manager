import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Link from "./app-link";

describe("AppLink", () => {
  it("active automatiquement l’aperçu sur une fiche coureur", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/coureurs/rider-1">Camille Rapide</Link>,
    );

    expect(markup).toContain("data-rider-preview-trigger");
    expect(markup).toContain('aria-haspopup="dialog"');
  });

  it("active automatiquement l’aperçu sur une course", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/courses/tour-des-alpes">
        Tour des Alpes
      </Link>,
    );

    expect(markup).toContain("data-race-preview-trigger");
    expect(markup).toContain("Tour des Alpes");
  });

  it("active automatiquement l’aperçu sur une étape", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/resultats/tour-des-alpes/2">Étape 2</Link>,
    );

    expect(markup).toContain("data-race-preview-trigger");
  });

  it("laisse les autres liens inchangés", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/equipes/team-1">Vélo Club</Link>,
    );

    expect(markup).not.toContain("data-rider-preview-trigger");
    expect(markup).not.toContain("data-race-preview-trigger");
  });
});