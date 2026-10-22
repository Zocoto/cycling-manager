import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/app-link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));

import GuidePage, { metadata } from "@/app/(public)/guide/page";
import { GameGuideContent } from "./game-guide-content";

const anchors = [
  "demarrage", "journee", "coureurs", "courses", "baremes", "equipe",
  "sponsors", "structures", "progression", "pages",
];

describe("shared game manual", () => {
  it("renders exactly the same manual on the public route", () => {
    expect(renderToStaticMarkup(<GuidePage />)).toBe(
      renderToStaticMarkup(<GameGuideContent />),
    );
  });

  it("retains the public canonical, title and social metadata", () => {
    expect(metadata.title).toBe("Guide complet du Directeur Sportif");
    expect(metadata.alternates).toEqual({ canonical: "/guide" });
    expect(metadata.description).toContain("Le manuel complet de Cyclo Stratège");
    expect(metadata.openGraph).toEqual({
      url: "/guide",
      title: "Guide du jeu de management cycliste Cyclo Stratège",
      description: "Calendrier, courses, entraînement, staff, transferts, finances et progression : préparez votre carrière de directeur sportif.",
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
