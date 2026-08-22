import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/mobile-game-navigation.tsx"),
  "utf8",
);

describe("mobile game navigation", () => {
  it("offre cinq destinations majeures accessibles au pouce", () => {
    for (const href of [
      '"/jeu"',
      '"/jeu/effectif"',
      '"/jeu/calendrier"',
      '"/jeu/transferts"',
    ]) {
      expect(source).toContain(href);
    }

    expect(source).toContain("grid-cols-5");
    expect(source).toContain("sm:hidden");
  });

  it("ouvre un centre de course dédié aux trois moments du parcours", () => {
    expect(source).toContain('type MobilePanel = "races" | "more"');
    expect(source).toContain('data-mobile-panel="races"');
    expect(source).toContain('aria-controls={`${panelId}-races`}');
    expect(source).toContain("Centre de course");

    for (const destination of [
      'href: "/jeu/calendrier"',
      'href: "/jeu/preparation-course"',
      'href: "/jeu/resultats"',
    ]) {
      expect(source).toContain(destination);
    }

    expect(source).toContain('data-course-destination={item.icon}');
  });

  it("signale toutes les pages rattachées aux courses comme actives", () => {
    expect(source).toContain("COURSE_PATH_PREFIXES");
    expect(source).toContain('"/jeu/courses"');
    expect(source).toContain('"/jeu/championnats-nationaux"');
    expect(source).toContain('"/jeu/selections-internationales"');
    expect(source).toContain('aria-current={racesActive ? "page" : undefined}');
  });

  it("regroupe toutes les autres rubriques dans une vue d’ensemble", () => {
    expect(source).toContain("NAVIGATION_GROUPS_FR");
    expect(source).toContain("Toutes les rubriques");
    expect(source).toContain("max-h-[min(72dvh,42rem)]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
  });
});
