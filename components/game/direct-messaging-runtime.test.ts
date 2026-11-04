import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalChatIdentity } from "@/services/global-chat";

const runtime = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return {
    effects: [] as (() => void | (() => void))[],
    states: [] as unknown[], stateIndex: 0,
    refs: [] as { current: unknown }[], refIndex: 0,
    changed: vi.fn(),
    client: { channel: vi.fn(() => channel), removeChannel: vi.fn() },
    channel,
  };
});

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { runtime.effects.push(effect); },
  useLayoutEffect: () => undefined,
  useState: (initial: unknown) => {
    const index = runtime.stateIndex++;
    if (!(index in runtime.states)) runtime.states[index] = typeof initial === "function" ? initial() : initial;
    return [runtime.states[index], (next: unknown) => {
      runtime.states[index] = typeof next === "function" ? next(runtime.states[index]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const index = runtime.refIndex++;
    return runtime.refs[index] ??= { current: initial };
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useTransition: () => [false, vi.fn()],
}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => runtime.client }));
vi.mock("@/lib/game/direct-message-sync", () => ({ notifyDirectMessagesChanged: runtime.changed }));
vi.mock("@/app/jeu/chat/direct-actions", () => ({
  editDirectMessageAction: vi.fn(), markDirectConversationReadAction: vi.fn(),
  openDirectConversationAction: vi.fn(), postDirectMessageAction: vi.fn(),
}));

import { DirectMessagingPanel } from "./direct-messaging-panel";

const MESSAGE = { new: {
  id: "message-1", conversation_id: "conversation-1", sender_id: "sender-1",
  recipient_id: "director-1", body: "Message", created_at: "2026-11-04T09:00:00Z",
} };

describe("private conversation overview refresh lifecycle", () => {
  let cleanups: (() => void)[];
  let fetcher: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    runtime.states.length = 0;
    runtime.refs.length = 0;
    cleanups = [];
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      setTimeout, clearTimeout, setInterval, clearInterval,
      requestAnimationFrame: () => 1, cancelAnimationFrame: vi.fn(),
      matchMedia: () => ({ matches: false }),
    }));
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      conversationPage: { conversations: [], hasMore: false, nextCursor: null }, totalUnreadCount: 0,
    }) });
    vi.stubGlobal("fetch", fetcher);
  });

  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function render(active: boolean, first = false) {
    runtime.effects.length = 0;
    runtime.stateIndex = 0;
    runtime.refIndex = 0;
    DirectMessagingPanel({
      identity: { sportingDirectorId: "director-1" } as GlobalChatIdentity,
      active, requestedRecipientId: null, onRequestedRecipientHandled: vi.fn(), onUnreadCountChange: vi.fn(),
    });
    // React updates the active ref without recreating the persistent channel.
    const effects = first ? runtime.effects : runtime.effects.slice(0, 1);
    for (const effect of effects) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    }
  }

  function incoming() {
    const callback = runtime.channel.on.mock.calls.find(([, binding]) => binding.event === "INSERT")![2] as (payload: typeof MESSAGE) => void;
    callback(MESSAGE);
  }

  it("keeps unread notifications while the pane is inactive and loads once when it reopens", async () => {
    render(false, true);
    incoming(); incoming(); incoming();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(runtime.changed).toHaveBeenCalledTimes(3);
    render(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(runtime.client.channel).toHaveBeenCalledTimes(1);
  });

  it("coalesces visible bursts and pauses overview reads until a hidden browser tab returns", async () => {
    render(true, true);
    await vi.advanceTimersByTimeAsync(0);
    incoming(); incoming(); incoming();
    await vi.advanceTimersByTimeAsync(180);
    expect(fetcher).toHaveBeenCalledTimes(2);
    Object.assign(document, { visibilityState: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    incoming(); incoming();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher).toHaveBeenCalledTimes(2);
    Object.assign(document, { visibilityState: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("disposes pending refreshes, listeners and late realtime callbacks on unmount", async () => {
    render(true, true);
    incoming();
    const notifications = runtime.changed.mock.calls.length;
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
    incoming();
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(runtime.changed).toHaveBeenCalledTimes(notifications);
    expect(runtime.client.removeChannel).toHaveBeenCalledTimes(1);
  });
});
