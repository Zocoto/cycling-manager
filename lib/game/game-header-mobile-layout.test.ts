import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const gameHeader = readSource("components/game/game-header.tsx");
const navigationMenu = readSource(
  "components/game/game-navigation-menu.tsx",
);
const globalChat = readSource(
  "components/game/global-chat-shortcut.tsx",
);
const tutorialCenter = readSource(
  "components/tutorial/tutorial-center-menu.tsx",
);

describe("bandeau du jeu sur mobile", () => {
  it("garde le logo, le menu et les raccourcis sur une ligne compacte", () => {
    expect(gameHeader).toContain(
      "gap-x-2 gap-y-2 px-3 pb-3 pt-3 sm:gap-x-5",
    );
    expect(gameHeader).toContain(
      'className="h-10 w-10 sm:h-12 sm:w-12"',
    );
    expect(gameHeader).toContain(
      'className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2"',
    );
    expect(navigationMenu).toContain(
      "inline-flex h-9 w-9 cursor-pointer",
    );
  });

  it("compacte tous les raccourcis sans modifier leur taille hors mobile", () => {
    expect(gameHeader).toContain(
      "group inline-flex h-9 w-9 shrink-0",
    );
    expect(gameHeader.match(/sm:h-10 sm:w-10/g)).toHaveLength(3);
    expect(globalChat).toContain("h-9 w-9 shrink-0");
    expect(globalChat).toContain("sm:h-10 sm:w-10");
    expect(tutorialCenter).toContain("h-9 w-9 shrink-0");
    expect(tutorialCenter).toContain("sm:h-10 sm:w-10");
  });

  it("conserve la recherche sur la seule seconde ligne", () => {
    expect(gameHeader).toContain(
      'className="order-3 flex w-full min-w-0 items-center lg:order-none',
    );
    expect(gameHeader).toContain(
      "bg-transparent px-2.5 py-2 text-sm",
    );
    expect(gameHeader).toContain(
      "m-1 inline-flex h-8 w-8 shrink-0",
    );
  });
});
