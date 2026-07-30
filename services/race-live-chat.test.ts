import { describe, expect, it, vi } from "vitest";

import { getRaceLiveMessages } from "./race-live-chat";

describe("getRaceLiveMessages", () => {
  it("charge un seul salon pour toutes les etapes d une edition", async () => {
    const query = {
      from: vi.fn(),
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      returns: vi.fn(),
    };

    query.from.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.returns.mockResolvedValue({
      data: [
        {
          id: "message-stage-2",
          stage_id: "stage-2",
          race_edition_id: "edition-1",
          sporting_director_id: "director-2",
          author_display_name: "Camille Martin",
          message: "On se retrouve pour la deuxieme etape.",
          created_at: "2026-07-30T10:01:00.000Z",
        },
        {
          id: "message-stage-1",
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

    const messages = await getRaceLiveMessages(
      query as never,
      "edition-1",
    );

    expect(query.eq).toHaveBeenCalledWith(
      "race_edition_id",
      "edition-1",
    );
    expect(messages.map((message) => message.stageId)).toEqual([
      "stage-1",
      "stage-2",
    ]);
    expect(
      messages.every(
        (message) => message.raceEditionId === "edition-1",
      ),
    ).toBe(true);
  });
});
