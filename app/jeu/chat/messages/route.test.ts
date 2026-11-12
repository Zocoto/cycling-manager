import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: {},
  getUser: vi.fn(),
  getMessagePage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mocks.client,
}));
vi.mock("@/lib/supabase/authenticated-user", () => ({
  getAuthenticatedUser: mocks.getUser,
}));
vi.mock("@/services/global-chat", () => ({
  getGlobalChatMessagePage: mocks.getMessagePage,
}));

import { GET } from "./route";

describe("chat messages recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.getMessagePage.mockResolvedValue({ messages: [], hasMore: false, nextCursor: null });
  });

  it("returns a bounded, private recent page for authenticated catch-up", async () => {
    const response = await GET(new Request("https://site.test/jeu/chat/messages?latest=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.getMessagePage).toHaveBeenCalledExactlyOnceWith(mocks.client, { limit: 50 });
  });

  it("keeps the recent page behind authentication", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await GET(new Request("https://site.test/jeu/chat/messages?latest=1"));
    expect(response.status).toBe(401);
    expect(mocks.getMessagePage).not.toHaveBeenCalled();
  });

  it("keeps ordinary pagination tied to a valid timestamp and message id", async () => {
    const invalid = await GET(new Request("https://site.test/jeu/chat/messages"));
    expect(invalid.status).toBe(400);
    const cursor = {
      createdAt: "2026-11-12T12:00:00.000Z",
      id: "76baad4c-b862-4e3d-b5a5-a42f29d81ecb",
    };
    const parameters = new URLSearchParams({ beforeCreatedAt: cursor.createdAt, beforeId: cursor.id });
    const valid = await GET(new Request(`https://site.test/jeu/chat/messages?${parameters}`));
    expect(valid.status).toBe(200);
    expect(mocks.getMessagePage).toHaveBeenCalledExactlyOnceWith(mocks.client, { before: cursor });
  });
});
