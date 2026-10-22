import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

const mocks = vi.hoisted(() => ({ directory: vi.fn() }));
vi.mock("@/services/game-staff-access", () => ({ getGameStaffDirectorIds: mocks.directory }));

import { getGlobalChatMessagePage, getGlobalChatOverview, type GlobalChatMessageRow } from "./global-chat";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const rookieExpiresAt = "2026-11-01T00:00:00.000Z";

function row(id: string, directorId: string): GlobalChatMessageRow {
  return { id, sporting_director_id: directorId, team_id: "team", author_display_name: directorId,
    team_display_name: "Team", message: "Bonjour", created_at: "2026-10-22T08:00:00.000Z",
    edited_at: null } as GlobalChatMessageRow;
}

function fakeClient(messages: GlobalChatMessageRow[], profileIds = ["staff", "player"]) {
  const rpc = vi.fn(async (name: string, parameters?: { p_sporting_director_ids?: string[] }) => {
    if (name === "get_global_chat_director_profiles") return { data: profileIds.map((id) => ({
      sporting_director_id: id, avatar_key: null, avatar_frame_key: null, country_name: null, country_code: null,
      gameStaff: id !== "staff", // Forged profile metadata must also have no influence.
    })), error: null };
    if (name === "get_global_chat_rookie_status") return { data: (parameters?.p_sporting_director_ids ?? []).map((id) => ({
      sporting_director_id: id, badge_expires_at: rookieExpiresAt,
    })), error: null };
    if (name === "get_current_global_chat_identity_v2") return { data: [{ sporting_director_id: "staff", username: "staff",
      display_name: "Staff", avatar_key: null, avatar_frame_key: null, country_name: null, country_code: null,
      team_id: "team", team_name: "Team" }], error: null };
    if (name === "get_online_global_chat_directors_v2") return { data: [{ sporting_director_id: "player", username: "player",
      display_name: "Player", avatar_key: null, avatar_frame_key: null, country_name: null, country_code: null,
      team_id: "team-2", team_name: "Team 2", gameStaff: true }], error: null };
    if (name === "get_current_global_chat_last_read_at") return { data: null, error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
  const from = vi.fn((table: string) => {
    const result = { data: table === "global_chat_messages" ? messages : [], error: null };
    const query = {
      select: () => query, gte: () => query, order: () => query, or: () => query, in: () => query,
      limit: async () => result,
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { client: { rpc, from } as unknown as Client, rpc, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockResolvedValue(["staff"]);
});

describe("game team badges in global chat", () => {
  it("loads the shared visual directory once for the whole message batch, not per message", async () => {
    const messages = Array.from({ length: 30 }, (_, index) => row(`message-${index}`, index % 2 ? "player" : "staff"));
    const { client, rpc } = fakeClient(messages);
    const page = await getGlobalChatMessagePage(client, { limit: 50 });

    expect(page.messages).toHaveLength(30);
    expect(mocks.directory).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.filter(([name]) => name === "get_global_chat_director_profiles")).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith("get_global_chat_director_profiles", { p_sporting_director_ids: ["staff", "player"] });
    for (const message of page.messages) {
      expect(message.gameStaff).toBe(message.sportingDirectorId === "staff");
      expect(message.rookieBadgeExpiresAt).toBe(rookieExpiresAt);
    }
  });

  it("does not query badge or profile metadata when there are no messages", async () => {
    const { client, rpc } = fakeClient([]);
    expect((await getGlobalChatMessagePage(client)).messages).toEqual([]);
    expect(mocks.directory).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes a trusted visual directory and matching identity/presence to the chat", async () => {
    const { client } = fakeClient([row("message", "staff")]);
    const overview = await getGlobalChatOverview(client);
    expect(overview.gameStaffDirectorIds).toEqual(["staff"]);
    expect(overview.identity.gameStaff).toBe(true);
    expect(overview.identity.rookieBadgeExpiresAt).toBe(rookieExpiresAt);
    expect(overview.onlineDirectors.find((director) => director.sportingDirectorId === "player")?.gameStaff).toBe(false);
    expect(overview.onlineDirectors.find((director) => director.sportingDirectorId === "staff")?.gameStaff).toBe(true);
  });

  it("does not badge ordinary players when the visual directory is unavailable", async () => {
    mocks.directory.mockResolvedValue([]);
    const { client } = fakeClient([row("message", "player")]);
    const page = await getGlobalChatMessagePage(client);
    expect(page.messages[0].gameStaff).toBe(false);
  });
});
