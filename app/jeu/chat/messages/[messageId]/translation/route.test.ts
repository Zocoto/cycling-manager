import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getOrCreateGlobalChatTranslation: vi.fn(),
}));

vi.mock("@/lib/supabase/authenticated-user", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/services/global-chat-translation", () => {
  class ChatTranslationRateLimitError extends Error {}
  return {
    ChatTranslationRateLimitError,
    getOrCreateGlobalChatTranslation:
      mocks.getOrCreateGlobalChatTranslation,
    isChatProviderFailure: () => false,
  };
});

import { POST } from "./route";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const DIRECTOR_ID = "22222222-2222-4222-8222-222222222222";

describe("global chat translation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the stable v2 identity RPC and returns the isolated translation", async () => {
    const messageQuery = createMessageQuery({
      id: MESSAGE_ID,
      sporting_director_id: "33333333-3333-4333-8333-333333333333",
      message: "Saluti!",
      edited_at: null,
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ sporting_director_id: DIRECTOR_ID }],
        error: null,
      }),
      from: vi.fn(() => messageQuery),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);
    mocks.getAuthenticatedUser.mockResolvedValue({
      data: { user: { id: "authenticated-user" } },
      error: null,
    });
    mocks.getOrCreateGlobalChatTranslation.mockResolvedValue({
      translatedText: "Salut !",
      detectedSourceLocale: "it",
      targetLocale: "fr",
      cached: false,
    });

    const response = await POST(
      new Request(`https://cyclostratege.fr/jeu/chat/messages/${MESSAGE_ID}/translation`, {
        method: "POST",
        headers: { "x-vercel-oidc-token": "deployment-oidc-token" },
        body: JSON.stringify({ targetLocale: "fr" }),
      }),
      { params: Promise.resolve({ messageId: MESSAGE_ID }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      translatedText: "Salut !",
      detectedSourceLocale: "it",
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_current_global_chat_identity_v2",
    );
    expect(mocks.getOrCreateGlobalChatTranslation).toHaveBeenCalledWith({
      messageId: MESSAGE_ID,
      sourceMessage: "Saluti!",
      sourceEditedAt: null,
      targetLocale: "fr",
      requesterDirectorId: DIRECTOR_ID,
      vercelOidcToken: "deployment-oidc-token",
    });
  });

  it("rejects unauthenticated requests before touching chat data", async () => {
    const supabase = {
      rpc: vi.fn(),
      from: vi.fn(),
    };
    mocks.createSupabaseServerClient.mockResolvedValue(supabase);
    mocks.getAuthenticatedUser.mockResolvedValue({
      data: { user: null },
      error: new Error("expired session"),
    });

    const response = await POST(
      new Request(`https://cyclostratege.fr/jeu/chat/messages/${MESSAGE_ID}/translation`, {
        method: "POST",
        body: JSON.stringify({ targetLocale: "fr" }),
      }),
      { params: Promise.resolve({ messageId: MESSAGE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

function createMessageQuery(message: {
  id: string;
  sporting_director_id: string;
  message: string;
  edited_at: string | null;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: message, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}
