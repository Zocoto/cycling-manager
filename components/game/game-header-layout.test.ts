import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const headerSource = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);

describe("game header responsive layout", () => {
  it("keeps the primary mobile header on one non-wrapping row", () => {
    expect(headerSource).toContain(
      "items-center gap-3 px-3 py-3 sm:px-8 sm:py-4",
    );
    expect(headerSource).not.toContain("flex-wrap items-center justify-between");
  });

  it("keeps only communication shortcuts beside the compact menu", () => {
    const mailboxPosition = headerSource.indexOf("<DirectorMailboxShortcut");
    const chatPosition = headerSource.indexOf("<GlobalChatShortcut");
    const menuPosition = headerSource.indexOf("<GameHeaderActionsMenu>");

    expect(mailboxPosition).toBeGreaterThan(0);
    expect(chatPosition).toBeGreaterThan(mailboxPosition);
    expect(menuPosition).toBeGreaterThan(chatPosition);
  });

  it("moves mobile search into the compact actions menu", () => {
    expect(headerSource).toContain('id="game-global-search-desktop"');
    expect(headerSource).toContain(
      'className="hidden min-w-0 max-w-xl flex-1 md:flex"',
    );
    expect(headerSource).toContain('id="game-global-search-mobile"');
    expect(headerSource).toContain('className="mb-4 flex md:hidden"');
  });
});
