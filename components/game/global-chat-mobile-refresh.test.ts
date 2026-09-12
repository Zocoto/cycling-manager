import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const chat = readFileSync(
  join(process.cwd(), "components/game/global-game-chat.tsx"),
  "utf8",
);
const page = readFileSync(join(process.cwd(), "app/jeu/chat/page.tsx"), "utf8");

describe("global chat mobile refresh", () => {
  it("uses the chat route as a mobile app-like full-height surface", () => {
    expect(page).toContain('data-chat-shell="true"');
    expect(page).toContain('data-chat-page="true"');
    expect(chat).toContain('data-chat-hub="true"');
    expect(chat).toContain("--game-mobile-navigation-clearance");
  });

  it("keeps online directors in a secondary mobile sheet", () => {
    expect(chat).toContain("showOnlineDirectors");
    expect(chat).toContain('aria-label="Directeurs Sportifs en ligne"');
    expect(chat).toContain("max-h-[72dvh]");
  });

  it("renders the race origin in the shared global feed", () => {
    expect(chat).toContain("data-chat-race-context={message.raceContext.raceEditionId}");
    expect(chat).toContain("message.raceContext.href");
    expect(chat).toContain("message.raceContext.label");
  });
});
