import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layout = readFileSync("app/jeu/layout.tsx", "utf8");
const heartbeat = readFileSync(
  "components/game/game-presence-heartbeat.tsx",
  "utf8",
);
const chat = readFileSync("components/game/global-game-chat.tsx", "utf8");
const chatPage = readFileSync("app/jeu/chat/page.tsx", "utf8");
const chatService = readFileSync("services/global-chat.ts", "utf8");

describe("global site presence integration", () => {
  it("mounts one lightweight heartbeat for every authenticated game route", () => {
    expect(layout).toContain("<GamePresenceHeartbeat />");
    expect(heartbeat).toContain('rpc("record_current_game_presence")');
    expect(heartbeat).toContain('document.visibilityState !== "visible"');
    expect(heartbeat).toContain("window.localStorage.setItem");
    expect(heartbeat).toContain("GAME_PRESENCE_HEARTBEAT_INTERVAL_MS");
    expect(heartbeat).toContain('import("@/lib/supabase/client")');
    expect(heartbeat).not.toContain(
      'import { createSupabaseBrowserClient } from "@/lib/supabase/client"',
    );
  });

  it("loads online directors on the server and refreshes only while chat is open", () => {
    expect(chatService).toContain('rpc("get_online_global_chat_directors_v2")');
    expect(chatPage).toContain(
      "initialOnlineDirectors={chat.onlineDirectors}",
    );
    expect(chat).toContain('rpc("get_online_global_chat_directors_v2")');
    expect(chat).toContain("GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS");
    expect(chat).toContain("GLOBAL_CHAT_ONLINE_WINDOW_MINUTES");
    expect(chat).toContain("Online");
    expect(chat).toContain("mergeGlobalChatOnlineDirectors");
  });
});
