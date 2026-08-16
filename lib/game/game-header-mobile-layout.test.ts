import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const gameHeader = readSource("components/game/game-header.tsx");
const navigationMenu = readSource("components/game/game-navigation-menu.tsx");
const globalChat = readSource("components/game/global-chat-shortcut.tsx");
const tutorialCenter = readSource(
  "components/tutorial/tutorial-center-menu.tsx",
);
const searchToggle = readSource(
  "components/game/game-header-search-toggle.tsx",
);

describe("bandeau du jeu sur mobile", () => {
  it("garde le logo, le menu et une barre d’icônes compacte", () => {
    expect(gameHeader).toContain(
      "flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3",
    );
    expect(gameHeader).toContain('className="h-10 w-10 sm:h-12 sm:w-12"');
    expect(gameHeader).toContain(
      "order-3 ml-auto flex w-full flex-wrap items-center justify-end gap-px",
    );
    expect(navigationMenu).toContain("inline-flex h-9 w-9 cursor-pointer");
  });

  it("affiche les communications et les autres raccourcis sans second menu", () => {
    const mailboxPosition = gameHeader.indexOf("<DirectorMailboxShortcut");
    const chatPosition = gameHeader.indexOf("<GlobalChatShortcut");

    expect(mailboxPosition).toBeGreaterThan(0);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(gameHeader).toContain("<CyclogazetteShortcut");
    expect(gameHeader).toContain("<TutorialCenterMenu");
    expect(gameHeader).not.toContain("GameHeaderActionsMenu");
    expect(globalChat).toContain("h-8 w-8 shrink-0");
    expect(globalChat).toContain("sm:h-10 sm:w-10");
    expect(tutorialCenter).toContain("TutorialCenterMenu");
  });

  it("ouvre la barre de recherche depuis la loupe", () => {
    expect(gameHeader).toContain("<GameHeaderSearchToggle");
    expect(searchToggle).toContain('title="Rechercher"');
    expect(searchToggle).toContain('aria-haspopup="dialog"');
    expect(gameHeader).toContain('? "Search for a sports director, team or nation…"');
    expect(gameHeader).toContain(': "Rechercher un DS, une équipe, une nation…"');
  });
});
