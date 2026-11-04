import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GLOBAL_CHAT_MESSAGES_READ_EVENT } from "@/lib/game/global-chat-read-sync";

const runtime = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  const maybeSingle = vi.fn();
  const authState = { callback: null as null | ((event: string, session: {user: {id: string}} | null) => void) };
  const unsubscribeAuth = vi.fn();
  return {
    effects: [] as (() => void | (() => void))[],
    setIndicators: vi.fn(),
    setCollectorAlbumAvailable: vi.fn(),
    setPcmExportAvailable: vi.fn(),
    booleanStateIndex: 0,
    authState,
    unsubscribeAuth,
    maybeSingle,
    channel,
    client: {
      auth: { onAuthStateChange: vi.fn((callback: NonNullable<typeof authState.callback>) => {
        authState.callback = callback;
        return {data: {subscription: {unsubscribe: unsubscribeAuth}}};
      }) },
      rpc: vi.fn(() => ({ maybeSingle })),
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

// Run the actual effect with mocked browser hooks, without a DOM or live Supabase.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { runtime.effects.push(effect); },
  useState: (initial: unknown) => [initial, typeof initial === "boolean"
    ? runtime.booleanStateIndex++ === 0 ? runtime.setCollectorAlbumAvailable : runtime.setPcmExportAvailable
    : runtime.setIndicators],
  useMemo: (factory: () => unknown) => factory(),
  useRef: (initial: unknown) => ({ current: initial }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => runtime.client,
}));

import { GameHeaderIndicatorsProvider } from "./game-header-indicators-provider";

const ROW = {
  game_role: null as string | null,
  current_sporting_director_id: "director-1",
  mailbox_unread_count: 2,
  direct_message_unread_count: 1,
  has_unread_global_chat: true,
  has_unread_cyclogazette: false,
};
const SUCCESS = { data: ROW, error: null };

describe("header subscription initialization", () => {
  let cleanup: (() => void) | void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    runtime.maybeSingle.mockReset();
    runtime.client.removeChannel.mockReset();
    runtime.effects.length = 0;
    runtime.booleanStateIndex = 0;
    runtime.authState.callback = null;
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function mount() {
    GameHeaderIndicatorsProvider({ children: null });
    cleanup = runtime.effects[0]();
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(0);
  }

  async function focus() {
    window.dispatchEvent(new Event("focus"));
    await vi.runAllTimersAsync();
  }

  it("updates the delegated export menu on login and clears it on logout without new requests", async () => {
    runtime.maybeSingle.mockResolvedValue(SUCCESS);
    await mount();
    const requests = runtime.client.rpc.mock.calls.length;
    runtime.authState.callback!("SIGNED_IN", { user: { id: "ee244935-5722-4626-a28f-dc3cf63aa6f4" } });
    expect(runtime.setPcmExportAvailable).toHaveBeenLastCalledWith(true);
    runtime.authState.callback!("SIGNED_IN", { user: { id: "f4a4c24e-b534-4a5f-adbc-8f259189b86c" } });
    expect(runtime.setPcmExportAvailable).toHaveBeenLastCalledWith(false);
    runtime.authState.callback!("SIGNED_OUT", null);
    expect(runtime.setPcmExportAvailable).toHaveBeenLastCalledWith(false);
    expect(runtime.client.rpc).toHaveBeenCalledTimes(requests);
  });

  function expectCompleteSubscription() {
    expect(runtime.client.rpc).toHaveBeenCalledWith("get_current_game_header_indicators_v3");
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
    expect(runtime.channel.on).toHaveBeenCalledTimes(5);
    expect(runtime.channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "direct_messages", filter: "recipient_id=eq.director-1" }),
      expect.any(Function),
    );
  }

  it("enables only the private account across routes using auth events, without another RPC", async () => {
    runtime.maybeSingle.mockResolvedValue(SUCCESS);
    await mount();
    expect(runtime.client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    runtime.authState.callback!("INITIAL_SESSION", {user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}});
    expect(runtime.setCollectorAlbumAvailable).toHaveBeenLastCalledWith(true);
    runtime.authState.callback!("SIGNED_IN", {user:{id:"another-account"}});
    expect(runtime.setCollectorAlbumAvailable).toHaveBeenLastCalledWith(false);
    runtime.authState.callback!("SIGNED_OUT", null);
    expect(runtime.setCollectorAlbumAvailable).toHaveBeenLastCalledWith(false);
    expect(runtime.client.rpc).toHaveBeenCalledExactlyOnceWith("get_current_game_header_indicators_v3");
    const calls = runtime.setCollectorAlbumAvailable.mock.calls.length;
    cleanup?.(); cleanup=undefined;
    expect(runtime.unsubscribeAuth).toHaveBeenCalledTimes(1);
    runtime.authState.callback!("SIGNED_IN", {user:{id:"58140add-54c6-40af-9528-f823d0051d0f"}});
    expect(runtime.setCollectorAlbumAvailable).toHaveBeenCalledTimes(calls);
  });

  it("waits for a successful identified snapshot after the first RPC fails", async () => {
    runtime.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: "temporary outage" } })
      .mockResolvedValue(SUCCESS);
    await mount();
    expect(runtime.client.channel).not.toHaveBeenCalled();
    await focus();
    expectCompleteSubscription();
    await focus();
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
  });

  it.each(["owner", "game_staff"])("expose le rôle %s via le même snapshot sans nouvelle RPC", async (role) => {
    runtime.maybeSingle.mockResolvedValue({ data: { ...ROW, game_role: role }, error: null });
    await mount();
    expect(runtime.client.rpc).toHaveBeenCalledExactlyOnceWith("get_current_game_header_indicators_v3");
    expect(runtime.setIndicators).toHaveBeenCalledWith(expect.objectContaining({ gameStaffRole: role }));
    expectCompleteSubscription();
  });

  it.each([undefined, null, "admin", "moderator", "forged_role"])("normalise un rôle absent ou inconnu en aucun accès : %s", async (role) => {
    runtime.maybeSingle.mockResolvedValue({ data: { ...ROW, game_role: role }, error: null });
    await mount();
    expect(runtime.setIndicators).toHaveBeenCalledWith(expect.objectContaining({ gameStaffRole: null }));
  });

  it("retire les entrées privilégiées après révocation du rôle lors du rafraîchissement existant", async () => {
    runtime.maybeSingle
      .mockResolvedValueOnce({ data: { ...ROW, game_role: "game_staff" }, error: null })
      .mockResolvedValue(SUCCESS);
    await mount();
    expect(runtime.setIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ gameStaffRole: "game_staff" }));
    await focus();
    expect(runtime.setIndicators).toHaveBeenLastCalledWith(expect.objectContaining({ gameStaffRole: null }));
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
  });

  it("does not create a partial subscription from a delayed superseded first snapshot", async () => {
    let resolveFirst!: (value: typeof SUCCESS) => void;
    runtime.maybeSingle
      .mockImplementationOnce(() => new Promise<typeof SUCCESS>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue(SUCCESS);
    await mount();
    expect(runtime.client.rpc).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event(GLOBAL_CHAT_MESSAGES_READ_EVENT));
    resolveFirst(SUCCESS);
    await vi.runAllTimersAsync();
    expect(runtime.setIndicators).toHaveBeenCalledTimes(1);
    expect(runtime.client.channel).not.toHaveBeenCalled();
    await focus();
    expectCompleteSubscription();
  });

  it.each([null, { ...ROW, current_sporting_director_id: null }])(
    "does not subscribe without a director identity: %s",
    async (data) => {
      runtime.maybeSingle.mockResolvedValueOnce({ data, error: null }).mockResolvedValue(SUCCESS);
      await mount();
      expect(runtime.client.channel).not.toHaveBeenCalled();
      await focus();
      expectCompleteSubscription();
    },
  );

  it("does not subscribe after unmount while the first request is pending", async () => {
    let resolveFirst!: (value: typeof SUCCESS) => void;
    runtime.maybeSingle.mockImplementationOnce(
      () => new Promise<typeof SUCCESS>((resolve) => { resolveFirst = resolve; }),
    );
    await mount();
    cleanup?.();
    cleanup = undefined;
    resolveFirst(SUCCESS);
    await vi.runAllTimersAsync();
    expect(runtime.client.channel).not.toHaveBeenCalled();
  });

  it("disconnects all five realtime bindings while hidden and catches up on return", async () => {
    runtime.maybeSingle.mockResolvedValue(SUCCESS);
    await mount();
    expectCompleteSubscription();
    const oldCallbacks = runtime.channel.on.mock.calls.map(([, , callback]) => callback as (value: unknown) => void);
    Object.assign(document, { visibilityState: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(runtime.client.removeChannel).toHaveBeenCalledTimes(1);
    const requests = runtime.client.rpc.mock.calls.length;
    const initialUpdates = runtime.setIndicators.mock.calls.length;
    for (const callback of oldCallbacks) callback({ new: { sporting_director_id: "another-director" } });
    await vi.runAllTimersAsync();
    expect(runtime.client.rpc).toHaveBeenCalledTimes(requests);
    expect(runtime.setIndicators).toHaveBeenCalledTimes(initialUpdates);
    const updates = runtime.setIndicators.mock.calls.length;
    Object.assign(document, { visibilityState: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.runAllTimersAsync();
    expect(runtime.client.rpc).toHaveBeenCalledTimes(requests + 1);
    expect(runtime.client.channel).toHaveBeenCalledTimes(2);
    expect(runtime.channel.on).toHaveBeenCalledTimes(10);
    for (const callback of oldCallbacks) callback({ new: { sporting_director_id: "another-director" } });
    await vi.runAllTimersAsync();
    expect(runtime.setIndicators).toHaveBeenCalledTimes(updates + 1);
    expect(runtime.client.rpc).toHaveBeenCalledTimes(requests + 1);
  });

  it("does not reconnect if the tab hides during a pending refresh", async () => {
    let finish!: (value: typeof SUCCESS) => void;
    runtime.maybeSingle.mockImplementationOnce(() => new Promise<typeof SUCCESS>((resolve) => { finish = resolve; }));
    await mount();
    Object.assign(document, { visibilityState: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    finish(SUCCESS);
    await vi.runAllTimersAsync();
    expect(runtime.client.channel).not.toHaveBeenCalled();
    expect(runtime.setIndicators).not.toHaveBeenCalled();
  });

  it("does no initial work in a hidden tab and snapshots before subscribing on return", async () => {
    Object.assign(document, { visibilityState: "hidden" });
    runtime.maybeSingle.mockResolvedValue(SUCCESS);
    await mount();
    expect(runtime.client.rpc).not.toHaveBeenCalled();
    expect(runtime.client.channel).not.toHaveBeenCalled();
    Object.assign(document, { visibilityState: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.runAllTimersAsync();
    expectCompleteSubscription();
  });

  it("awaits removal and replaces a snapshot invalidated by another hide/show cycle", async () => {
    let remove!: () => void;
    let finishSnapshot!: (value: typeof SUCCESS) => void;
    runtime.client.removeChannel.mockImplementationOnce(() => new Promise<void>((resolve) => { remove = resolve; }));
    runtime.maybeSingle.mockResolvedValueOnce(SUCCESS).mockResolvedValueOnce(SUCCESS)
      .mockImplementationOnce(() => new Promise<typeof SUCCESS>((resolve) => { finishSnapshot = resolve; }));
    await mount();
    for (const visibilityState of ["hidden", "visible"]) {
      Object.assign(document, { visibilityState });
      document.dispatchEvent(new Event("visibilitychange"));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.client.rpc).toHaveBeenCalledTimes(2);
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
    for (const visibilityState of ["hidden", "visible"]) {
      Object.assign(document, { visibilityState });
      document.dispatchEvent(new Event("visibilitychange"));
    }
    remove();
    await vi.runAllTimersAsync();
    expect(runtime.client.rpc).toHaveBeenCalledTimes(3);
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
    finishSnapshot(SUCCESS);
    await vi.runAllTimersAsync();
    expect(runtime.client.channel).toHaveBeenCalledTimes(2);
  });

  it("does not recreate the channel after unmount while its removal is pending", async () => {
    let remove!: () => void;
    runtime.client.removeChannel.mockImplementationOnce(() => new Promise<void>((resolve) => { remove = resolve; }));
    runtime.maybeSingle.mockResolvedValue(SUCCESS);
    await mount();
    Object.assign(document, { visibilityState: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.assign(document, { visibilityState: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    cleanup?.(); cleanup = undefined;
    remove();
    await vi.runAllTimersAsync();
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
  });
});
