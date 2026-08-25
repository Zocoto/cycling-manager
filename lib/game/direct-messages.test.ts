import { describe, expect, it } from "vitest";

import {
  isDirectConversationCursor,
  isDirectMessageCursor,
  normalizeDirectMessage,
} from "@/lib/game/direct-messages";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

describe("direct messages helpers", () => {
  it("normalizes whitespace before sending", () => {
    expect(normalizeDirectMessage("  Bonjour\n  au   peloton  ")).toBe(
      "Bonjour au peloton",
    );
  });

  it("accepts stable keyset cursors", () => {
    expect(
      isDirectMessageCursor({
        createdAt: "2026-08-25T08:00:00.000Z",
        id: uuid,
      }),
    ).toBe(true);
    expect(
      isDirectConversationCursor({
        lastActivityAt: "2026-08-25T08:00:00.000Z",
        id: uuid,
      }),
    ).toBe(true);
  });

  it("rejects partial or unstable cursors", () => {
    expect(
      isDirectMessageCursor({ createdAt: "hier", id: uuid }),
    ).toBe(false);
    expect(
      isDirectConversationCursor({
        lastActivityAt: "2026-08-25T08:00:00Z",
        id: "conversation-1",
      }),
    ).toBe(false);
  });
});
