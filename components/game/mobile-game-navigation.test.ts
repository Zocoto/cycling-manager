import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/mobile-game-navigation.tsx"),
  "utf8",
);

describe("mobile game navigation", () => {
  it("retire le gala du menu Plus sur téléphone", () => {
    expect(source).not.toContain("SeasonFinaleGalaMenuLink");
  });
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
    expect(source).toContain('["Effectif", "/jeu/effectif", "riders"]');
    expect(source).not.toContain('["Chat", "/jeu/chat", "chat"]');
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

  it("regroupe uniquement les rubriques absentes du header et du dock", () => {
    expect(source).toContain("getGameNavigationGroups");
    expect(source).toContain("getMobileMoreNavigationGroups");
    expect(source).toContain('aria-label={isEnglish ? "Game menu" : "Menu du jeu"}');
    expect(source).not.toContain("Sans doublons");
    expect(source).not.toContain("Autres rubriques");
    expect(source).not.toContain("Uniquement les destinations non affichées ailleurs.");
    expect(source).toContain('data-mobile-more-destination={href}');
    expect(source).toContain("getMobileMoreNavigationGroups");
    expect(source).toContain("max-h-[min(72dvh,42rem)]");
    expect(source).toContain("overflow-y-auto overscroll-contain");
  });
  it("opens the current page's group using stable IDs and retains contextual events",()=>{
    expect(source).toContain("getActiveGameNavigationGroupId");
    expect(source).toContain("expandedGroupIds.has(group.id)");
    expect(source).toContain("data-navigation-group={group.id}");
    expect(source).toContain("NAVIGATION_EVENTS_FR");
    expect(source).not.toContain("expandedGroupIndexes");
    expect(source).toContain("showJerseyWorkshop");
    expect(source).toContain("onNavigate={() => closePanel()}");
  });
});
