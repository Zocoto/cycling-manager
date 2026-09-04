import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GameSectionTabButton,
  GameSectionTabLink,
  GameSectionTabs,
} from "@/components/game/game-section-tabs";

describe("GameSectionTabs", () => {
  it("reproduit la navigation des récompenses sur desktop et mobile", () => {
    const markup = renderToStaticMarkup(
      <GameSectionTabs ariaLabel="Rubriques" columns={3} className="mt-7">
        <GameSectionTabLink
          href="/jeu/exemple?onglet=actif"
          active
          label="Onglet actif"
          description="Description active"
          badge={2}
        />
        <GameSectionTabLink
          href="/jeu/exemple?onglet=inactif"
          active={false}
          label="Onglet inactif"
        />
      </GameSectionTabs>,
    );

    expect(markup).toContain('aria-label="Rubriques"');
    expect(markup).toContain("sm:grid-cols-3");
    expect(markup).not.toContain("grid-cols-3 sm:grid-cols-3");
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain("bg-[#123F36]");
    expect(markup).toContain("Description active");
    expect(markup).not.toContain("Description inactive");
    expect(markup).toContain(">2</span>");
  });

  it("conserve la sémantique des onglets interactifs", () => {
    const markup = renderToStaticMarkup(
      <GameSectionTabs ariaLabel="Rubriques interactives" columns={2} role="tablist">
        <GameSectionTabButton
          id="tab-active"
          active
          label="Vue active"
          description="Détail"
          ariaControls="panel-active"
          onClick={() => undefined}
        />
      </GameSectionTabs>,
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-controls="panel-active"');
  });

  it("accepte une rubrique dense de six onglets sans serrer le mobile", () => {
    const markup = renderToStaticMarkup(
      <GameSectionTabs ariaLabel="Fédération" columns={6}>
        <GameSectionTabLink href="/one" active label="Un" />
        <GameSectionTabLink href="/two" active={false} label="Deux" />
      </GameSectionTabs>,
    );

    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain("lg:grid-cols-3");
    expect(markup).toContain("2xl:grid-cols-6");
  });

  it("accepte les sept rubriques de la fédération", () => {
    const markup = renderToStaticMarkup(
      <GameSectionTabs ariaLabel="Fédération" columns={7}>
        <GameSectionTabLink href="/courses" active label="Courses" />
      </GameSectionTabs>,
    );

    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain("lg:grid-cols-4");
    expect(markup).toContain("2xl:grid-cols-7");
  });
});
