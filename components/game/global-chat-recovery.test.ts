import { describe, expect, it } from "vitest";
import type { GlobalChatMessage, GlobalChatMessagePage } from "@/services/global-chat";
import { compareGlobalChatMessages, mergeGlobalChatRecoveryPage } from "./global-chat-recovery";

function message(id: number): GlobalChatMessage {
  return {
    id: String(id),
    sportingDirectorId: "director",
    authorAvatarKey: null,
    authorAvatarFrameKey: null,
    authorCountry: null,
    teamId: "team",
    authorDisplayName: "DS",
    teamDisplayName: "Team",
    message: String(id),
    preview: null,
    replyTo: null,
    reactions: [],
    createdAt: new Date(Date.UTC(2026, 10, 12, 12, id)).toISOString(),
    editedAt: null,
  };
}

function page(messages: GlobalChatMessage[], hasMore = true): GlobalChatMessagePage {
  return { messages, hasMore, nextCursor: hasMore ? messages[0] : null };
}

describe("global chat recovery", () => {
  it("keeps loaded older history and uses the authoritative edits, reactions and removals in the fresh range", () => {
    const older = message(1);
    const first = message(2);
    const removed = message(3);
    const existing = message(4);
    const fresh = message(5);
    const edited = {
      ...existing,
      message: "edited",
      editedAt: fresh.createdAt,
      reactions: [{ emoji: "👍" as const, sportingDirectorIds: ["reactor"], members: [] }],
    };

    expect(mergeGlobalChatRecoveryPage(
      [older, first, removed, existing], page([first, edited, fresh]),
    )).toEqual({
      messages: [older, first, edited, fresh],
      replacesPagination: false,
    });
  });

  it("starts from the fresh cursor when more messages arrived than the recovery window can cover", () => {
    const fresh = [message(10), message(11)];
    expect(mergeGlobalChatRecoveryPage([message(1), message(2)], page(fresh))).toEqual({
      messages: fresh,
      replacesPagination: true,
    });
  });

  it("clears deleted messages when the fresh window contains the entire retained feed", () => {
    expect(mergeGlobalChatRecoveryPage([message(1), message(2)], page([], false))).toEqual({
      messages: [],
      replacesPagination: true,
    });
  });

  it("orders messages with equal timestamps using the database cursor tie-break", () => {
    const first = message(1);
    const sameTime = { ...message(2), createdAt: first.createdAt };
    expect([sameTime, first].sort(compareGlobalChatMessages)).toEqual([first, sameTime]);
  });
});
