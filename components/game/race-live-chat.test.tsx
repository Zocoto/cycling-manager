import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RaceLiveMessage } from "@/services/race-live-chat";

import { RaceLiveChat } from "./race-live-chat";

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({}),
}));

vi.mock("@/app/jeu/resultats/chat-actions", () => ({
  postRaceLiveMessageAction: vi.fn(),
}));

describe("RaceLiveChat", () => {
  it("affiche en permanence les réactions des DS à côté du replay", () => {
    const messages: RaceLiveMessage[] = [
      {
        id: "message-1",
        stageId: "stage-1",
        raceEditionId: "edition-1",
        sportingDirectorId: "director-2",
        authorDisplayName: "Camille Martin",
        message: "L’échappée commence à prendre le large.",
        createdAt: "2026-07-27T08:15:00.000Z",
      },
      {
        id: "message-2",
        stageId: "stage-1",
        raceEditionId: "edition-1",
        sportingDirectorId: "director-1",
        authorDisplayName: "Alex Dupont",
        message: "Mon leader reste bien placé.",
        createdAt: "2026-07-27T08:16:00.000Z",
      },
    ];

    const markup = renderToStaticMarkup(
      <RaceLiveChat
        stageId="stage-1"
        raceEditionId="edition-1"
        currentDirectorId="director-1"
        initialMessages={messages}
        mode="replay"
      />,
    );

    expect(markup).toContain('data-race-live-chat="persistent"');
    expect(markup).toContain('data-race-chat-room="edition-1"');
    expect(markup).toContain('aria-label="Chat du replay"');
    expect(markup).toContain("Chat des Directeurs Sportifs");
    expect(markup).toContain("Camille Martin");
    expect(markup).toContain("L’échappée commence à prendre le large.");
    expect(markup).toContain("Mon leader reste bien placé.");
    expect(markup).toContain("Réagir à la course");
    expect(markup).toContain("xl:sticky");
  });
});
