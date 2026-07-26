import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Link from "./app-link";

describe("AppLink", () => {
  it("active automatiquement l’aperçu sur une fiche coureur", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/coureurs/rider-1">Camille Rapide</Link>
    );

    expect(markup).toContain("data-rider-preview-trigger");
    expect(markup).toContain('aria-haspopup="dialog"');
  });

  it("laisse les autres liens inchangés", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/equipes/team-1">Vélo Club</Link>
    );

    expect(markup).not.toContain("data-rider-preview-trigger");
  });
});
