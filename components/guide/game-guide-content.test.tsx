import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/public/public-link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: async () => "fr" }));

import GuidePage, { generateMetadata } from "@/app/(public)/guide/page";
import { SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR } from "@/lib/game/sponsor-main-objective";
import { GameGuideContent } from "./game-guide-content";

const anchors = [
  "demarrage", "journee", "coureurs", "courses", "baremes", "equipe",
  "sponsors", "structures", "progression", "pages",
];

describe("shared game manual", () => {
  it("retains the complete manual alongside the new practical guides", async () => {
    const html = renderToStaticMarkup(await GuidePage());
    expect(html).toContain(renderToStaticMarkup(<GameGuideContent />));
    expect(html).toContain('href="/guide/premieres-courses"');
    expect(html).toContain('href="/guide/entrainement-forme"');
    expect(html).toContain('href="/guide/recrutement-budget"');
  });

  it("retains the public canonical, title and social metadata", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBe("Guide complet du Directeur Sportif");
    expect(metadata.alternates).toMatchObject({ canonical: "https://cyclostratege.fr/guide" });
    expect(metadata.description).toContain("Le manuel complet de Cyclo Stratège");
    expect(metadata.openGraph).toMatchObject({
      url: "https://cyclostratege.fr/guide",
      title: "Guide complet du Directeur Sportif",
      locale: "fr_FR",
    });
  });

  it.each([false, true])("keeps all anchors and the complete table of contents (inGame=%s)", (inGame) => {
    const html = renderToStaticMarkup(<GameGuideContent inGame={inGame} />);
    const sectionIds = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);
    const toc = html.match(/<nav[^>]*aria-label="Sommaire du guide"[\s\S]*?<\/nav>/)?.[0];

    expect(sectionIds).toEqual(anchors);
    expect(toc).toBeTruthy();
    for (const anchor of anchors) {
      expect(toc).toContain(`href="#${anchor}"`);
    }
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Directeur financier");
    expect(html).toContain("Les notes déjà acquises sont conservées");
    expect(html).toContain("Poids et surpoids : seuils et barème");
  });

  it.each([false, true])("explains the future main-objective reward caps (inGame=%s)", (inGame) => {
    const html = renderToStaticMarkup(<GameGuideContent inGame={inGame} />);

    expect(html).toContain(`À partir de la saison ${SPONSOR_MAIN_OBJECTIVE_BUDGET_CAP_START_GAME_YEAR}`);
    expect(html).toContain("10 % du budget annuel du sponsor pour un Top N, 12,5 % pour un podium et 15 % pour une victoire");
    expect(html).toContain("la pénalité de réputation diminue dans la même proportion");
    expect(html).toContain("Un budget de renouvellement revu à la baisse peut réduire la prime annoncée");
  });

  it("keeps all destinations inside the game or on this manual, without a new tab", () => {
    const html = renderToStaticMarkup(<GameGuideContent inGame />);
    const destinations = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(destinations.length).toBeGreaterThan(40);
    expect(destinations.every((href) => href.startsWith("#") || href === "/jeu" || href.startsWith("/jeu/"))).toBe(true);
    expect(html).not.toContain("target=");
    expect(html).not.toContain('href="/connexion"');
    expect(html).not.toContain('href="/guide');
    expect(html).not.toContain("signOut");
  });

  it("invites public visitors to create a team while preserving connected actions", () => {
    const publicHtml = renderToStaticMarkup(<GameGuideContent />);
    const connectedHtml = renderToStaticMarkup(<GameGuideContent inGame />);
    const publicStart = publicHtml.match(/<section id="demarrage"[\s\S]*?<\/section>/)?.[0];
    const connectedStart = connectedHtml.match(/<section id="demarrage"[\s\S]*?<\/section>/)?.[0];

    expect(publicHtml.match(/href="\/inscription"/g)).toHaveLength(2);
    expect(publicHtml).toContain("Créer mon équipe gratuitement");
    expect(publicHtml).not.toContain("Ouvrir mon bureau");
    expect(publicHtml).not.toContain("Retourner au bureau");
    expect(publicStart).not.toContain('href="/jeu/');
    expect(connectedStart).toContain('href="/jeu/effectif"');
    expect(connectedHtml).toContain("Ouvrir mon bureau");
    expect(connectedHtml).toContain("Retourner au bureau");
    expect(connectedHtml).not.toContain('href="/inscription"');
    expect(publicHtml).not.toContain("septembre 2026");
  });

  it("keeps mobile navigation scrollable and tables locally contained", () => {
    const html = renderToStaticMarkup(<GameGuideContent inGame />);
    const toc = html.match(/<nav[^>]*aria-label="Sommaire du guide"[\s\S]*?<\/nav>/)?.[0];

    expect(toc).toContain("overflow-x-auto");
    expect(toc).toContain("shrink-0");
    expect(toc).toContain("lg:top-0");
    expect(toc).not.toContain("lg:top-[89px]");
    expect(html).toContain("overflow-x-auto rounded-xl");
    expect(html).toContain("sm:grid-cols-");
  });
});
