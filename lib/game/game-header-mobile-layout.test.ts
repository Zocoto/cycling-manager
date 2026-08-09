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

describe("bandeau du jeu sur mobile", () => {
  it("garde le logo, le menu et les raccourcis sur une ligne compacte", () => {
    expect(gameHeader).toContain(
      "items-center gap-3 px-3 py-3 sm:px-8 sm:py-4",
    );
    expect(gameHeader).toContain('className="h-10 w-10 sm:h-12 sm:w-12"');
    expect(gameHeader).toContain(
      'className="ml-auto flex shrink-0 items-center gap-2"',
    );
    expect(navigationMenu).toContain("inline-flex h-9 w-9 cursor-pointer");
  });

  it("garde les communications visibles et range le reste dans le menu compact", () => {
    const mailboxPosition = gameHeader.indexOf("<DirectorMailboxShortcut");
    const chatPosition = gameHeader.indexOf("<GlobalChatShortcut");
    const menuPosition = gameHeader.indexOf("<GameHeaderActionsMenu>");

    expect(mailboxPosition).toBeGreaterThan(0);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(menuPosition).toBeGreaterThan(chatPosition);
    expect(globalChat).toContain("h-9 w-9 shrink-0");
    expect(globalChat).toContain("sm:h-10 sm:w-10");
    expect(tutorialCenter).toContain("TutorialCenterMenu");
  });

  it("affiche la recherche sur desktop et dans le menu sur mobile", () => {
    expect(gameHeader).toContain('id="game-global-search-desktop"');
    expect(gameHeader).toContain(
      'className="hidden min-w-0 max-w-xl flex-1 md:flex"',
    );
    expect(gameHeader).toContain('id="game-global-search-mobile"');
    expect(gameHeader).toContain('className="mb-4 flex md:hidden"');
  });
});
