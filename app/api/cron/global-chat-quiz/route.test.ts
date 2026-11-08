import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rpc: vi.fn(),
  portrait: vi.fn(),
}));

vi.mock("@/lib/security/cron-authorization", () => ({ isAuthorizedCronRequest: mocks.authorize }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/services/global-chat-quiz-portrait", () => ({ prepareGlobalChatQuizPortrait: mocks.portrait }));

import { GET } from "./route";

const request = new Request("https://example.test/api/cron/global-chat-quiz");
const round = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  riderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  avatarProfileKey: null,
  avatarSeed: "100",
  age: 25,
  portraitReady: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.authorize.mockReturnValue(true);
  mocks.portrait.mockResolvedValue(`${round.id}.webp`);
  mocks.rpc.mockImplementation((name: string) => ({
    abortSignal: async () => ({ data: name === "prepare_global_chat_quiz_round" ? round : true, error: null }),
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("daily chat quiz portrait preparation", () => {
  it("prepares exactly one image and publishes only its opaque path", async () => {
    const response = await GET(request);
    expect(await response.json()).toEqual({ status: "prepared" });
    expect(mocks.portrait).toHaveBeenCalledExactlyOnceWith(expect.any(Object), round);
    expect(mocks.rpc.mock.calls).toEqual([
      ["prepare_global_chat_quiz_round"],
      ["complete_global_chat_quiz_portrait", { p_round_id: round.id, p_portrait_path: `${round.id}.webp` }],
    ]);
  });

  it("skips the renderer for a prepared round and for a disabled event", async () => {
    mocks.rpc.mockReturnValueOnce({ abortSignal: async () => ({ data: { ...round, portraitReady: true }, error: null }) });
    mocks.rpc.mockReturnValueOnce({ abortSignal: async () => ({ data: null, error: null }) });
    expect(await (await GET(request)).json()).toEqual({ status: "already-prepared" });
    expect(await (await GET(request)).json()).toEqual({ status: "skipped" });
    expect(mocks.portrait).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls).toEqual([["prepare_global_chat_quiz_round"], ["prepare_global_chat_quiz_round"]]);
  });

  it("does not touch the database on unauthorized requests or on preview", async () => {
    mocks.authorize.mockReturnValueOnce(false);
    expect((await GET(request)).status).toBe(401);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await (await GET(request)).json()).toEqual({ status: "skipped" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
