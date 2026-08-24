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

const shortcutSources = [
  "director-mailbox-shortcut.tsx",
  "global-chat-shortcut.tsx",
  "cyclogazette-shortcut.tsx",
].map((filename) =>
  readFileSync(join(process.cwd(), "components/game", filename), "utf8"),
);

describe("game header indicators provider", () => {
  it("uses one RPC and one realtime channel for the three indicators", () => {
    expect(provider).toContain('.rpc("get_current_game_header_indicators")');
    expect(provider).toContain('.channel("game-header-indicators:v1")');
    expect(provider.match(/\.channel\(/g)).toHaveLength(1);
    expect(provider).toContain('table: "sporting_director_messages"');
    expect(provider).toContain('table: "global_chat_messages"');
    expect(provider).toContain('table: "cyclogazette_editions"');
  });

  it("coalesces bursts and ignores stale refreshes", () => {
    expect(provider).toContain("if (refreshTimer !== null) window.clearTimeout(refreshTimer)");
    expect(provider).toContain("requestVersion !== requestVersionRef.current");
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
