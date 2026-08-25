import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const panel = readFileSync(
  join(process.cwd(), "components/game/direct-messaging-panel.tsx"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "app/jeu/chat/page.tsx"),
  "utf8",
);

describe("direct messaging performance contract", () => {
  it("loads conversation history only when the private tab is used", () => {
    expect(panel).toContain("if (!active || overviewLoaded || isLoadingOverview) return");
    expect(panel).toContain('fetch("/jeu/chat/prives/conversations"');
    expect(page).not.toContain("getDirectMessagingOverview");
  });

  it("uses one recipient-filtered realtime subscription", () => {
    expect(panel.match(/\.channel\(/g)).toHaveLength(1);
    expect(panel).toContain(
      "filter: `recipient_id=eq.${identity.sportingDirectorId}`",
    );
    expect(panel).not.toContain("conversation_id=eq.");
  });

  it("paginates conversations and messages with stable cursors", () => {
    expect(panel).toContain("beforeActivityAt");
    expect(panel).toContain("beforeCreatedAt");
    expect(panel).toContain("conversationCursor");
    expect(panel).toContain("messageCursor");
  });
});
