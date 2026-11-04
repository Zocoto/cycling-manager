import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SITE_PRESENCE_REFRESH_MS, SITE_PRESENCE_SNAPSHOT_KEY, storeSitePresenceSnapshot } from "@/lib/game/site-presence-polling";

const runtime = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  setPresence: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { runtime.effects.push(effect); },
  useState: (initial: unknown) => [initial, runtime.setPresence],
}));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => ({ locale: "fr" }) }));

import { SitePresenceProvider } from "./site-presence";

const DATA = { total: 2, visitors: 1, players: [{ id: "player", name: "Player" }] };

describe("site presence provider lifecycle", () => {
  let cleanups: (() => void)[];
  let fetcher: ReturnType<typeof vi.fn>;
  let storage: Storage;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.clearAllMocks();
    runtime.effects.length = 0;
    cleanups = [];
    const values = new Map<string, string>();
    storage = {
      get length() { return values.size; },
      key: (index: number) => [...values.keys()][index] ?? null,
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    vi.stubGlobal("window", Object.assign(new EventTarget(), {
      localStorage: storage, setTimeout, clearTimeout, setInterval, clearInterval,
    }));
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
    vi.stubGlobal("navigator", {});
    fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => DATA });
    vi.stubGlobal("fetch", fetcher);
  });

  afterEach(() => {
    for (const cleanup of cleanups) cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function mount() {
    SitePresenceProvider({ children: null });
    const cleanup = runtime.effects.at(-1)!();
    if (cleanup) cleanups.push(cleanup);
  }

  async function visibility(visibilityState: "visible" | "hidden") {
    Object.assign(document, { visibilityState });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
  }

  it("shares one successful request across concurrent mounts and refreshes every two minutes", async () => {
    let queue: Promise<unknown> = Promise.resolve();
    const request = vi.fn((_name: string, callback: () => Promise<void>) => {
      const result = queue.then(callback);
      queue = result.catch(() => undefined);
      return result;
    });
    vi.stubGlobal("navigator", { locks: { request } });
    for (let tab = 0; tab < 4; tab += 1) mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(runtime.setPresence).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(SITE_PRESENCE_REFRESH_MS);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(runtime.setPresence).toHaveBeenCalledTimes(8);
  });

  it("defers hidden mounts and hidden interval ticks until the tab returns", async () => {
    Object.assign(document, { visibilityState: "hidden" });
    mount();
    await vi.advanceTimersByTimeAsync(SITE_PRESENCE_REFRESH_MS * 2);
    expect(fetcher).not.toHaveBeenCalled();
    await visibility("visible");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await visibility("hidden");
    await vi.advanceTimersByTimeAsync(SITE_PRESENCE_REFRESH_MS * 2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await visibility("visible");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not start a queued browser-lock request after the provider unmounts", async () => {
    let run!: () => Promise<void>;
    vi.stubGlobal("navigator", { locks: { request: vi.fn((_name: string, callback: () => Promise<void>) => {
      run = callback;
      return new Promise<void>(() => undefined);
    }) } });
    mount();
    cleanups.pop()!();
    await run();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps a fresh cached snapshot without another request and accepts updates from another tab", async () => {
    storeSitePresenceSnapshot(storage, 0, DATA);
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(runtime.setPresence).toHaveBeenLastCalledWith(DATA);
    const next = { ...DATA, total: 3, visitors: 2 };
    storeSitePresenceSnapshot(storage, 0, next);
    window.dispatchEvent(Object.assign(new Event("storage"), { key: SITE_PRESENCE_SNAPSHOT_KEY }));
    expect(runtime.setPresence).toHaveBeenLastCalledWith(next);
  });

  it("retries failed requests on return while retaining the previous snapshot", async () => {
    fetcher.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => DATA });
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.setPresence).not.toHaveBeenCalled();
    await visibility("visible");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(runtime.setPresence).toHaveBeenLastCalledWith(DATA);
  });

  it.each(["timeout", "unmount"])("ignores a late response after %s", async (reason) => {
    let finish!: (value: unknown) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    mount();
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    if (reason === "timeout") await vi.advanceTimersByTimeAsync(10_000);
    else cleanups.pop()!();
    expect(signal.aborted).toBe(true);
    finish({ ok: true, status: 200, json: async () => DATA });
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.setPresence).not.toHaveBeenCalled();
    expect(storage.getItem(SITE_PRESENCE_SNAPSHOT_KEY)).toBeNull();
  });

  it("continues when the browser rejects Web Locks access", async () => {
    vi.stubGlobal("navigator", { locks: { request: vi.fn().mockRejectedValue(Error("unavailable")) } });
    mount();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(runtime.setPresence).toHaveBeenLastCalledWith(DATA);
  });
});
