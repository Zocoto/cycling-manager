import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Link from "./app-link";

describe("AppLink", () => {
  it("diffère l’aperçu d’une fiche coureur jusqu’à l’interaction", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/coureurs/rider-1">Camille Rapide</Link>,
    );

    expect(markup).not.toContain("data-rider-preview-trigger");
  });

  it("diffère l’aperçu d’une course jusqu’à l’interaction", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/courses/tour-des-alpes">
        Tour des Alpes
      </Link>,
    );

    expect(markup).not.toContain("data-race-preview-trigger");
    expect(markup).toContain("Tour des Alpes");
  });

  it("diffère aussi l’aperçu d’une étape jusqu’à l’interaction", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/resultats/tour-des-alpes/2">Étape 2</Link>,
    );

    expect(markup).not.toContain("data-race-preview-trigger");
  });

  it("laisse un lien d'inscription naviguer directement", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/courses/tour-des-alpes#inscription">
        Inscription
      </Link>,
    );

    expect(markup).toContain(
      'href="/jeu/courses/tour-des-alpes#inscription"',
    );
    expect(markup).toContain(
      'data-navigation-mode="document"',
    );
    expect(markup).not.toContain("data-race-preview-trigger");
  });

  it("preserve l'intention d'inscription avec un objet URL", () => {
    const markup = renderToStaticMarkup(
      <Link
        href={{
          pathname: "/jeu/courses/tour-des-alpes",
          hash: "inscription",
        }}
      >
        Inscription
      </Link>,
    );

    expect(markup).not.toContain("data-race-preview-trigger");
  });

  it("strips Next-only options from a registration document link", () => {
    const markup = renderToStaticMarkup(
      <Link
        href="/jeu/courses/tour-des-alpes#inscription"
        prefetch={false}
        replace
      >
        Inscription
      </Link>,
    );

    expect(markup).toContain(
      'data-navigation-mode="document"',
    );
    expect(markup).not.toContain("prefetch");
    expect(markup).not.toContain("replace");
  });

  it("laisse les autres liens inchangés", () => {
    const markup = renderToStaticMarkup(
      <Link href="/jeu/equipes/team-1">Vélo Club</Link>,
    );

    expect(markup).not.toContain("data-rider-preview-trigger");
    expect(markup).not.toContain("data-race-preview-trigger");
  });
});