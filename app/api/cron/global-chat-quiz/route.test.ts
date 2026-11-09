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

function queueRounds(...rounds: (typeof round)[]) {
  mocks.rpc.mockImplementation((name: string) => ({
    abortSignal: async () => ({
      data: name === "prepare_global_chat_quiz_round" ? rounds.shift() ?? null : true,
      error: null,
    }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.authorize.mockReturnValue(true);
  mocks.portrait.mockImplementation(async (_admin, input: typeof round) => `${input.id}.webp`);
  queueRounds(round);
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
      ["prepare_global_chat_quiz_round"],
    ]);
  });

  it("prepares up to three different portraits in a single scheduled run", async () => {
    const rounds = [round, ...["cccccccc", "dddddddd", "eeeeeeee"].map(prefix => ({
      ...round, id: `${prefix}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
    }))];
    queueRounds(...rounds);
    expect(await (await GET(request)).json()).toEqual({ status: "prepared" });
    expect(mocks.portrait.mock.calls.map(([, input]) => input.id)).toEqual(rounds.slice(0, 3).map(input => input.id));
    expect(mocks.rpc.mock.calls).toEqual(rounds.slice(0, 3).flatMap(input => [
      ["prepare_global_chat_quiz_round"],
      ["complete_global_chat_quiz_portrait", { p_round_id: input.id, p_portrait_path: `${input.id}.webp` }],
    ]));
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
