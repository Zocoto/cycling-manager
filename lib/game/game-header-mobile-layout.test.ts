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
  it("garde la marque et transforme les raccourcis en barre applicative", () => {
    expect(gameHeader).toContain(
      "flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2",
    );
    expect(gameHeader).toContain('className="h-8 w-8 sm:h-12 sm:w-12"');
    expect(gameHeader).toContain('data-mobile-app-name="true"');
    expect(gameHeader).toContain(
      "grid-cols-4 items-center justify-items-center",
    );
    expect(navigationMenu).toContain("inline-flex h-9 w-9 cursor-pointer");
  });

  it("affiche les communications et les autres raccourcis sans second menu", () => {
    const mailboxPosition = gameHeader.indexOf("<DirectorMailboxShortcut");
    const chatPosition = gameHeader.indexOf("<GlobalChatShortcut");

    expect(mailboxPosition).toBeGreaterThan(0);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(gameHeader).toContain("<CyclogazetteShortcut");
    expect(gameHeader).toContain("<TutorialCenterLauncher");
    expect(gameHeader).not.toContain("GameHeaderActionsMenu");
    expect(globalChat).toContain("h-8 w-8 shrink-0");
    expect(globalChat).toContain("sm:h-10 sm:w-10");
    expect(tutorialCenter).toContain("TutorialCenterMenu");
  });

  it("ouvre la barre de recherche depuis la loupe", () => {
    expect(gameHeader).toContain("<GameHeaderSearchToggle");
    expect(searchToggle).toContain('title={isEnglish ? "Search" : "Rechercher"}');
    expect(searchToggle).toContain('aria-haspopup="dialog"');
    expect(gameHeader).toContain('id="game-global-search-mobile"');
    expect(searchToggle).toContain("fixed left-3 right-3 top-[3.75rem]");
    expect(gameHeader).toContain('? "Search for a sports director, team or nation…"');
    expect(gameHeader).toContain(': "Rechercher un DS, une équipe, une nation…"');
  });
});
