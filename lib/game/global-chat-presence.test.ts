import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GAME_ONLINE_WINDOW_MINUTES,
  GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
  GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS,
} from "@/lib/game/game-presence";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814160000_track_recent_game_presence.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");
const gameLayout = readFileSync(
  resolve(process.cwd(), "app/jeu/layout.tsx"),
  "utf8",
);
const heartbeat = readFileSync(
  resolve(process.cwd(), "components/game/game-presence-heartbeat.tsx"),
  "utf8",
);
const chat = readFileSync(
  resolve(process.cwd(), "components/game/global-game-chat.tsx"),
  "utf8",
);

describe("global game presence", () => {
  it("records activity from every game page while it is visible", () => {
    expect(gameLayout).toContain("<GamePresenceHeartbeat />");
    expect(heartbeat).toContain(
      'supabase.rpc("record_current_game_presence")',
    );
    expect(heartbeat).toContain('document.visibilityState === "visible"');
    expect(GAME_PRESENCE_HEARTBEAT_INTERVAL_MS).toBeLessThan(
      GAME_ONLINE_WINDOW_MINUTES * 60 * 1_000,
    );
  });

  it("keeps only active human directors seen in the last twenty minutes", () => {
    expect(migration).toContain("add column last_seen_at timestamptz");
    expect(migration).toContain("interval '20 minutes'");
    expect(migration).toContain("director.status = 'active'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(GAME_ONLINE_WINDOW_MINUTES).toBe(20);
  });

  it("exposes presence only through authenticated secured RPCs", () => {
    expect(migration).toContain(
      "create or replace function public.record_current_game_presence()",
    );
    expect(migration).toContain(
      "create or replace function public.get_online_global_chat_directors()",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });

  it("refreshes the global list without tying it to the chat presence channel", () => {
    expect(chat).toContain("initialOnlineDirectors");
    expect(chat).toContain('fetch("/jeu/chat/online"');
    expect(chat).not.toContain('.on("presence"');
    expect(chat).not.toContain(".presenceState(");
    expect(chat).not.toContain(".track(");
    expect(GLOBAL_CHAT_ONLINE_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(
      GAME_PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
  });
});
