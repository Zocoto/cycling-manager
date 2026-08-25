import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { GlobalChatMessage } from "@/services/global-chat";

import { GlobalChatMessageReactions } from "./global-chat-message-reactions";

const message = {
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
  reactions: [
    {
      emoji: "👍",
      members: [
        {
          sportingDirectorId: "44444444-4444-4444-8444-444444444444",
          displayName: "Lina Grimpe",
          teamId: "55555555-5555-4555-8555-555555555555",
          teamDisplayName: "Col Express",
        },
        {
          sportingDirectorId: "66666666-6666-4666-8666-666666666666",
          displayName: "Noé Sprint",
          teamId: "77777777-7777-4777-8777-777777777777",
          teamDisplayName: "Foudre Rouge",
        },
      ],
      sportingDirectorIds: [
        "44444444-4444-4444-8444-444444444444",
        "66666666-6666-4666-8666-666666666666",
      ],
    },
  ],
  createdAt: "2026-08-09T08:00:00.000Z",
} satisfies GlobalChatMessage;

describe("GlobalChatMessageReactions", () => {
  it("rend consultables les membres et leurs équipes pour chaque réaction", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatMessageReactions
        message={message}
        isCurrentDirector={false}
        currentDirectorId="88888888-8888-4888-8888-888888888888"
        pendingReactionKey={null}
        reactionsDisabled={false}
        onReaction={() => undefined}
      />,
    );

    expect(markup).toContain("👍");
    expect(markup).toContain(">2<");
    expect(markup).toContain("Membres ayant réagi");
    expect(markup).toContain("Lina Grimpe");
    expect(markup).toContain("Col Express");
    expect(markup).toContain("Noé Sprint");
    expect(markup).toContain(
      "/jeu/equipes/55555555-5555-4555-8555-555555555555",
    );
  });

  it("identifie la réaction du DS courant", () => {
    const markup = renderToStaticMarkup(
      <GlobalChatMessageReactions
        message={message}
        isCurrentDirector
        currentDirectorId="44444444-4444-4444-8444-444444444444"
        pendingReactionKey={null}
        reactionsDisabled={false}
        onReaction={() => undefined}
      />,
    );

    expect(markup).toContain('aria-pressed="true"');
  });
});
