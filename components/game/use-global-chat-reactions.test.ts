import { describe, expect, it } from "vitest";

import type { GlobalChatMessage } from "@/services/global-chat";

import { updateMessageReaction } from "./use-global-chat-reactions";

const baseMessage = {
  id: "11111111-1111-4111-8111-111111111111",
  sportingDirectorId: "22222222-2222-4222-8222-222222222222",
  authorAvatarKey: null,
  authorAvatarFrameKey: null,
  teamId: "33333333-3333-4333-8333-333333333333",
  authorDisplayName: "Marco Velo",
  teamDisplayName: "Roues Libres",
  message: "Belle étape",
  preview: null,
  replyTo: null,
  reactions: [],
  createdAt: "2026-08-09T08:00:00.000Z",
  editedAt: null,
} satisfies GlobalChatMessage;

const reactionRow = {
  message_id: baseMessage.id,
  sporting_director_id: "44444444-4444-4444-8444-444444444444",
  reactor_display_name: "Lina Grimpe",
  team_id: "55555555-5555-4555-8555-555555555555",
  team_display_name: "Col Express",
  emoji: "👍" as const,
};

describe("updateMessageReaction", () => {
  it("ajoute le membre sans le dupliquer entre optimisme et temps réel", () => {
    const once = updateMessageReaction([baseMessage], reactionRow, true);
    const twice = updateMessageReaction(once, reactionRow, true);

    expect(twice[0].reactions).toEqual([
      {
        emoji: "👍",
        sportingDirectorIds: [reactionRow.sporting_director_id],
        members: [
          {
            sportingDirectorId: reactionRow.sporting_director_id,
            displayName: "Lina Grimpe",
            teamId: reactionRow.team_id,
            teamDisplayName: "Col Express",
          },
        ],
      },
    ]);
  });

  it("retire le membre et le groupe devenu vide", () => {
    const added = updateMessageReaction([baseMessage], reactionRow, true);
    const removed = updateMessageReaction(added, reactionRow, false);

    expect(removed[0].reactions).toEqual([]);
  });
});
