import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const provider = readFileSync(
  join(process.cwd(), "components/game/game-header-indicators-provider.tsx"),
  "utf8",
);
const gameHeader = readFileSync(
  join(process.cwd(), "components/game/game-header.tsx"),
  "utf8",
);
const gameLayout = readFileSync(
  join(process.cwd(), "app/jeu/layout.tsx"),
  "utf8",
);
const mailboxPage = readFileSync(
  join(process.cwd(), "app/jeu/messagerie/page.tsx"),
  "utf8",
);
const markAllReadButton = readFileSync(
  join(
    process.cwd(),
    "components/game/director-mailbox-mark-all-read-button.tsx",
  ),
  "utf8",
);

const shortcutSources = [
  "director-mailbox-shortcut.tsx",
  "global-chat-shortcut.tsx",
  "cyclogazette-shortcut.tsx",
].map((filename) =>
  readFileSync(join(process.cwd(), "components/game", filename), "utf8"),
);

describe("game header indicators provider", () => {
  it("uses one RPC and one realtime channel for all indicators", () => {
    expect(provider).toMatch(
      /await import\(\s*["']@\/lib\/supabase\/client["']\s*\)/,
    );
    expect(provider).not.toContain(
      'import { createSupabaseBrowserClient } from "@/lib/supabase/client"',
    );
    expect(provider).toContain('.rpc("get_current_game_header_indicators_v2")');
    expect(provider).toContain('.channel("game-header-indicators:v2")');
    expect(provider.match(/\.channel\(/g)).toHaveLength(1);
    expect(provider).toContain('table: "sporting_director_messages"');
    expect(provider).toContain(
      "`sporting_director_id=eq.${row.current_sporting_director_id}`",
    );
    expect(provider).toContain('table: "global_chat_messages"');
    expect(provider).toContain('table: "direct_messages"');
    expect(provider).toContain(
      "filter: `recipient_id=eq.${row.current_sporting_director_id}`",
    );
    expect(provider).toContain('table: "cyclogazette_editions"');
  });

  it("coalesces bursts and ignores stale refreshes", () => {
    expect(provider).toContain("if (refreshTimer !== null) window.clearTimeout(refreshTimer)");
    expect(provider).toContain("requestVersion !== requestVersionRef.current");
  });

  it("clears the mailbox badge as soon as all messages are marked read", () => {
    expect(mailboxPage).toContain("<DirectorMailboxMarkAllReadButton />");
    expect(markAllReadButton).toContain(
      "await markAllDirectorMessagesReadAction()",
    );
    expect(markAllReadButton).toContain("notifyDirectorMailboxChanged(0)");
    expect(provider).toContain("function handleDirectorMailboxChanged");
    expect(provider).toContain("mailboxUnreadCount: normalizedUnreadCount");
    expect(provider).toContain("refreshWhenVisible();");
  });

  it("persists across game navigations instead of reconnecting per page", () => {
    expect(gameLayout).toContain("<GameHeaderIndicatorsProvider>");
    expect(gameHeader).not.toContain("GameHeaderIndicatorsProvider");
    expect(provider).toContain("}, []);");
  });

  it("keeps shortcut components presentational", () => {
    for (const shortcut of shortcutSources) {
      expect(shortcut).toContain("useGameHeaderIndicators");
      expect(shortcut).not.toContain(".channel(");
      expect(shortcut).not.toContain(".rpc(");
    }
  });
});
