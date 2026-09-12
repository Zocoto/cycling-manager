import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const chat = readFileSync(
  join(process.cwd(), "components/game/global-game-chat.tsx"),
  "utf8",
);
const page = readFileSync(join(process.cwd(), "app/jeu/chat/page.tsx"), "utf8");
const header = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);

describe("global chat mobile refresh", () => {
  it("uses the chat route as a mobile app-like full-height surface", () => {
    expect(page).toContain('data-chat-shell="true"');
    expect(page).toContain('data-chat-page="true"');
    expect(chat).toContain('data-chat-hub="true"');
    expect(chat).toContain("--game-mobile-navigation-clearance");
    expect(page).toContain("compactMobile");
    expect(header).toContain('compactMobile ? "hidden sm:block"');
  });

  it("borne le chat desktop dans une fenêtre avec son propre défilement", () => {
    expect(chat).toContain("sm:h-[clamp(30rem,72dvh,42rem)]");
    expect(chat).toContain("sm:max-h-[calc(100dvh-8rem)]");
    expect(chat).toContain("min-h-0 flex-1 space-y-3 overflow-y-auto");
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

  it("opens on missed messages without forcing readers back to the bottom", () => {
    expect(page).toContain("initialLastReadAt={chat.lastReadAt}");
    expect(chat).toContain('data-chat-unread-divider="true"');
    expect(chat).toContain("firstInitialUnreadMessageId");
    expect(chat).toContain("viewportNearBottomRef.current");
    expect(chat).toContain("pendingLiveMessageCount");
    expect(chat).toContain("scrollToLatestMessages");
  });

  it("replie les messages déjà lus et conserve seulement un contexte récent", () => {
    expect(chat).toContain("GLOBAL_CHAT_RECENT_CONTEXT_MESSAGE_COUNT = 6");
    expect(chat).toContain("compactHistoryStartIndex");
    expect(chat).toContain("timelineMessages.map");
    expect(chat).toContain('data-chat-collapsed-history="true"');
    expect(chat).toContain("Historique replié");
    expect(chat).toContain("revealAndFocusChatMessage");
  });

  it("conserve les réponses et réactions déjà présentes", () => {
    expect(chat).toContain("useGlobalChatReactions");
    expect(chat).toContain("GlobalChatMessageReactions");
    expect(chat).toContain("onReply={beginReply}");
    expect(chat).toContain("message.replyTo");
  });

  it("adds useful local views and loads the federation only on demand", () => {
    expect(chat).toContain('["races", "Courses"]');
    expect(chat).toContain('["mentions", "Mes mentions"]');
    expect(chat).toContain("normalizeChatSearchQuery");
    expect(chat).toContain("hasOpenedFederation");
    expect(chat).toContain("FederationMessagingPanel");
  });
});
