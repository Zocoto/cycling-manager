import { describe, expect, it, vi } from "vitest";

import { getRaceLiveMessages } from "./race-live-chat";

function createQuery(result: { data: unknown[]; error: null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    returns: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.returns.mockResolvedValue(result);
  return query;
}

describe("getRaceLiveMessages", () => {
  it("fusionne l historique du salon de course avec le fil general centralise", async () => {
    const legacyQuery = createQuery({
      data: [
        {
          id: "legacy-message",
          stage_id: "stage-1",
          race_edition_id: "edition-1",
          sporting_director_id: "director-1",
          author_display_name: "Alex Dupont",
          message: "Premier message du tour.",
          created_at: "2026-07-30T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const globalQuery = createQuery({
      data: [
        {
          id: "global-message",
          source_stage_id: "stage-2",
          source_race_edition_id: "edition-1",
          sporting_director_id: "director-2",
          author_display_name: "Camille Martin",
          message: "On se retrouve pour la deuxième étape.",
          created_at: "2026-07-30T10:01:00.000Z",
        },
      ],
      error: null,
    });
    const supabase = {
      from: vi.fn((table: string) =>
        table === "race_live_messages" ? legacyQuery : globalQuery,
      ),
    };

    const messages = await getRaceLiveMessages(
      supabase as never,
      "edition-1",
    );

    expect(supabase.from).toHaveBeenCalledWith("race_live_messages");
    expect(supabase.from).toHaveBeenCalledWith("global_chat_messages");
    expect(legacyQuery.eq).toHaveBeenCalledWith("race_edition_id", "edition-1");
    expect(globalQuery.eq).toHaveBeenCalledWith(
      "source_race_edition_id",
      "edition-1",
    );
    expect(messages.map((message) => message.stageId)).toEqual([
      "stage-1",
      "stage-2",
    ]);
  });
});
